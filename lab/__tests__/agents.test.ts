import { describe, it, expect } from 'vitest';
import { demoMarket } from '@/lab/data/synthetic';
import { buildPit } from '@/lab/pit/load';
import { makeCtx, backtest, ZERO_COSTS } from '@/lab/eval/backtest';
import { leakTest, neuteringTest } from '@/lab/eval/validate';
import { runTeam, teamStrategy, narrate, templateNarrative } from '@/lab/ai/agents';
import { AgentMemory } from '@/lab/ai/memory';
import { analyzeJournal, closeLots, type JTrade } from '@/lab/ai/journal-bias';
import { barKnownAt } from '@/lab/data/types';
import { Rng } from '@/lab/core/util';

const md = demoMarket();
const pit = buildPit(md);

describe('agent team', () => {
  it('produces a structured, risk-gated decision with a debate transcript', () => {
    const ctx = makeCtx(pit, 'NWSC', barKnownAt(md.bars.NWSC[420].t));
    const d = runTeam(ctx, { memory: new AgentMemory() });
    expect(d.analysts).toHaveLength(3);
    expect(Math.abs(d.weight)).toBeLessThanOrEqual(Math.abs(d.proposedWeight) + 1e-9);
    expect(d.debate.length).toBeGreaterThan(0);
    expect(templateNarrative(d)).toMatch(/Position:/);
  });
  it('is leak-free (temporal non-interference) and invariant to entity neutering', () => {
    const rep = leakTest(() => teamStrategy(), pit, 'NWSC', 12, 2);
    expect(rep.violations).toBe(0);
    const ctxs = [300, 420, 520, 640].map((i) => makeCtx(pit, 'NWSC', barKnownAt(md.bars.NWSC[i].t)));
    const r = neuteringTest((c) => runTeam(c).weight, ctxs, ['Northwind Semiconductors']);
    expect(r.changeRate).toBe(0);
  });
  it('risk gate caps size by volatility', () => {
    const ctx = makeCtx(pit, 'NWSC', barKnownAt(md.bars.NWSC[500].t));
    const d = runTeam(ctx, { targetVol: 0.02 });
    expect(Math.abs(d.weight)).toBeLessThanOrEqual(0.2);
  });
  it('can be backtested through the same engine', () => {
    const r = backtest(pit, 'ASTH', teamStrategy(), { costs: ZERO_COSTS });
    expect(r.metrics.days).toBeGreaterThan(500);
    expect(Number.isFinite(r.metrics.sharpe)).toBe(true);
  });
  it('LLM narrative with unsupported numbers is rejected', async () => {
    const d = runTeam(makeCtx(pit, 'NWSC', barKnownAt(md.bars.NWSC[420].t)));
    const liar = { name: 'liar', complete: async () => 'Revenue will hit 98765 and 55555 and 77777 next year.' };
    const out = await narrate(d, liar);
    expect(out.source).toMatch(/rejected/);
  });
});

describe('agent memory', () => {
  it('cannot retrieve the future and learns from costly mistakes', () => {
    const m = new AgentMemory();
    const d = m.add({ ts: 100, ticker: 'X', kind: 'decision', text: 'technical bullish momentum', importance: 0.4, analyst: 'technical', signal: 0.8 });
    expect(m.retrieve('technical bullish', 50, 'X')).toHaveLength(0);
    const lesson = m.reflect(d.id, -0.08, 200);
    expect(lesson).not.toBeNull();
    expect(m.retrieve('technical bullish', 150, 'X').every((r) => !r.m.outcome)).toBe(true); // outcome not known yet at t=150
    expect(m.reliability('technical', 300)).toBeLessThan(0.5);
  });
});

describe('journal bias mining', () => {
  const mk = (disposition: boolean): JTrade[] => {
    const rng = new Rng(8);
    const t: JTrade[] = [];
    let ts = Date.UTC(2025, 0, 1), id = 0;
    for (let i = 0; i < 40; i++) {
      const win = rng.bool(0.5);
      const hold = disposition ? (win ? rng.int(1, 4) : rng.int(12, 30)) : rng.int(3, 10);
      const entry = 100, exit = win ? 100 * (1 + 0.03 + 0.01 * rng.next()) : 100 * (1 - 0.06 - 0.02 * rng.next());
      t.push({ id: `b${++id}`, ts, symbol: 'S' + (i % 5), side: 'buy', qty: 10, price: entry });
      ts += hold * 86400e3;
      t.push({ id: `s${id}`, ts, symbol: 'S' + (i % 5), side: 'sell', qty: 10, price: exit });
      ts += 86400e3;
    }
    return t;
  };
  it('detects the disposition effect when present, and not when absent', () => {
    const bad = analyzeJournal(mk(true));
    const good = analyzeJournal(mk(false));
    const dBad = bad.findings.find((f) => f.bias.startsWith('Disposition'))!;
    const dGood = good.findings.find((f) => f.bias.startsWith('Disposition'))!;
    expect(dBad.detected).toBe(true);
    expect(dBad.p!).toBeLessThan(0.01);
    expect(dGood.detected).toBe(false);
    expect(bad.findings.find((f) => f.bias.startsWith('Negative payoff'))!.detected).toBe(true);
  });
  it('refuses to opine on tiny samples; FIFO matching is correct', () => {
    expect(analyzeJournal(mk(true).slice(0, 8)).findings).toHaveLength(0);
    const lots = closeLots([
      { id: '1', ts: 0, symbol: 'A', side: 'buy', qty: 10, price: 10 }, { id: '2', ts: 1, symbol: 'A', side: 'buy', qty: 10, price: 20 },
      { id: '3', ts: 2e8, symbol: 'A', side: 'sell', qty: 15, price: 30 },
    ]);
    expect(lots.map((l) => [l.qty, l.entry])).toEqual([[10, 10], [5, 20]]);
  });
});
