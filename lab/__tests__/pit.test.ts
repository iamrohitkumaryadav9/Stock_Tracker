import { describe, it, expect } from 'vitest';
import { PitStore, PitView, LookaheadError } from '@/lab/pit/store';
import { demoMarket } from '@/lab/data/synthetic';
import { buildPit } from '@/lab/pit/load';
import { DAY } from '@/lab/data/types';

describe('PitStore', () => {
  it('serves the original value before a restatement and the corrected one after', () => {
    const s = new PitStore<number>();
    s.put({ key: 'k', validAt: 100, knownAt: 110, value: 10 });
    s.put({ key: 'k', validAt: 100, knownAt: 200, value: 9 }); // restatement
    expect(s.latest('k', 150)!.value).toBe(10);
    expect(s.latest('k', 250)!.value).toBe(9);
    expect(s.latest('k', 105)).toBeNull(); // not yet public
    expect(s.revisions('k', 100).map((r) => r.value)).toEqual([10, 9]);
  });
  it('PitView refuses to look ahead', () => {
    const s = new PitStore<number>();
    s.put({ key: 'k', validAt: 1, knownAt: 1, value: 1 });
    const v = new PitView(s, 50);
    expect(() => v.series('k', 60)).toThrow(LookaheadError);
    expect(() => v.withAsOf(60)).toThrow(LookaheadError);
    expect(v.series('k').length).toBe(1);
  });
  it('demo universe exposes restatements point-in-time', () => {
    const md = demoMarket();
    const pit = buildPit(md);
    const orig = md.filings.find((f) => f.id === 'NWSC-2024Q2-10Q')!;
    const fix = md.filings.find((f) => f.id === 'NWSC-2024Q2-10QA')!;
    expect(fix.filedAt).toBeGreaterThan(orig.filedAt);
    const before = pit.filings.latest('NWSC', orig.filedAt + 10 * DAY)!.value;
    const after = pit.filings.latest('NWSC', fix.filedAt + DAY)!.value;
    expect(before.facts.revenue).toBe(orig.facts.revenue);
    expect(after.id).toBe(fix.id);
    expect(after.facts.revenue).toBeLessThan(orig.facts.revenue);
  });
  it('bars are only visible after the close', () => {
    const pit = buildPit(demoMarket());
    const day = demoMarket().bars.NWSC[100].t;
    expect(pit.bars.latest('NWSC', day + 10 * 3_600_000)!.validAt).toBeLessThan(day);
    expect(pit.bars.latest('NWSC', day + 22 * 3_600_000)!.validAt).toBe(day);
  });
});
