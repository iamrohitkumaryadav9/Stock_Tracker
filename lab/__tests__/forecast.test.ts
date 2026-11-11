import { describe, it, expect } from 'vitest';
import { evaluateForecasters } from '@/lab/ai/forecast';
import { demoMarket } from '@/lab/data/synthetic';
import { Rng } from '@/lab/core/util';

describe('forecasting', () => {
  it('conformal intervals reach near-nominal coverage on volatility-clustered data', () => {
    const closes = demoMarket().bars.NWSC.map((b) => b.c);
    const out = evaluateForecasters(closes, { minTrain: 250 });
    const ens = out.reports.find((r) => r.model.startsWith('ensemble'))!;
    console.log(out.reports.map((r) => `${r.model.padEnd(30)} cov=${r.coverage.toFixed(3)} rmse=${r.rmse.toFixed(5)} dir=${r.directionalAcc.toFixed(3)} DMp=${r.dmVsNaive?.p.toFixed(3) ?? '-'}`).join('\n'));
    expect(ens.coverage).toBeGreaterThan(0.8);
    expect(ens.coverage).toBeLessThan(0.97);
    expect(out.reports.length).toBe(6);
  });

  it('does not claim skill on a pure random walk (no model should significantly beat naive)', () => {
    const rng = new Rng(2024);
    let p = 100;
    const closes = Array.from({ length: 900 }, () => (p *= Math.exp(0.01 * rng.normal())));
    const out = evaluateForecasters(closes, { minTrain: 250 });
    const sig = out.reports.filter((r) => r.dmVsNaive && r.dmVsNaive.p < 0.01 && r.dmVsNaive.stat < 0);
    expect(sig.length).toBe(0);
  });
});
