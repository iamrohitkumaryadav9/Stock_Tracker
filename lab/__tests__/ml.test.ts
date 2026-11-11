import { describe, it, expect } from 'vitest';
import { lobStudy } from '@/lab/ml/lob';
import { executionStudy, marketMakingStudy } from '@/lab/ml/execution';

describe('LOB ML', () => {
  it('beats the majority baseline on F1 and reports honest, cost-aware trading results', () => {
    const t0 = Date.now();
    const s = lobStudy({ steps: 2500 });
    console.log(`LOB study ${Date.now() - t0}ms`, JSON.stringify(s.models.map((m) => ({ n: m.name, f1: +m.cls.macroF1.toFixed(3), acc: +m.cls.accuracy.toFixed(3), net: +m.trading.netTicksPerTrade.toFixed(3), gross: +m.trading.grossTicksPerTrade.toFixed(3), trades: m.trading.trades, netConf: +m.tradingConfident.netTicksPerTrade.toFixed(3), tradesConf: m.tradingConfident.trades })), null, 1), s.featureImportance.slice(0, 4), s.verdict);
    expect(s.models[2].cls.macroF1).toBeGreaterThan(s.models[0].cls.macroF1);
    expect(s.sizes.test).toBeGreaterThan(1000);
  }, 120000);
});

describe('execution RL', () => {
  it('runs and compares against TWAP with a significance test', () => {
    const t0 = Date.now();
    const s = executionStudy({ trainEpisodes: 120, testEpisodes: 30 });
    console.log(`exec study ${Date.now() - t0}ms`, JSON.stringify({ results: s.results, vsTwap: s.vsTwap, policy: s.policySummary }, null, 1));
    expect(s.results).toHaveLength(4);
    expect(Number.isFinite(s.vsTwap.p)).toBe(true);
  }, 240000);
  it('market-making skew study returns stats', () => {
    const r = marketMakingStudy({ seeds: 4, steps: 500 });
    console.log(JSON.stringify(r.map((x) => ({ l: x.label, pnl: Math.round(x.meanPnl), inv: +x.meanAbsInventory.toFixed(1) }))));
    expect(r).toHaveLength(4);
  }, 120000);
});
