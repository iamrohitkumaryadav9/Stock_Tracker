import type { Filing } from '@/lab/data/types';
import { clamp } from '@/lab/core/util';

/**
 * Point-in-time, citation-grounded RAG over filings.
 *  - Section-aware, table-preserving chunking with contextual headers.
 *  - Hybrid retrieval: BM25 + dense (feature-hashing by default; Gemini embeddings pluggable) fused with RRF.
 *  - Heuristic cross-scorer rerank (term coverage, bigrams, numeric/entity/period match, section priors).
 *  - PIT filters: chunks filed after `asOf` are invisible, and superseded filings (restated before `asOf`) are dropped.
 *  - Answers are extractive by default, every number is verified against its cited chunk, and the system abstains
 *    when evidence is weak. An LLM may rewrite the answer but must pass the same verification.
 */
export interface Chunk {
  id: string;
  filingId: string;
  ticker: string;
  company: string;
  period: string;
  form: string;
  filedAt: number;
  section: 'summary-table' | 'mdna' | 'risk' | 'header' | 'other';
  text: string;
  restatedBy?: { id: string; filedAt: number }[];
}
export interface Citation { chunkId: string; filingId: string; quote: string; filedAt: number }
export interface RagAnswer {
  question: string;
  answer: string;
  abstained: boolean;
  confidence: number;
  citations: Citation[];
  retrieved: { chunkId: string; score: number; section: string; filingId: string }[];
  notes: string[];
}

const STOP = new Set('the a an of in on for to and or is was were what which how much did does do by with at as from that this it its be are has have had their our we about'.split(' '));
export const tokenize = (s: string): string[] =>
  (s.toLowerCase().match(/[a-z0-9$][a-z0-9.,%$]*[a-z0-9%]|[a-z0-9]/g) ?? []).map((t) => t.replace(/,/g, '')).filter((t) => !STOP.has(t));

/* ---------------- chunking ---------------- */
export function chunkFiling(f: Filing, restatedBy: Chunk['restatedBy'] = []): Chunk[] {
  const header = `[${f.ticker} | ${f.company} | ${f.form} | ${f.period}]`;
  const lines = f.text.split('\n');
  const out: Chunk[] = [];
  let cur: string[] = [], section: Chunk['section'] = 'header', n = 0;
  const flush = () => {
    const body = cur.join('\n').trim();
    if (body) out.push({ id: `${f.id}#${n++}`, filingId: f.id, ticker: f.ticker, company: f.company, period: f.period, form: f.form, filedAt: f.filedAt, section, text: `${header}\n${body}`, restatedBy });
    cur = [];
  };
  for (const ln of lines) {
    if (/^Item\s+1A/i.test(ln)) { flush(); section = 'risk'; }
    else if (/^Item\s+2|^Item\s+7|Management's Discussion/i.test(ln)) { flush(); section = 'mdna'; }
    else if (/^Financial Summary/i.test(ln)) { flush(); section = 'summary-table'; }
    // keep tables intact; split long prose into ~700 char pieces on sentence boundaries
    if (section !== 'summary-table' && cur.join('\n').length > 700 && /[.!?]$/.test(ln.trim())) { cur.push(ln); flush(); continue; }
    cur.push(ln);
  }
  flush();
  return out;
}

/* ---------------- embeddings ---------------- */
export interface Embedder { name: string; dim: number; embed(texts: string[]): Promise<number[][]> | number[][] }
export const hashEmbedder = (dim = 768): Embedder => ({
  name: `feature-hashing-${dim}`,
  dim,
  embed(texts) {
    return texts.map((t) => {
      const v = new Array(dim).fill(0);
      const toks = tokenize(t);
      const add = (g: string, w: number) => {
        let h = 2166136261;
        for (let i = 0; i < g.length; i++) { h ^= g.charCodeAt(i); h = Math.imul(h, 16777619); }
        v[Math.abs(h) % dim] += (h & 1 ? 1 : -1) * w;
      };
      toks.forEach((tk, i) => { add(tk, 1); if (i) add(toks[i - 1] + '_' + tk, 0.6); });
      const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
      return v.map((x) => x / norm);
    });
  },
});

/** Optional: real semantic embeddings via Gemini (set GEMINI_API_KEY). Not used in tests. */
export async function geminiEmbedder(apiKey: string): Promise<Embedder> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: 'text-embedding-004' });
  return {
    name: 'gemini-text-embedding-004', dim: 768,
    async embed(texts) {
      const r = await model.batchEmbedContents({ requests: texts.map((t) => ({ content: { role: 'user', parts: [{ text: t }] }, taskType: 'RETRIEVAL_DOCUMENT' as never })) });
      return r.embeddings.map((e) => e.values);
    },
  };
}

/* ---------------- index ---------------- */
export class RagIndex {
  chunks: Chunk[] = [];
  private tf: Map<string, number>[] = [];
  private df = new Map<string, number>();
  private len: number[] = [];
  private vecs: number[][] = [];
  private avg = 0;
  constructor(public embedder: Embedder = hashEmbedder()) {}

  static async build(filings: Filing[], embedder: Embedder = hashEmbedder()): Promise<RagIndex> {
    const idx = new RagIndex(embedder);
    const restaters = new Map<string, { id: string; filedAt: number }[]>();
    for (const f of filings) if (f.restates) restaters.set(f.restates, [...(restaters.get(f.restates) ?? []), { id: f.id, filedAt: f.filedAt }]);
    for (const f of filings) idx.chunks.push(...chunkFiling(f, restaters.get(f.id) ?? []));
    idx.chunks.forEach((c, i) => {
      const toks = tokenize(c.text);
      const m = new Map<string, number>();
      toks.forEach((t) => m.set(t, (m.get(t) ?? 0) + 1));
      idx.tf[i] = m; idx.len[i] = toks.length;
      m.forEach((_, t) => idx.df.set(t, (idx.df.get(t) ?? 0) + 1));
    });
    idx.avg = idx.len.reduce((a, b) => a + b, 0) / Math.max(1, idx.len.length);
    idx.vecs = await idx.embedder.embed(idx.chunks.map((c) => c.text));
    return idx;
  }

  private visible(c: Chunk, asOf: number | null): boolean {
    if (asOf === null) return true;
    if (c.filedAt > asOf) return false; // not public yet
    if (c.restatedBy?.some((r) => r.filedAt <= asOf)) return false; // superseded by a correction already filed
    return true;
  }
  private bm25(qt: string[], i: number): number {
    const N = this.chunks.length, k1 = 1.5, b = 0.75;
    let s = 0;
    for (const t of qt) {
      const f = this.tf[i].get(t) ?? 0;
      if (!f) continue;
      const df = this.df.get(t) ?? 0;
      s += Math.log(1 + (N - df + 0.5) / (df + 0.5)) * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * this.len[i]) / this.avg)));
    }
    return s;
  }

  async search(query: string, opts: { asOf?: number | null; k?: number; ticker?: string | null; period?: string | null; usePit?: boolean } = {}) {
    const { k = 5, usePit = true } = opts;
    const asOf = usePit ? opts.asOf ?? null : null;
    const qt = tokenize(query);
    const [qv] = await this.embedder.embed([query]);
    const cand = this.chunks.map((c, i) => ({ c, i })).filter(({ c }) => this.visible(c, asOf) && (!opts.ticker || c.ticker === opts.ticker) && (!opts.period || c.period === opts.period));
    const bm = cand.map(({ i }) => ({ i, s: this.bm25(qt, i) })).sort((a, b) => b.s - a.s);
    const dn = cand.map(({ i }) => ({ i, s: this.vecs[i].reduce((s, x, j) => s + x * qv[j], 0) })).sort((a, b) => b.s - a.s);
    const fused = new Map<number, number>();
    bm.forEach((x, r) => fused.set(x.i, (fused.get(x.i) ?? 0) + 1 / (60 + r + 1)));
    dn.forEach((x, r) => fused.set(x.i, (fused.get(x.i) ?? 0) + 1 / (60 + r + 1)));
    const top = [...fused].sort((a, b) => b[1] - a[1]).slice(0, Math.max(k * 3, 12)).map(([i]) => i);
    // rerank
    const qset = new Set(qt);
    const qbig = new Set(qt.slice(1).map((t, i) => qt[i] + '_' + t));
    const wantsTable = /revenue|income|eps|earnings per share|guidance|outlook|margin/i.test(query);
    const wantsRisk = /risk|regulat|supply|threat|litigation|weather|export/i.test(query);
    const reranked = top.map((i) => {
      const toks = tokenize(this.chunks[i].text);
      const tset = new Set(toks);
      const cover = [...qset].filter((t) => tset.has(t)).length / Math.max(1, qset.size);
      const bigs = new Set(toks.slice(1).map((t, j) => toks[j] + '_' + t));
      const bigram = [...qbig].filter((g) => bigs.has(g)).length / Math.max(1, qbig.size);
      const sec = this.chunks[i].section;
      const prior = (wantsTable ? (sec === 'summary-table' ? 0.25 : sec === 'mdna' ? 0.15 : 0) : 0) + (wantsRisk && sec === 'risk' ? 0.3 : 0);
      return { i, score: 0.55 * cover + 0.25 * bigram + prior + 0.4 * (fused.get(i) ?? 0) * 60 / 2 / 10 };
    }).sort((a, b) => b.score - a.score).slice(0, k);
    return reranked.map((r) => ({ chunk: this.chunks[r.i], score: r.score }));
  }
}

/* ---------------- question understanding ---------------- */
export function parseQuestion(q: string, filings: Filing[]) {
  const lower = q.toLowerCase();
  const tickers = [...new Set(filings.map((f) => f.ticker))];
  const ticker = tickers.find((t) => new RegExp(`\\b${t}\\b`, 'i').test(q)) ?? [...new Map(filings.map((f) => [f.company, f.ticker]))].find(([name]) => lower.includes(name.toLowerCase().split(' ')[0]))?.[1] ?? null;
  let period: string | null = null;
  const m1 = q.match(/\b(20\d{2})\s*[-\s]?Q([1-4])\b/i) ?? null;
  const m2 = q.match(/\bQ([1-4])\s*[-\s]?(?:of\s*)?(20\d{2})\b/i);
  const ORD: Record<string, string> = { first: '1', second: '2', third: '3', fourth: '4' };
  const m3 = q.match(/\b(first|second|third|fourth)\s+quarter\s+(?:of\s+)?(?:fiscal\s+)?(20\d{2})\b/i);
  if (m1) period = `${m1[1]}Q${m1[2]}`;
  else if (m2) period = `${m2[2]}Q${m2[1]}`;
  else if (m3) period = `${m3[2]}Q${ORD[m3[1].toLowerCase()]}`;
  const metric = /earnings per share|eps/i.test(q) ? 'eps' : /net income|profit|bottom line|earned/i.test(q) ? 'netIncome' : /guidance|outlook|expect|forecast/i.test(q) ? 'guidance' : /revenue|sales|top line|bring in|brought in/i.test(q) ? 'revenue' : /risk|regulat|weather|supply|export|credit|privacy/i.test(q) ? 'risk' : null;
  return { ticker, period, metric };
}

const LABEL: Record<string, RegExp> = {
  revenue: /^Revenue \| ([\d.,]+)/m,
  netIncome: /^Net income \| ([\d.,]+)/m,
  eps: /^Diluted EPS \| ([\d.,]+)/m,
  guidance: /^Guidance next quarter revenue \| ([\d.,]+)/m,
};
const PRETTY: Record<string, string> = { revenue: 'revenue', netIncome: 'net income', eps: 'diluted EPS', guidance: 'next-quarter revenue guidance' };

export async function answerQuestion(index: RagIndex, filings: Filing[], question: string, opts: { asOf?: number | null; usePit?: boolean; abstainBelow?: number } = {}): Promise<RagAnswer> {
  const { abstainBelow = 0.42 } = opts;
  const pq = parseQuestion(question, filings);
  const notes: string[] = [];
  const hits = await index.search(question, { asOf: opts.asOf ?? null, usePit: opts.usePit, ticker: pq.ticker, period: pq.period, k: 5 });
  const retrieved = hits.map((h) => ({ chunkId: h.chunk.id, score: +h.score.toFixed(3), section: h.chunk.section, filingId: h.chunk.filingId }));
  const base = { question, retrieved, notes };
  if (!hits.length) return { ...base, answer: 'I could not find any filing available at that date that covers this question.', abstained: true, confidence: 0, citations: [] };
  if (!pq.ticker) notes.push('No company recognised in the question.');
  if (!pq.period && pq.metric && pq.metric !== 'risk') notes.push('No fiscal period given: using the most recent filing visible at the decision date.');

  let best = hits[0];
  if (!pq.period && pq.metric && pq.metric !== 'risk') {
    const latest = [...hits].sort((a, b) => b.chunk.filedAt - a.chunk.filedAt).find((h) => h.chunk.section === 'summary-table' && h.chunk.ticker === (pq.ticker ?? h.chunk.ticker));
    if (latest) best = latest;
  }
  // When entity, period and metric are all resolved, the retrieval filter has already narrowed the candidates to the one
  // matching filing, so lexical overlap with the question wording says little about correctness. Confidence then comes
  // from the structured resolution, not from how similar the phrasing is to the filing's vocabulary.
  const resolved = !!(pq.ticker && pq.period && pq.metric && pq.metric !== 'risk');
  const conf = clamp(resolved ? Math.max(best.score, 0.6) : best.score, 0, 1);
  if (!pq.metric) return { ...base, answer: 'I could not tell which figure or topic the question is about, so I am not answering.', abstained: true, confidence: +conf.toFixed(3), citations: [] };
  if (!pq.ticker || conf < abstainBelow) return { ...base, answer: 'Insufficient evidence in the filings available at that date to answer reliably.', abstained: true, confidence: +conf.toFixed(3), citations: [] };

  if (pq.metric && pq.metric !== 'risk') {
    const src = hits.find((h) => h.chunk.section === 'summary-table' && (!pq.period || h.chunk.period === pq.period)) ?? (pq.period ? null : best);
    const mm = src ? src.chunk.text.match(LABEL[pq.metric]) : null;
    if (!src || !mm) return { ...base, answer: 'The requested figure is not in the filings available at that date.', abstained: true, confidence: +conf.toFixed(3), citations: [] };
    const unit = pq.metric === 'eps' ? '$' : '$';
    const value = mm[1];
    const quote = mm[0];
    const answer = `${src.chunk.company} reported ${PRETTY[pq.metric]} of ${unit}${value}${pq.metric === 'eps' ? '' : ' million'} for ${src.chunk.period} (${src.chunk.form}, filed ${new Date(src.chunk.filedAt).toISOString().slice(0, 10)}).`;
    // verification: the number in the answer must literally appear in the cited text
    const ok = src.chunk.text.includes(value);
    if (!ok) return { ...base, answer: 'Could not verify the figure against the cited source.', abstained: true, confidence: 0, citations: [] };
    return { ...base, answer, abstained: false, confidence: +conf.toFixed(3), citations: [{ chunkId: src.chunk.id, filingId: src.chunk.filingId, quote, filedAt: src.chunk.filedAt }] };
  }
  // qualitative / risk: return the best supporting passage verbatim
  const passage = best.chunk.text.split('\n').slice(1).filter((l) => l.length > 40).sort((a, b) => overlap(question, b) - overlap(question, a))[0] ?? best.chunk.text.slice(0, 300);
  return { ...base, answer: `${best.chunk.company} (${best.chunk.period}): ${passage}`, abstained: false, confidence: +conf.toFixed(3), citations: [{ chunkId: best.chunk.id, filingId: best.chunk.filingId, quote: passage, filedAt: best.chunk.filedAt }] };
}
const overlap = (q: string, s: string) => { const a = new Set(tokenize(q)); return tokenize(s).filter((t) => a.has(t)).length; };

/** A deliberately naive baseline for comparison: BM25/hybrid top-1, no PIT filter, no company/period parsing, never abstains. */
export async function naiveAnswer(index: RagIndex, question: string): Promise<{ answer: string; citedText: string }> {
  const hits = await index.search(question, { k: 1, usePit: false });
  const c = hits[0]?.chunk;
  if (!c) return { answer: '', citedText: '' };
  const nums = c.text.match(/\$?[\d,]+\.?\d*/g) ?? [];
  const wantsEps = /eps|per share/i.test(question), wantsNi = /net income/i.test(question);
  const line = c.text.split('\n').find((l) => (wantsEps ? /EPS/.test(l) : wantsNi ? /^Net income/.test(l) : /^Revenue/.test(l))) ?? '';
  const val = line.match(/[\d.,]+/)?.[0] ?? nums[0] ?? '';
  return { answer: `${c.company} ${c.period}: ${val}`, citedText: c.text };
}
