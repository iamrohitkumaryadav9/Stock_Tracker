import type { Filing } from '@/lab/data/types';
import { DAY } from '@/lab/data/types';
import { Rng, mean } from '@/lab/core/util';
import { RagIndex, answerQuestion, naiveAnswer } from './rag';

/**
 * FinanceBench-style evaluation on the lab corpus. It checks what matters for financial RAG:
 *   - correct figure AS OF the question date (restatements!)           -> accuracy
 *   - saying "I don't know" when the filing is not public yet / absent -> abstention recall
 *   - never inventing a figure                                         -> hallucination rate
 *   - answer numbers actually present in the cited source               -> citation validity
 * and compares two judges to show why judge calibration matters: a lenient LLM-style judge versus a strict
 * gold-aware judge, applied to the same naive pipeline.
 */
export interface GoldQ {
  id: string;
  question: string;
  asOf: number;
  kind: 'figure' | 'unanswerable' | 'risk';
  goldValue?: number;
  goldFilingId?: string;
  mustContain?: string; // for risk questions
  style?: Style;
  why?: string;
}

const ORDW = ['first', 'second', 'third', 'fourth'];
const spoken = (p: string) => `${ORDW[+p[5] - 1]} quarter of ${p.slice(0, 4)}`; // 2024Q2 -> "second quarter of 2024"
/**
 * Two phrasings per metric. Template A matches what the parser was developed against; template B is a
 * held-out paraphrase style (spoken quarter, different vocabulary) to measure generalisation, not recall.
 */
export type Style = 'A' | 'B' | 'C';
const fq = (p: string) => ({ y: p.slice(0, 4), q: p[5] });
/**
 * A = template the parser was first written against.
 * B = paraphrases used while developing/tuning (a "dev set": no longer a fair test once tuned against).
 * C = paraphrases written BEFORE the parser was tuned on B and never inspected: the held-out generalisation check.
 */
const METRICS: { key: 'revenue' | 'netIncome' | 'eps' | 'guidance'; q: Record<Style, (c: string, p: string) => string> }[] = [
  { key: 'revenue', q: { A: (c, p) => `What was ${c}'s revenue in ${p}?`, B: (c, p) => `How much did ${c} bring in during the ${spoken(p)}?`, C: (c, p) => `${c} turnover for fiscal Q${fq(p).q} ${fq(p).y}?` } },
  { key: 'netIncome', q: { A: (c, p) => `What was net income for ${c} in ${p}?`, B: (c, p) => `What was the bottom line for ${c} in the ${spoken(p)}?`, C: (c, p) => `Net profit for ${c}, ${fq(p).y} Q${fq(p).q}?` } },
  { key: 'eps', q: { A: (c, p) => `What was diluted EPS for ${c} in ${p}?`, B: (c, p) => `What did ${c} earn per share in the ${spoken(p)}?`, C: (c, p) => `${c}: EPS (diluted), Q${fq(p).q} of ${fq(p).y}` } },
  { key: 'guidance', q: { A: (c, p) => `What revenue guidance did ${c} give for the quarter after ${p}?`, B: (c, p) => `What top-line forecast did ${c} give after the ${spoken(p)}?`, C: (c, p) => `What is ${c} projecting for sales next quarter, per its ${fq(p).y} Q${fq(p).q} report?` } },
];

export function buildGoldSet(filings: Filing[], seed = 5, nFigures = 90): GoldQ[] {
  const rng = new Rng(seed);
  const out: GoldQ[] = [];
  const byPeriod = new Map<string, Filing[]>();
  for (const f of filings) byPeriod.set(`${f.ticker}|${f.period}`, [...(byPeriod.get(`${f.ticker}|${f.period}`) ?? []), f]);
  const fig: GoldQ[] = [];
  for (const [, fs] of byPeriod) {
    const sorted = [...fs].sort((a, b) => a.filedAt - b.filedAt);
    for (const m of METRICS) {
      // as-of just after each revision: the answer must be the value known THEN
      sorted.forEach((f, ri) => {
        const next = sorted[ri + 1];
        const asOf = f.filedAt + (next ? Math.min(10, Math.floor((next.filedAt - f.filedAt) / DAY / 2)) : 20) * DAY;
        const style = (['A', 'B', 'C'] as const)[rng.int(0, 2)];
        fig.push({ id: `${f.id}:${m.key}:${ri}`, question: m.q[style](f.company, f.period), asOf, style, kind: 'figure', goldValue: f.facts[m.key], goldFilingId: f.id, why: ri ? 'restated value (corrected filing already public)' : next ? 'original value (correction not yet filed)' : 'latest value' });
      });
    }
  }
  while (out.length < nFigures && fig.length) out.push(fig.splice(rng.int(0, fig.length - 1), 1)[0]);
  // keep every restatement-sensitive question: they are the hard cases
  for (const q of fig) if (q.why?.startsWith('restated') || q.why?.startsWith('original')) if (out.length < nFigures + 24) out.push(q);

  // unanswerable: asked before the filing existed
  const firsts = [...byPeriod.values()].map((fs) => fs.sort((a, b) => a.filedAt - b.filedAt)[0]);
  for (let i = 0; i < 14; i++) {
    const f = firsts[rng.int(0, firsts.length - 1)];
    out.push({ id: `future-${i}`, question: METRICS[i % 4].q[(['A', 'B', 'C'] as const)[i % 3]](f.company, f.period), asOf: f.filedAt - 5 * DAY, kind: 'unanswerable', why: 'filing not public yet at the question date' });
  }
  for (const [i, q] of ['What was Contoso Dynamics revenue in 2024Q1?', 'How many employees does Zephyr Robotics have?', "What did the CEO say about next year's dividend?", 'Which acquisitions did Orion Labs announce?'].entries())
    out.push({ id: `absent-${i}`, question: q, asOf: Date.UTC(2025, 11, 31), kind: 'unanswerable', why: 'entity/fact not in corpus' });

  // qualitative risk retrieval
  const risk: Record<string, [string, string]> = { Technology: ['foundry', 'export controls'], Utilities: ['rate decisions', 'weather'], Financials: ['credit losses', 'net interest margin'], Healthcare: ['reimbursement', 'privacy'] };
  const sector: Record<string, string> = { NWSC: 'Technology', HLGD: 'Utilities', MRDB: 'Financials', ASTH: 'Healthcare' };
  for (const f of firsts) {
    const [a] = risk[sector[f.ticker]] ?? ['risk'];
    out.push({ id: `risk-${f.ticker}`, question: `What risks does ${f.company} cite related to ${a}?`, asOf: Date.UTC(2025, 11, 31), kind: 'risk', mustContain: a, why: 'qualitative retrieval' });
  }
  return out;
}

const numIn = (s: string): number[] => (s.match(/\d[\d,]*\.?\d*/g) ?? []).map((x) => parseFloat(x.replace(/,/g, ''))).filter((x) => Number.isFinite(x));
const strictJudge = (gold: number, ans: string) => numIn(ans).some((n) => Math.abs(n - gold) <= Math.max(0.005, Math.abs(gold) * 0.0005));
/** Stand-in for a lenient LLM-as-judge: "sounds right if a number is in the ballpark". Known failure mode, kept on purpose. */
const lenientJudge = (gold: number, ans: string) => numIn(ans).some((n) => Math.abs(n - gold) <= Math.abs(gold) * 0.2);

export interface RagEval {
  n: number;
  quantis: { accuracy: number; abstentionRecall: number; falseAbstain: number; hallucination: number; citationValidity: number; hit1: number; riskRecall: number; byWhy: Record<string, { n: number; accuracy: number }> };
  naive: { strictAccuracy: number; lenientJudgeAccuracy: number; judgeInflation: number };
  failures: { id: string; question: string; gold?: number; answer: string; why?: string }[];
  note: string;
}

export async function evaluateRag(index: RagIndex, filings: Filing[], gold = buildGoldSet(filings)): Promise<RagEval> {
  const figs = gold.filter((g) => g.kind === 'figure'), un = gold.filter((g) => g.kind === 'unanswerable'), rk = gold.filter((g) => g.kind === 'risk');
  const failures: RagEval['failures'] = [];
  let correct = 0, halluc = 0, falseAbs = 0, cited = 0, citedOk = 0, hit1 = 0;
  const byWhy: Record<string, { n: number; c: number }> = {};
  const chunkText = new Map(index.chunks.map((c) => [c.id, c.text]));
  for (const g of figs) {
    const r = await answerQuestion(index, filings, g.question, { asOf: g.asOf });
    const w = (byWhy[g.why ?? '?'] ??= { n: 0, c: 0 });
    const pw = (byWhy[g.style === 'A' ? 'wording A: template' : g.style === 'B' ? 'wording B: dev paraphrases (tuned on)' : 'wording C: HELD-OUT paraphrases'] ??= { n: 0, c: 0 });
    w.n++; pw.n++;
    if (r.retrieved[0]?.filingId === g.goldFilingId) hit1++;
    if (r.abstained) { falseAbs++; failures.push({ id: g.id, question: g.question, gold: g.goldValue, answer: 'ABSTAINED', why: g.why }); continue; }
    if (strictJudge(g.goldValue!, r.answer)) { correct++; w.c++; pw.c++; }
    else { halluc++; failures.push({ id: g.id, question: g.question, gold: g.goldValue, answer: r.answer, why: g.why }); }
    for (const c of r.citations) { cited++; if (numIn(r.answer).some((n) => (chunkText.get(c.chunkId) ?? '').replace(/,/g, '').includes(String(n)))) citedOk++; }
  }
  let abstOk = 0;
  for (const g of un) {
    const r = await answerQuestion(index, filings, g.question, { asOf: g.asOf });
    if (r.abstained) abstOk++; else failures.push({ id: g.id, question: g.question, answer: r.answer, why: g.why });
  }
  let riskOk = 0;
  for (const g of rk) {
    const r = await answerQuestion(index, filings, g.question, { asOf: g.asOf });
    if (!r.abstained && r.citations.some((c) => c.quote.toLowerCase().includes(g.mustContain!.toLowerCase()))) riskOk++;
  }
  // naive baseline judged two ways
  let ns = 0, nl = 0;
  for (const g of figs) {
    const n = await naiveAnswer(index, g.question);
    if (strictJudge(g.goldValue!, n.answer)) ns++;
    if (lenientJudge(g.goldValue!, n.answer)) nl++;
  }
  return {
    n: gold.length,
    quantis: {
      accuracy: correct / figs.length, abstentionRecall: abstOk / un.length, falseAbstain: falseAbs / figs.length, hallucination: halluc / figs.length,
      citationValidity: cited ? citedOk / cited : 0, hit1: hit1 / figs.length, riskRecall: rk.length ? riskOk / rk.length : 0,
      byWhy: Object.fromEntries(Object.entries(byWhy).map(([k, v]) => [k, { n: v.n, accuracy: v.c / v.n }])),
    },
    naive: { strictAccuracy: ns / figs.length, lenientJudgeAccuracy: nl / figs.length, judgeInflation: (nl - ns) / figs.length },
    failures: failures.slice(0, 12),
    note: 'Corpus is synthetic and templated, and the parser was developed on the "template wording" questions, so wording A/B scores are upper bounds, not real-world estimates. Only wording C was written before tuning and never inspected, so it is the honest generalisation check. The naive baseline ignores dates and abstention; the gap between the two judges on it shows why an uncalibrated LLM judge overstates accuracy.',
  };
}
void mean;
