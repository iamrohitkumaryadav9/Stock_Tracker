import { describe, it, expect } from 'vitest';
import { demoMarket } from '@/lab/data/synthetic';
import { buildPit } from '@/lab/pit/load';
import { backtest, ZERO_COSTS, DEFAULT_COSTS } from '@/lab/eval/backtest';
import { buyAndHold, momentum, pead, leakyPeek } from '@/lab/eval/strategies';
import { leakTest, strategyStudy, neuteringTest, neuterContext } from '@/lab/eval/validate';
import { makeCtx } from '@/lab/eval/backtest';
import { barKnownAt } from '@/lab/data/types';
import { deflatedSharpe, probabilityOfBacktestOverfitting, probabilisticSharpe } from '@/lab/eval/stats';
import { DecisionLog, MemoryLogStore } from '@/lab/eval/decisionlog';
import { Rng } from '@/lab/core/util';

const md = demoMarket();
const pit = buildPit(md);

describe('backtester', () => {
  it('trades at next open and costs reduce returns', () => {
    const free = backtest(pit, 'NWSC', momentum(40)(pit), { costs: ZERO_COSTS });
    const paid = backtest(pit, 'NWSC', momentum(40)(pit), { costs: DEFAULT_COSTS });
    expect(paid.metrics.totalReturn).toBeLessThan(free.metrics.totalReturn);
    expect(paid.metrics.costDragBps).toBeGreaterThan(0);
    // every trade date is strictly after its decision date
    expect(free.trades.every((t, i) => t.t > free.decisions[0].t)).toBe(true);
  });
  it('buy & hold tracks the asset', () => {
    const r = backtest(pit, 'HLGD', buyAndHold(pit), { costs: ZERO_COSTS });
    const bars = md.bars.HLGD;
    const first = bars[31].o, last = bars[bars.length - 1].c;
    expect(Math.abs(r.metrics.totalReturn - (last / first - 1))).toBeLessThan(0.05);
  });
});

describe('leak detector', () => {
  it('passes honest strategies', () => {
    for (const make of [momentum(40), pead(15)]) {
      const rep = leakTest(make, pit, 'NWSC');
      expect(rep.violations, rep.strategy).toBe(0);
    }
  });
  it('catches a strategy that peeks at the future, which also looks spectacular in a naive backtest', () => {
    const rep = leakTest(leakyPeek, pit, 'NWSC');
    expect(rep.leaky).toBe(true);
    const bt = backtest(pit, 'NWSC', leakyPeek(pit), { costs: ZERO_COSTS });
    expect(bt.metrics.sharpe).toBeGreaterThan(3); // too good to be true
  });
});

describe('strategy study (DSR, PBO, walk-forward)', () => {
  it('produces a coherent verdict', () => {
    const s = strategyStudy(pit, 'NWSC');
    console.log(JSON.stringify({ best: s.best, pbo: s.pbo.pbo, wf: [s.walkForward.oosSharpe, s.walkForward.meanIsSharpe], verdict: s.verdict }, null, 1));
    expect(s.nTrials).toBeGreaterThan(15);
    expect(s.best.dsr).toBeGreaterThanOrEqual(0);
    expect(s.best.dsr).toBeLessThanOrEqual(1);
    expect(s.walkForward.folds.length).toBeGreaterThan(3);
  });
  it('DSR falls as more trials are tried; PBO is high for pure-noise strategies', () => {
    const rng = new Rng(3);
    const noise = (n: number, k: number) => Array.from({ length: n }, () => Array.from({ length: k }, () => 0.01 * rng.normal()));
    const M = noise(800, 40);
    const col = (k: number) => M.map((r) => r[k]);
    const shs = Array.from({ length: 40 }, (_, k) => { const c = col(k); return c.reduce((a, b) => a + b, 0) / c.length / (Math.sqrt(c.reduce((a, b) => a + b * b, 0) / c.length) || 1); });
    const best = shs.indexOf(Math.max(...shs));
    const few = deflatedSharpe(col(best), shs.slice(0, 3));
    const many = deflatedSharpe(col(best), shs);
    expect(many.dsr).toBeLessThanOrEqual(few.dsr + 1e-9);
    expect(many.dsr).toBeLessThan(0.95);
    const pbo = probabilityOfBacktestOverfitting(M);
    expect(pbo.pbo).toBeGreaterThan(0.3);
    expect(probabilisticSharpe(col(best))).toBeGreaterThan(0);
  });
});

describe('neutering', () => {
  it('masks tickers, names, dates and absolute price level', () => {
    const asOf = barKnownAt(md.bars.NWSC[400].t);
    const ctx = makeCtx(pit, 'NWSC', asOf);
    const n = neuterContext(ctx, ['Northwind Semiconductors']);
    expect(n.ticker).toBe('COMPANY_X');
    expect(n.bars[0].c).toBeCloseTo(100, 5);
    expect(JSON.stringify(n.filings)).not.toMatch(/NWSC|Northwind|20\d\d-\d\d-\d\d|20\d\dQ\d/);
    expect(n.filings[1].text).toMatch(/\$1,9\d\d\.\d million/); // dollar amounts must survive masking
    const r = neuteringTest((c) => (c.bars.length > 5 ? 1 : 0), [ctx]);
    expect(r.changeRate).toBe(0);
  });
});

describe('decision log', () => {
  it('chains, resolves once, and detects tampering', async () => {
    const store = new MemoryLogStore();
    const log = new DecisionLog(store);
    const d = await log.decide('agent-v1', 'NWSC', 1000, { weight: 1 }, 1);
    await log.resolve(d.seq, { forwardReturn: 0.02 }, 2000, 2);
    await expect(log.resolve(d.seq, { forwardReturn: 0.1 }, 3000)).rejects.toThrow(/already resolved/);
    expect((await log.verify()).ok).toBe(true);
    store.rows[0].payload.weight = -1; // rewrite history
    expect((await log.verify()).ok).toBe(false);
  });
});
