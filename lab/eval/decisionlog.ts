import { sha256, stableStringify } from '@/lab/core/util';

/**
 * Append-only, hash-chained decision log for forward testing.
 * A decision is written BEFORE its outcome exists. The outcome is a separate later entry that references
 * the decision, so history can never be rewritten to look better: editing any past entry breaks the chain.
 */
export interface LogEntry {
  seq: number;
  kind: 'decision' | 'outcome';
  actor: string; // strategy or agent name + version
  ticker: string;
  decidedAt: number; // market time the decision refers to
  recordedAt: number; // wall-clock time it was written
  payload: Record<string, unknown>;
  refSeq?: number;
  prevHash: string;
  hash: string;
}
export interface LogStore {
  all(): Promise<LogEntry[]>;
  append(e: LogEntry): Promise<void>;
}
export class MemoryLogStore implements LogStore {
  rows: LogEntry[] = [];
  async all() { return [...this.rows]; }
  async append(e: LogEntry) { this.rows.push(e); }
}
const GENESIS = '0'.repeat(64);

export class DecisionLog {
  constructor(private store: LogStore) {}

  private async add(e: Omit<LogEntry, 'seq' | 'prevHash' | 'hash'>): Promise<LogEntry> {
    const rows = await this.store.all();
    const last = rows[rows.length - 1];
    const body = { ...e, seq: (last?.seq ?? 0) + 1, prevHash: last?.hash ?? GENESIS };
    const entry: LogEntry = { ...body, hash: sha256(stableStringify(body)) };
    await this.store.append(entry);
    return entry;
  }
  decide(actor: string, ticker: string, decidedAt: number, payload: Record<string, unknown>, recordedAt = Date.now()) {
    return this.add({ kind: 'decision', actor, ticker, decidedAt, recordedAt, payload });
  }
  /** Outcomes may only be attached to an existing decision, and only once, and only after the decision time. */
  async resolve(refSeq: number, outcome: Record<string, unknown>, observedAt: number, recordedAt = Date.now()) {
    const rows = await this.store.all();
    const d = rows.find((r) => r.seq === refSeq && r.kind === 'decision');
    if (!d) throw new Error(`no decision #${refSeq}`);
    if (rows.some((r) => r.kind === 'outcome' && r.refSeq === refSeq)) throw new Error(`decision #${refSeq} already resolved`);
    if (observedAt < d.decidedAt) throw new Error('outcome observed before decision time');
    return this.add({ kind: 'outcome', actor: d.actor, ticker: d.ticker, decidedAt: observedAt, recordedAt, payload: outcome, refSeq });
  }
  async verify(): Promise<{ ok: boolean; brokenAt: number | null; length: number }> {
    let prev = GENESIS;
    const rows = await this.store.all();
    for (const r of rows) {
      const { hash, ...body } = r;
      if (r.prevHash !== prev || sha256(stableStringify(body)) !== hash) return { ok: false, brokenAt: r.seq, length: rows.length };
      prev = hash;
    }
    return { ok: true, brokenAt: null, length: rows.length };
  }
  async list() { return this.store.all(); }

  /** Forward-test scoreboard: hit-rate and mean return of resolved decisions per actor. */
  async scoreboard() {
    const rows = await this.store.all();
    const byActor = new Map<string, { n: number; hits: number; sumRet: number; open: number }>();
    for (const d of rows.filter((r) => r.kind === 'decision')) {
      const s = byActor.get(d.actor) ?? { n: 0, hits: 0, sumRet: 0, open: 0 };
      const o = rows.find((r) => r.kind === 'outcome' && r.refSeq === d.seq);
      if (!o) s.open++;
      else {
        const ret = Number(o.payload.forwardReturn ?? 0), w = Number(d.payload.weight ?? 0);
        s.n++; s.sumRet += w * ret; if (w * ret > 0) s.hits++;
      }
      byActor.set(d.actor, s);
    }
    return [...byActor].map(([actor, s]) => ({ actor, resolved: s.n, open: s.open, hitRate: s.n ? s.hits / s.n : null, meanReturn: s.n ? s.sumRet / s.n : null }));
  }
}
