import { hashEmbedder } from './rag';

/**
 * FinMem-style layered memory for trading agents.
 *   shallow       : recent events, decays in days
 *   intermediate  : weeks-months
 *   deep          : durable lessons, decays slowly
 * Retrieval score = recency + relevance + importance. Reflection after an outcome raises importance of
 * costly mistakes and promotes memories to deeper layers, so lessons outlive noise.
 */
export type Layer = 'shallow' | 'intermediate' | 'deep';
export interface MemoryItem {
  id: string;
  ts: number;
  ticker: string;
  kind: 'observation' | 'decision' | 'lesson';
  text: string;
  importance: number; // 0..1
  layer: Layer;
  analyst?: string; // which analyst's signal this relates to (for reliability tracking)
  signal?: number; // that analyst's score at the time
  outcome?: { forwardReturn: number; hit: boolean; at: number };
}
const TAU: Record<Layer, number> = { shallow: 14 * 86400e3, intermediate: 90 * 86400e3, deep: 365 * 86400e3 };
const emb = hashEmbedder(256);
const vec = (t: string) => emb.embed([t]) as number[][];
const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);

export class AgentMemory {
  items: MemoryItem[] = [];
  private seq = 0;

  add(m: Omit<MemoryItem, 'id' | 'layer'> & { layer?: Layer }): MemoryItem {
    const layer: Layer = m.layer ?? (m.importance > 0.8 ? 'deep' : m.importance > 0.5 ? 'intermediate' : 'shallow');
    const item: MemoryItem = { ...m, layer, id: `m${++this.seq}` };
    this.items.push(item);
    return item;
  }

  /** Only memories that existed at `asOf` are retrievable: memory cannot leak the future either. */
  retrieve(situation: string, asOf: number, ticker: string | null, k = 5) {
    const q = vec(situation)[0];
    return this.items
      .filter((m) => m.ts <= asOf && (!ticker || m.ticker === ticker) && !(m.outcome && m.outcome.at > asOf))
      .map((m) => {
        const recency = Math.exp(-(asOf - m.ts) / TAU[m.layer]);
        const rel = Math.max(0, dot(q, vec(m.text)[0]));
        return { m, score: 0.35 * recency + 0.4 * rel + 0.25 * m.importance };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, k);
  }

  /** Attach an outcome to a decision memory and write a lesson when the call was wrong and costly. */
  reflect(decisionId: string, forwardReturn: number, at: number) {
    const d = this.items.find((m) => m.id === decisionId);
    if (!d || d.outcome) return null;
    const dir = Math.sign(d.signal ?? 0);
    const hit = dir !== 0 && Math.sign(forwardReturn) === dir;
    d.outcome = { forwardReturn, hit, at };
    if (!hit && Math.abs(forwardReturn) > 0.02) {
      d.importance = Math.min(1, d.importance + 0.35);
      d.layer = d.importance > 0.8 ? 'deep' : 'intermediate';
      return this.add({ ts: at, ticker: d.ticker, kind: 'lesson', text: `Lesson: ${d.analyst ?? 'signal'} signal ${d.signal?.toFixed(2)} was wrong; ${d.ticker} moved ${(forwardReturn * 100).toFixed(1)}%. Original reasoning: ${d.text}`, importance: 0.85, analyst: d.analyst });
    }
    if (hit) d.importance = Math.max(0.1, d.importance - 0.05);
    return null;
  }

  /** Rolling reliability of an analyst, shrunk toward 0.5 (Beta(5,5) prior) so a few outcomes cannot dominate. */
  reliability(analyst: string, asOf: number): number {
    const done = this.items.filter((m) => m.analyst === analyst && m.kind === 'decision' && m.outcome && m.outcome.at <= asOf);
    const hits = done.filter((m) => m.outcome!.hit).length;
    return (hits + 5) / (done.length + 10);
  }
  toJSON() { return { items: this.items, seq: this.seq }; }
  static fromJSON(j: { items: MemoryItem[]; seq: number } | null | undefined): AgentMemory {
    const m = new AgentMemory();
    if (j) { m.items = j.items; (m as unknown as { seq: number }).seq = j.seq; }
    return m;
  }
}
