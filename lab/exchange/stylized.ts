import { autocorr, kurtosis, mean, std } from '@/lab/core/util';
import type { Simulation } from './simulator';

/**
 * Realism checks. A simulator that cannot reproduce the basic empirical regularities of real markets
 * ("stylised facts") should not be trusted to train or evaluate trading models. Each check compares the
 * simulated statistic with the range reported for real equity markets.
 */
export interface Fact {
  name: string;
  value: number;
  expected: string;
  pass: boolean;
  why: string;
}

export function stylizedFacts(sim: Simulation): Fact[] {
  const mids = sim.mids();
  const rets: number[] = [];
  for (let i = 1; i < mids.length; i++) rets.push(Math.log(mids[i] / mids[i - 1]));
  const agg = (k: number) => {
    const o: number[] = [];
    for (let i = k; i < mids.length; i += k) o.push(Math.log(mids[i] / mids[i - k]));
    return o;
  };
  const r10 = agg(10);
  const absR = rets.map(Math.abs);
  // trade-sign autocorrelation (order-flow persistence)
  const signs = sim.fills.map((f) => (f.side === 'buy' ? 1 : -1));
  const spreads = sim.snapshots.map((s) => s.spread);

  const facts: Fact[] = [];
  const k = kurtosis(r10);
  facts.push({ name: 'Fat tails (excess kurtosis of 10-step returns)', value: k - 3, expected: '> 0', pass: k - 3 > 0, why: 'Real returns are leptokurtic; Gaussian simulators give ~0.' });
  const vc = autocorr(absR, 1);
  facts.push({ name: 'Volatility clustering (autocorr of |returns|)', value: vc, expected: '> 0.05', pass: vc > 0.05, why: 'Large moves follow large moves in real markets.' });
  const ra = autocorr(rets, 1);
  facts.push({ name: 'No linear return predictability (|autocorr| of returns)', value: ra, expected: '|x| < 0.35 (microstructure bounce allowed)', pass: Math.abs(ra) < 0.35, why: 'Raw returns are nearly uncorrelated beyond bid-ask bounce.' });
  const sa = autocorr(signs, 1);
  facts.push({ name: 'Order-flow sign persistence (autocorr of trade signs)', value: sa, expected: '> 0', pass: sa > 0, why: 'Real order flow is long-memory (meta-orders are split).' });
  const sp = mean(spreads);
  facts.push({ name: 'Positive, stable spread (mean ticks)', value: sp, expected: '1 - 20', pass: sp >= 1 && sp <= 20, why: 'Spreads are small but positive.' });
  const spCv = std(spreads) / Math.max(1e-9, sp);
  facts.push({ name: 'Spread variability (coefficient of variation)', value: spCv, expected: '> 0.05', pass: spCv > 0.05, why: 'Spreads widen in stress; a constant spread is an unrealistic simulator.' });
  const depthImb = sim.snapshots.map((s) => (s.bidQty[0] - s.askQty[0]) / Math.max(1, s.bidQty[0] + s.askQty[0]));
  const nextRet = sim.snapshots.slice(1).map((s, i) => s.mid - sim.snapshots[i].mid);
  const ic = corr(depthImb.slice(0, -1), nextRet);
  facts.push({ name: 'Order-book imbalance predicts next move (corr)', value: ic, expected: '> 0', pass: ic > 0, why: 'In real LOBs, top-of-book imbalance has positive predictive power at short horizons.' });
  return facts;
}

export function corr(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const ma = mean(a.slice(0, n)), mb = mean(b.slice(0, n));
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da === 0 || db === 0 ? 0 : num / Math.sqrt(da * db);
}
