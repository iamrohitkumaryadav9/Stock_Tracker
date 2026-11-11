import { Rng, mean, std, skewness, kurtosis, normCdf, normInv, quantile } from '@/lab/core/util';

export const EULER_GAMMA = 0.5772156649;

export function sharpe(r: number[], periodsPerYear = 252): number {
  const s = std(r);
  return s === 0 ? 0 : (mean(r) / s) * Math.sqrt(periodsPerYear);
}
export function sortino(r: number[], periodsPerYear = 252): number {
  const dd = Math.sqrt(mean(r.map((x) => (x < 0 ? x * x : 0))));
  return dd === 0 ? 0 : (mean(r) / dd) * Math.sqrt(periodsPerYear);
}
export function maxDrawdown(equity: number[]): number {
  let peak = -Infinity, dd = 0;
  for (const e of equity) { peak = Math.max(peak, e); dd = Math.min(dd, e / peak - 1); }
  return dd;
}

/** Probabilistic Sharpe Ratio: P(true SR > benchmark) given sample skew/kurtosis and length (Bailey & Lopez de Prado). */
export function probabilisticSharpe(r: number[], benchmarkPerPeriod = 0): number {
  const T = r.length;
  if (T < 10) return NaN;
  const sr = mean(r) / (std(r) || 1e-12);
  const g3 = skewness(r), g4 = kurtosis(r);
  const denom = Math.sqrt(Math.max(1e-12, 1 - g3 * sr + ((g4 - 1) / 4) * sr * sr));
  return normCdf(((sr - benchmarkPerPeriod) * Math.sqrt(T - 1)) / denom);
}

/**
 * Deflated Sharpe Ratio. Corrects the Sharpe of the *selected* strategy for the number of configurations
 * tried (nTrials) and the dispersion of their Sharpe ratios. The honest answer to "how many variants did
 * you try before this one looked good?".
 */
export function deflatedSharpe(selected: number[], trialSharpesPerPeriod: number[]): { dsr: number; sr0: number; nTrials: number } {
  const N = Math.max(2, trialSharpesPerPeriod.length);
  const v = std(trialSharpesPerPeriod) ** 2;
  const sr0 = Math.sqrt(v) * ((1 - EULER_GAMMA) * normInv(1 - 1 / N) + EULER_GAMMA * normInv(1 - 1 / (N * Math.E)));
  return { dsr: probabilisticSharpe(selected, sr0), sr0, nTrials: trialSharpesPerPeriod.length };
}

/** Stationary bootstrap CI for annualised Sharpe. */
export function bootstrapSharpeCI(r: number[], iters = 400, meanBlock = 10, seed = 1, alpha = 0.05) {
  const rng = new Rng(seed);
  const n = r.length;
  if (n < 20) return { lo: NaN, hi: NaN };
  const p = 1 / meanBlock;
  const out: number[] = [];
  for (let it = 0; it < iters; it++) {
    const s: number[] = [];
    let i = rng.int(0, n - 1);
    for (let k = 0; k < n; k++) {
      s.push(r[i]);
      i = rng.next() < p ? rng.int(0, n - 1) : (i + 1) % n;
    }
    out.push(sharpe(s));
  }
  return { lo: quantile(out, alpha / 2), hi: quantile(out, 1 - alpha / 2) };
}

/**
 * Probability of Backtest Overfitting via CSCV (Bailey, Borwein, Lopez de Prado, Zhu).
 * `M[t][k]` = return of strategy k at time t. Splits time into S blocks; for every half/half combination,
 * picks the best in-sample strategy and checks where it ranks out-of-sample. PBO = share of splits in which
 * the in-sample winner lands in the bottom half out-of-sample.
 */
export function probabilityOfBacktestOverfitting(M: number[][], S = 8): { pbo: number; combos: number; medianOosRank: number; logits: number[] } {
  const T = M.length, K = M[0]?.length ?? 0;
  if (K < 2 || T < S * 5) return { pbo: NaN, combos: 0, medianOosRank: NaN, logits: [] };
  const blockSize = Math.floor(T / S);
  const blocks = Array.from({ length: S }, (_, b) => Array.from({ length: blockSize }, (_, i) => b * blockSize + i));
  const combos: number[][] = [];
  const rec = (start: number, cur: number[]) => {
    if (cur.length === S / 2) { combos.push([...cur]); return; }
    for (let i = start; i < S; i++) { cur.push(i); rec(i + 1, cur); cur.pop(); }
  };
  rec(0, []);
  const sr = (idx: number[], k: number) => sharpe(idx.map((t) => M[t][k]), 1);
  const logits: number[] = [], ranks: number[] = [];
  for (const c of combos) {
    const isIdx = c.flatMap((b) => blocks[b]);
    const oosIdx = blocks.map((_, b) => b).filter((b) => !c.includes(b)).flatMap((b) => blocks[b]);
    let best = 0, bestSr = -Infinity;
    for (let k = 0; k < K; k++) { const s = sr(isIdx, k); if (s > bestSr) { bestSr = s; best = k; } }
    const oos = Array.from({ length: K }, (_, k) => sr(oosIdx, k));
    const rank = (oos.filter((x) => x < oos[best]).length + 1) / (K + 1); // relative rank in (0,1)
    ranks.push(rank);
    logits.push(Math.log(rank / (1 - rank)));
  }
  return { pbo: logits.filter((l) => l <= 0).length / logits.length, combos: logits.length, medianOosRank: quantile(ranks, 0.5), logits };
}
