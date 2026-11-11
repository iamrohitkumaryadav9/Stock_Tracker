import { describe, it, expect } from 'vitest';
import { demoMarket } from '@/lab/data/synthetic';
import { RagIndex, answerQuestion } from '@/lab/ai/rag';
import { evaluateRag } from '@/lab/ai/rag-eval';
import { DAY } from '@/lab/data/types';

const md = demoMarket();

describe('RAG', () => {
  it('answers with citations, respects restatements point-in-time, and abstains on future filings', async () => {
    const idx = await RagIndex.build(md.filings);
    const orig = md.filings.find((f) => f.id === 'NWSC-2024Q2-10Q')!;
    const fix = md.filings.find((f) => f.id === 'NWSC-2024Q2-10QA')!;
    const q = "What was Northwind Semiconductors's revenue in 2024Q2?";
    const before = await answerQuestion(idx, md.filings, q, { asOf: orig.filedAt + 5 * DAY });
    const after = await answerQuestion(idx, md.filings, q, { asOf: fix.filedAt + 2 * DAY });
    expect(before.abstained).toBe(false);
    expect(before.answer).toContain(String(orig.facts.revenue).replace(/(\.0+)$/, ''));
    expect(after.answer).toContain(String(fix.facts.revenue));
    expect(after.citations[0].filingId).toBe(fix.id);
    const early = await answerQuestion(idx, md.filings, q, { asOf: orig.filedAt - 3 * DAY });
    expect(early.abstained).toBe(true);
  });

  it('evaluation harness: quantis pipeline beats the naive baseline and the lenient judge inflates it', async () => {
    const idx = await RagIndex.build(md.filings);
    const ev = await evaluateRag(idx, md.filings);
    console.log(JSON.stringify({ n: ev.n, quantis: { ...ev.quantis, byWhy: ev.quantis.byWhy }, naive: ev.naive, failures: ev.failures.slice(0, 4) }, null, 1));
    // Honest regression guards, not aspirations: wording A is in-distribution (perfect), C is held-out (60% when measured).
    expect(ev.quantis.accuracy).toBeGreaterThan(0.7);
    expect(ev.quantis.byWhy['wording A: template'].accuracy).toBe(1);
    expect(ev.quantis.byWhy['wording C: HELD-OUT paraphrases'].accuracy).toBeGreaterThan(0.45);
    expect(ev.quantis.hallucination).toBeLessThan(0.08);
    expect(ev.quantis.abstentionRecall).toBeGreaterThan(0.85);
    expect(ev.quantis.citationValidity).toBeGreaterThan(0.95);
    expect(ev.naive.strictAccuracy).toBeLessThan(ev.quantis.accuracy);
    expect(ev.naive.lenientJudgeAccuracy).toBeGreaterThanOrEqual(ev.naive.strictAccuracy);
  });
});
