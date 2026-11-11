import { Simulation, DEFAULT_SIM, type Snapshot } from '@/lab/exchange/simulator';
import { Rng, mean, std, normCdf } from '@/lab/core/util';

/**
 * Limit-order-book mid-price direction prediction, evaluated the way a trading desk would:
 * time-separated train/validation/test "days" (different simulator seeds), and a cost-aware P&L test, because
 * classification accuracy that disappears after paying the spread is worthless.
 * Models are implemented from scratch (no ML library): a multinomial logistic regression and a one-hidden-layer MLP.
 * This is a compact stand-in for DeepLOB-style CNN-LSTMs (which need a GPU stack) with the same evaluation protocol.
 */
export const FEATURES = ['imb1', 'imb2', 'imb3', 'imb5cum', 'spread', 'micro-mid', 'flow', 'flow lag1', 'flow lag2', 'ret lag1', 'ret lag3'] as const;

export function features(snaps: Snapshot[], i: number): number[] {
  const s = snaps[i];
  const imb = (k: number) => (s.bidQty[k] - s.askQty[k]) / Math.max(1, s.bidQty[k] + s.askQty[k]);
  const cb = s.bidQty.reduce((a, b) => a + b, 0), ca = s.askQty.reduce((a, b) => a + b, 0);
  const g = (j: number) => snaps[Math.max(0, i - j)];
  return [imb(0), imb(1), imb(2), (cb - ca) / Math.max(1, cb + ca), s.spread, s.micro - s.mid, s.flow / 10, g(1).flow / 10, g(2).flow / 10, s.mid - g(1).mid, s.mid - g(3).mid];
}

export interface Dataset { X: number[][]; y: number[]; idx: number[]; snaps: Snapshot[] }
/** labels: 0 = down, 1 = flat, 2 = up, by mid move over `horizon` steps vs `thresh` ticks */
export function makeDataset(seed: number, steps: number, horizon: number, thresh: number): Dataset {
  const sim = new Simulation({ ...DEFAULT_SIM, seed, nNoise: 10 }).run(steps);
  const snaps = sim.snapshots;
  const X: number[][] = [], y: number[] = [], idx: number[] = [];
  for (let i = 5; i + horizon < snaps.length; i++) {
    const d = snaps[i + horizon].mid - snaps[i].mid;
    X.push(features(snaps, i)); y.push(d >= thresh ? 2 : d <= -thresh ? 0 : 1); idx.push(i);
  }
  return { X, y, idx, snaps };
}

export interface Scaler { mu: number[]; sd: number[] }
export const fitScaler = (X: number[][]): Scaler => ({ mu: X[0].map((_, j) => mean(X.map((r) => r[j]))), sd: X[0].map((_, j) => std(X.map((r) => r[j])) || 1) });
export const scale = (X: number[][], s: Scaler) => X.map((r) => r.map((v, j) => (v - s.mu[j]) / s.sd[j]));

const softmax = (z: number[]) => { const m = Math.max(...z); const e = z.map((v) => Math.exp(v - m)); const s = e.reduce((a, b) => a + b, 0); return e.map((v) => v / s); };

export interface Model { name: string; proba(x: number[]): number[] }

export function trainLogistic(X: number[][], y: number[], epochs = 25, lr = 0.05, l2 = 1e-4, seed = 1): Model {
  const d = X[0].length, K = 3, rng = new Rng(seed);
  const W = Array.from({ length: K }, () => new Array(d + 1).fill(0));
  const order = X.map((_, i) => i);
  for (let e = 0; e < epochs; e++) {
    for (let i = order.length - 1; i > 0; i--) { const j = rng.int(0, i); [order[i], order[j]] = [order[j], order[i]]; }
    for (const i of order) {
      const p = softmax(W.map((w) => w[d] + w.slice(0, d).reduce((s, wv, j) => s + wv * X[i][j], 0)));
      for (let k = 0; k < K; k++) {
        const g = p[k] - (y[i] === k ? 1 : 0);
        for (let j = 0; j < d; j++) W[k][j] -= lr * (g * X[i][j] + l2 * W[k][j]);
        W[k][d] -= lr * g;
      }
    }
  }
  return { name: 'logistic regression', proba: (x) => softmax(W.map((w) => w[d] + w.slice(0, d).reduce((s, wv, j) => s + wv * x[j], 0))) };
}

export function trainMLP(X: number[][], y: number[], Xv: number[][], yv: number[], hidden = 24, epochs = 30, lr = 0.02, seed = 2): Model & { valCurve: number[] } {
  const d = X[0].length, K = 3, rng = new Rng(seed);
  const init = (n: number, s: number) => Array.from({ length: n }, () => rng.normal() * s);
  let W1 = Array.from({ length: hidden }, () => init(d, Math.sqrt(2 / d))), b1 = new Array(hidden).fill(0);
  let W2 = Array.from({ length: K }, () => init(hidden, Math.sqrt(2 / hidden))), b2 = new Array(K).fill(0);
  const fwd = (x: number[]) => {
    const h = W1.map((w, j) => Math.max(0, b1[j] + w.reduce((s, wv, i) => s + wv * x[i], 0)));
    return { h, p: softmax(W2.map((w, k) => b2[k] + w.reduce((s, wv, j) => s + wv * h[j], 0))) };
  };
  const loss = (A: number[][], t: number[]) => mean(A.map((x, i) => -Math.log(Math.max(1e-9, fwd(x).p[t[i]]))));
  const order = X.map((_, i) => i);
  let best = { v: Infinity, W1, b1, W2, b2 }, curve: number[] = [];
  const clone = <T,>(a: T): T => JSON.parse(JSON.stringify(a));
  for (let e = 0; e < epochs; e++) {
    for (let i = order.length - 1; i > 0; i--) { const j = rng.int(0, i); [order[i], order[j]] = [order[j], order[i]]; }
    for (const i of order) {
      const { h, p } = fwd(X[i]);
      const dz2 = p.map((v, k) => v - (y[i] === k ? 1 : 0));
      const dh = h.map((_, j) => (h[j] > 0 ? W2.reduce((s, w, k) => s + w[j] * dz2[k], 0) : 0));
      for (let k = 0; k < K; k++) { for (let j = 0; j < hidden; j++) W2[k][j] -= lr * dz2[k] * h[j]; b2[k] -= lr * dz2[k]; }
      for (let j = 0; j < hidden; j++) { if (dh[j] === 0) continue; for (let f = 0; f < d; f++) W1[j][f] -= lr * dh[j] * X[i][f]; b1[j] -= lr * dh[j]; }
    }
    const v = loss(Xv, yv);
    curve.push(v);
    if (v < best.v) best = { v, W1: clone(W1), b1: clone(b1), W2: clone(W2), b2: clone(b2) }; // early stopping on validation loss
  }
  ({ W1, b1, W2, b2 } = best);
  return { name: 'MLP (1 hidden layer, early-stopped)', proba: (x) => fwd(x).p, valCurve: curve };
}

/* ---------------- evaluation ---------------- */
export interface ClsMetrics { accuracy: number; macroF1: number; confusion: number[][]; classBalance: number[] }
export function classMetrics(y: number[], pred: number[]): ClsMetrics {
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  y.forEach((t, i) => C[t][pred[i]]++);
  const f1 = [0, 1, 2].map((k) => { const tp = C[k][k], fp = C.reduce((s, r, i) => s + (i !== k ? r[k] : 0), 0), fn = C[k].reduce((s, v, j) => s + (j !== k ? v : 0), 0); return tp === 0 ? 0 : (2 * tp) / (2 * tp + fp + fn); });
  return { accuracy: y.filter((t, i) => t === pred[i]).length / y.length, macroF1: mean(f1), confusion: C, classBalance: [0, 1, 2].map((k) => y.filter((t) => t === k).length / y.length) };
}

export interface TradeSim { trades: number; grossTicksPerTrade: number; netTicksPerTrade: number; hitRate: number; totalNetTicks: number; sharpeLike: number; tStat: number; pValue: number; significantlyProfitable: boolean }
/**
 * Cost-aware test: when the model is confident, cross the spread to enter and cross it again to exit after `horizon` steps.
 * Gross = mid-to-mid move; net also pays the full spread at entry and exit (and a per-side fee in ticks).
 */
export function tradeSim(ds: Dataset, signal: (row: number) => 0 | 1 | -1, horizon: number, feeTicks = 0.1): TradeSim {
  const net: number[] = [], gross: number[] = [];
  let nextFree = 0;
  ds.idx.forEach((i, r) => {
    if (i < nextFree) return;
    const s = signal(r);
    if (!s) return;
    const e = ds.snaps[i], x = ds.snaps[i + horizon];
    const g = s * (x.mid - e.mid);
    const cost = e.spread / 2 + x.spread / 2 + 2 * feeTicks;
    gross.push(g); net.push(g - cost);
    nextFree = i + horizon; // no overlapping positions
  });
  const t = net.length > 1 && std(net) ? mean(net) / (std(net) / Math.sqrt(net.length)) : 0;
  const p = 1 - normCdf(t); // one-sided: is the mean net P&L > 0?
  return { trades: net.length, grossTicksPerTrade: mean(gross), netTicksPerTrade: mean(net), hitRate: net.length ? net.filter((v) => v > 0).length / net.length : 0, totalNetTicks: net.reduce((a, b) => a + b, 0), sharpeLike: std(net) ? mean(net) / std(net) * Math.sqrt(net.length) : 0, tStat: t, pValue: net.length > 1 ? p : 1, significantlyProfitable: net.length >= 30 && p < 0.05 };
}

export interface LobStudy {
  horizon: number; thresh: number; sizes: { train: number; val: number; test: number };
  models: { name: string; cls: ClsMetrics; trading: TradeSim; tradingConfident: TradeSim }[];
  valCurve: number[];
  featureImportance: { feature: string; dropInF1: number }[];
  verdict: string;
}
export function lobStudy(opts: { steps?: number; horizon?: number; thresh?: number; seeds?: [number, number, number] } = {}): LobStudy {
  const { steps = 4000, horizon = 10, thresh = 2, seeds = [101, 202, 303] } = opts;
  const tr = makeDataset(seeds[0], steps, horizon, thresh), va = makeDataset(seeds[1], Math.floor(steps / 2), horizon, thresh), te = makeDataset(seeds[2], steps, horizon, thresh);
  const sc = fitScaler(tr.X);
  const Xtr = scale(tr.X, sc), Xva = scale(va.X, sc), Xte = scale(te.X, sc);
  const log = trainLogistic(Xtr, tr.y), mlp = trainMLP(Xtr, tr.y, Xva, va.y);
  const majority = [0, 1, 2].sort((a, b) => tr.y.filter((v) => v === b).length - tr.y.filter((v) => v === a).length)[0];
  const argmax = (p: number[]) => p.indexOf(Math.max(...p));
  const cands: { name: string; pred: number[]; sig: (r: number) => 0 | 1 | -1; sigC: (r: number) => 0 | 1 | -1 }[] = [
    { name: 'majority class (baseline)', pred: te.y.map(() => majority), sig: () => 0, sigC: () => 0 },
    { name: 'top-of-book imbalance rule', pred: te.X.map((x) => (x[0] > 0.3 ? 2 : x[0] < -0.3 ? 0 : 1)), sig: (r) => (te.X[r][0] > 0.3 ? 1 : te.X[r][0] < -0.3 ? -1 : 0), sigC: (r) => (te.X[r][0] > 0.6 ? 1 : te.X[r][0] < -0.6 ? -1 : 0) },
  ];
  for (const m of [log, mlp]) {
    const P = Xte.map((x) => m.proba(x));
    cands.push({ name: m.name, pred: P.map(argmax), sig: (r) => (argmax(P[r]) === 2 ? 1 : argmax(P[r]) === 0 ? -1 : 0), sigC: (r) => (P[r][2] > 0.6 ? 1 : P[r][0] > 0.6 ? -1 : 0) });
  }
  const models = cands.map((c) => ({ name: c.name, cls: classMetrics(te.y, c.pred), trading: tradeSim(te, c.sig, horizon), tradingConfident: tradeSim(te, c.sigC, horizon) }));
  // permutation feature importance on the MLP (test set)
  const base = classMetrics(te.y, Xte.map((x) => argmax(mlp.proba(x)))).macroF1;
  const rng = new Rng(9);
  const imp = FEATURES.map((f, j) => {
    const col = Xte.map((r) => r[j]);
    for (let i = col.length - 1; i > 0; i--) { const k = rng.int(0, i); [col[i], col[k]] = [col[k], col[i]]; }
    const Xp = Xte.map((r, i) => r.map((v, jj) => (jj === j ? col[i] : v)));
    return { feature: f, dropInF1: base - classMetrics(te.y, Xp.map((x) => argmax(mlp.proba(x)))).macroF1 };
  }).sort((a, b) => b.dropInF1 - a.dropInF1);
  const best = models.slice(2).sort((a, b) => b.cls.macroF1 - a.cls.macroF1)[0];
  const profitable = models.some((m) => m.trading.significantlyProfitable || m.tradingConfident.significantlyProfitable);
  const anyPositive = models.some((m) => m.trading.netTicksPerTrade > 0 || m.tradingConfident.netTicksPerTrade > 0);
  return {
    horizon, thresh, sizes: { train: tr.X.length, val: va.X.length, test: te.X.length }, models, valCurve: mlp.valCurve, featureImportance: imp,
    verdict: `${best.name} reaches macro-F1 ${best.cls.macroF1.toFixed(2)} vs ${models[0].cls.macroF1.toFixed(2)} for the majority baseline, but ${profitable ? 'at least one configuration is statistically significantly profitable after paying the spread' : anyPositive ? 'although some configurations show positive average net P&L, none is statistically distinguishable from zero (small trade counts, p >= 0.05 or < 30 trades)' : 'NO configuration is profitable after paying the spread on both entry and exit'}. Predicting direction is not the same as making money; execution cost decides it.`,
  };
}
