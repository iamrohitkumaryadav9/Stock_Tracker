import { PitStore } from '@/lab/pit/store';
import type { PitUniverse } from '@/lab/pit/load';
import { barKnownAt, type Bar, type Filing, type NewsItem } from '@/lab/data/types';
import { backtest, makeCtx, DEFAULT_COSTS, type CostModel, type StrategyCtx } from './backtest';
import { strategyGrid, type StrategyFactory } from './strategies';
import { bootstrapSharpeCI, deflatedSharpe, probabilityOfBacktestOverfitting, probabilisticSharpe, sharpe } from './stats';
import { Rng, mean, std } from '@/lab/core/util';

/* ============ 1. Temporal non-interference ("leak") test ============ */
/**
 * Property: a decision made at time t must be a function only of information known at t.
 * Test: replace EVERYTHING that becomes known after t with random garbage and rebuild the strategy from the
 * corrupted universe. If any decision changes, the strategy (or its data plumbing) uses the future.
 */
function perturb(u: PitUniverse, asOf: number, seed: number): PitUniverse {
  const rng = new Rng(seed);
  const bars = new PitStore<Bar>(), filings = new PitStore<Filing>(), news = new PitStore<NewsItem>();
  for (const k of u.bars.keys()) for (const r of u.bars.rawAll(k)) {
    const f = r.knownAt > asOf ? 0.5 + rng.next() * 1.5 : 1;
    const v = r.value;
    bars.put({ ...r, value: { ...v, o: v.o * f, h: v.h * f, l: v.l * f, c: v.c * f * (r.knownAt > asOf ? 0.9 + rng.next() * 0.2 : 1), v: v.v } });
  }
  for (const k of u.filings.keys()) for (const r of u.filings.rawAll(k)) {
    if (r.knownAt <= asOf) { filings.put(r); continue; }
    const facts = Object.fromEntries(Object.entries(r.value.facts).map(([a, b]) => [a, b * (0.3 + rng.next() * 2)]));
    filings.put({ ...r, value: { ...r.value, facts, text: 'REDACTED-FUTURE ' + rng.int(0, 1e9) } });
  }
  for (const k of u.news.keys()) for (const r of u.news.rawAll(k)) news.put(r.knownAt <= asOf ? r : { ...r, value: { ...r.value, headline: 'future ' + rng.int(0, 1e9), body: '' } });
  return { bars, filings, news };
}

export interface LeakReport {
  strategy: string;
  checks: number;
  violations: number;
  leaky: boolean;
  examples: { asOf: string; original: number; withCorruptedFuture: number }[];
}
export function leakTest(make: StrategyFactory, universe: PitUniverse, ticker: string, samples = 14, perturbations = 2, seed = 7): LeakReport {
  const rng = new Rng(seed);
  const all = universe.bars.rawAll(ticker).map((r) => r.value);
  const real = make(universe);
  let violations = 0, checks = 0;
  const examples: LeakReport['examples'] = [];
  for (let s = 0; s < samples; s++) {
    const i = rng.int(40, all.length - 3);
    const asOf = barKnownAt(all[i].t);
    const base = real.decide(makeCtx(universe, ticker, asOf, 0));
    for (let p = 0; p < perturbations; p++) {
      const u2 = perturb(universe, asOf, seed * 100 + s * 10 + p);
      const alt = make(u2).decide(makeCtx(u2, ticker, asOf, 0));
      checks++;
      if (Math.abs(alt - base) > 1e-9) {
        violations++;
        if (examples.length < 3) examples.push({ asOf: new Date(asOf).toISOString().slice(0, 10), original: base, withCorruptedFuture: alt });
      }
    }
  }
  return { strategy: real.name, checks, violations, leaky: violations > 0, examples };
}

/* ============ 2. Entity neutering (memorisation probe for LLM-based deciders) ============ */
export function neuterContext(ctx: StrategyCtx, names: string[] = []): StrategyCtx {
  const base = ctx.bars.length ? ctx.bars[0].c : 1;
  const mask = (s: string) => {
    let o = s.replace(new RegExp(ctx.ticker, 'g'), 'COMPANY_X');
    for (const n of names) o = o.split(n).join('COMPANY_X');
    // Mask only things that are unambiguously dates: ISO dates, fiscal-period codes, and years that follow a date cue.
    // (A bare 4-digit number can be a dollar amount, so it is left alone.)
    return o
      .replace(/\b\d{4}-\d{2}-\d{2}\b/g, 'DATE')
      .replace(/\b(19|20)\d{2}Q[1-4]\b/g, 'PERIOD')
      .replace(/\b(FY|fiscal |year |ended |ending |in |of )((19|20)\d{2})\b/gi, '$1YYYY');
  };
  const t0 = ctx.bars.length ? ctx.bars[0].t : 0;
  const shiftT = (t: number) => t - t0;
  return {
    ...ctx, ticker: 'COMPANY_X', asOf: shiftT(ctx.asOf),
    bars: ctx.bars.map((b) => ({ t: shiftT(b.t), o: (b.o / base) * 100, h: (b.h / base) * 100, l: (b.l / base) * 100, c: (b.c / base) * 100, v: b.v })),
    filings: ctx.filings.map((f, i) => ({ ...f, id: `F${i}`, restates: f.restates ? 'F?' : undefined, ticker: 'COMPANY_X', company: 'COMPANY_X', text: mask(f.text), filedAt: shiftT(f.filedAt), periodEnd: shiftT(f.periodEnd), period: 'PERIOD', url: undefined })),
    news: ctx.news.map((n, i) => ({ ...n, id: `N${i}`, ticker: 'COMPANY_X', headline: mask(n.headline), body: mask(n.body), publishedAt: shiftT(n.publishedAt) })),
  };
}
/**
 * If an agent decides differently once names, dates and absolute price levels are masked, it was relying on
 * something other than the information in front of it (e.g. memorised history). Returns the change rate.
 */
export function neuteringTest(decide: (c: StrategyCtx) => number, ctxs: StrategyCtx[], names: string[] = []) {
  let changed = 0;
  for (const c of ctxs) if (Math.abs(decide(c) - decide(neuterContext(c, names))) > 1e-9) changed++;
  return { checks: ctxs.length, changed, changeRate: ctxs.length ? changed / ctxs.length : 0 };
}

/* ============ 3. Strategy search study: walk-forward, DSR, PBO ============ */
export interface GridRun { ids: string[]; M: number[][]; dates: number[]; sharpes: number[] }
export function runGrid(universe: PitUniverse, ticker: string, grid: { id: string; make: StrategyFactory }[], costs: CostModel = DEFAULT_COSTS): GridRun {
  const results = grid.map((g) => backtest(universe, ticker, g.make(universe), { costs }));
  const T = Math.min(...results.map((r) => r.returns.length));
  const M = Array.from({ length: T }, (_, t) => results.map((r) => r.returns[t]));
  return { ids: grid.map((g) => g.id), M, dates: results[0].dates.slice(0, T), sharpes: results.map((r) => sharpe(r.returns.slice(0, T))) };
}

export interface WalkForward {
  folds: { train: [string, string]; test: [string, string]; chosen: string; isSharpe: number; oosSharpe: number }[];
  oosSharpe: number;
  meanIsSharpe: number;
  degradation: number; // meanIS - OOS
}
export function walkForward(g: GridRun, train = 252, test = 63): WalkForward {
  const folds: WalkForward['folds'] = [];
  const oos: number[] = [];
  const iso = (t: number) => new Date(g.dates[t]).toISOString().slice(0, 10);
  for (let s = 0; s + train + test <= g.M.length; s += test) {
    const col = (k: number, a: number, b: number) => g.M.slice(a, b).map((row) => row[k]);
    let best = 0, bestS = -Infinity;
    for (let k = 0; k < g.ids.length; k++) { const sh = sharpe(col(k, s, s + train)); if (sh > bestS) { bestS = sh; best = k; } }
    const o = col(best, s + train, s + train + test);
    oos.push(...o);
    folds.push({ train: [iso(s), iso(s + train - 1)], test: [iso(s + train), iso(s + train + test - 1)], chosen: g.ids[best], isSharpe: bestS, oosSharpe: sharpe(o) });
  }
  const mIs = mean(folds.map((f) => f.isSharpe));
  return { folds, oosSharpe: sharpe(oos), meanIsSharpe: mIs, degradation: mIs - sharpe(oos) };
}

export interface Study {
  ticker: string;
  nTrials: number;
  best: { id: string; sharpe: number; psr: number; dsr: number; sr0Annual: number; ci: { lo: number; hi: number }; costDragNote: string };
  pbo: ReturnType<typeof probabilityOfBacktestOverfitting>;
  walkForward: WalkForward;
  leaderboard: { id: string; sharpe: number }[];
  verdict: { level: 'pass' | 'warn' | 'fail'; reasons: string[] };
}
export function strategyStudy(universe: PitUniverse, ticker: string, costs: CostModel = DEFAULT_COSTS): Study {
  const grid = strategyGrid();
  const g = runGrid(universe, ticker, grid, costs);
  const bi = g.sharpes.indexOf(Math.max(...g.sharpes));
  const series = g.M.map((r) => r[bi]);
  const perPeriodSharpes = g.ids.map((_, k) => mean(g.M.map((r) => r[k])) / (std(g.M.map((r) => r[k])) || 1e-12));
  const d = deflatedSharpe(series, perPeriodSharpes);
  const pbo = probabilityOfBacktestOverfitting(g.M);
  const wf = walkForward(g);
  const reasons: string[] = [];
  let level: Study['verdict']['level'] = 'pass';
  const warn = (m: string) => { reasons.push(m); if (level === 'pass') level = 'warn'; };
  const fail = (m: string) => { reasons.push(m); level = 'fail'; };
  if (d.dsr < 0.95) (d.dsr < 0.5 ? fail : warn)(`Deflated Sharpe ${d.dsr.toFixed(2)} (<0.95): after accounting for ${g.ids.length} trials, the best Sharpe is not clearly distinguishable from luck.`);
  if (pbo.pbo > 0.5) fail(`PBO ${(pbo.pbo * 100).toFixed(0)}%: the in-sample winner usually ranks below median out-of-sample.`);
  else if (pbo.pbo > 0.25) warn(`PBO ${(pbo.pbo * 100).toFixed(0)}% is elevated.`);
  if (wf.oosSharpe < 0) fail(`Walk-forward out-of-sample Sharpe is negative (${wf.oosSharpe.toFixed(2)}).`);
  else if (wf.degradation > 0.75) warn(`Large in-sample to out-of-sample Sharpe drop (${wf.degradation.toFixed(2)}).`);
  if (!reasons.length) reasons.push('Survives deflation, overfitting probability and walk-forward checks on this sample. Still synthetic or single-asset evidence, so not proof of an edge.');
  return {
    ticker, nTrials: g.ids.length,
    best: { id: g.ids[bi], sharpe: g.sharpes[bi], psr: probabilisticSharpe(series), dsr: d.dsr, sr0Annual: d.sr0 * Math.sqrt(252), ci: bootstrapSharpeCI(series), costDragNote: 'returns are net of commission, spread, impact and borrow' },
    pbo, walkForward: wf,
    leaderboard: g.ids.map((id, k) => ({ id, sharpe: g.sharpes[k] })).sort((a, b) => b.sharpe - a.sharpe),
    verdict: { level, reasons },
  };
}
