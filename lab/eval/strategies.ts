import type { Strategy, StrategyCtx } from './backtest';
import type { PitUniverse } from '@/lab/pit/load';
import { mean, std } from '@/lab/core/util';
import { DAY } from '@/lab/data/types';

export type StrategyFactory = (u: PitUniverse) => Strategy;

export const buyAndHold: StrategyFactory = () => ({ name: 'buy & hold', decide: () => 1 });

export const momentum = (lookback = 60, hold = 1): StrategyFactory => () => ({
  name: `momentum(${lookback})`,
  decide: (c) => {
    if (c.bars.length <= lookback) return 0;
    const r = c.bars[c.bars.length - 1].c / c.bars[c.bars.length - 1 - lookback].c - 1;
    return r > 0 ? hold : 0;
  },
});

export const meanReversion = (window = 20, z = 1.5): StrategyFactory => () => ({
  name: `mean-reversion(${window},${z})`,
  decide: (c) => {
    if (c.bars.length < window + 1) return 0;
    const px = c.bars.slice(-window).map((b) => b.c);
    const zs = (px[px.length - 1] - mean(px)) / (std(px) || 1);
    return zs < -z ? 1 : zs > z ? -1 : c.position * 0.5;
  },
});

/** Post-earnings-announcement drift: hold long for `hold` days after a revenue-growth surprise. Uses only filings visible at decision time. */
export const pead = (hold = 15, threshold = 0.0): StrategyFactory => () => ({
  name: `PEAD(${hold}d,>${threshold})`,
  decide: (c: StrategyCtx) => {
    const f = c.filings;
    if (f.length < 3) return 0;
    const last = f[f.length - 1];
    const growth = (i: number) => (f[i].facts.revenue ?? 0) / (f[i - 1].facts.revenue ?? 1) - 1;
    const surprise = growth(f.length - 1) - mean([growth(f.length - 2), f.length > 3 ? growth(f.length - 3) : growth(f.length - 2)]);
    const age = (c.asOf - last.filedAt) / DAY;
    return surprise > threshold && age >= 0 && age < hold ? 1 : surprise < -threshold && age >= 0 && age < hold ? -0.5 : 0;
  },
});

/**
 * A deliberately LEAKY strategy for demonstrating the leak detector: it reads tomorrow's bar straight from the
 * raw store, which a real strategy must never be able to do. The backtest will look spectacular; the
 * temporal non-interference test flags it immediately.
 */
export const leakyPeek: StrategyFactory = (u) => ({
  name: 'LEAKY: peeks at next close',
  decide: (c) => {
    const raw = u.bars.rawAll(c.ticker);
    const i = raw.findIndex((r) => r.validAt === c.bars[c.bars.length - 1].t);
    const nxt = raw[i + 1]?.value;
    return nxt ? (nxt.c > c.bars[c.bars.length - 1].c ? 1 : -1) : 0;
  },
});

/** The family searched in walk-forward / DSR / PBO studies. */
export function strategyGrid(): { id: string; make: StrategyFactory }[] {
  const out: { id: string; make: StrategyFactory }[] = [];
  for (const lb of [10, 20, 40, 60, 90, 120]) out.push({ id: `momentum(${lb})`, make: momentum(lb) });
  for (const w of [10, 20, 40]) for (const z of [1, 1.5, 2]) out.push({ id: `meanrev(${w},${z})`, make: meanReversion(w, z) });
  for (const h of [5, 10, 15, 25]) for (const th of [0, 0.01]) out.push({ id: `pead(${h},${th})`, make: pead(h, th) });
  return out;
}
