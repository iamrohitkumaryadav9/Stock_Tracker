import { sha256, stableStringify } from '@/lab/core/util';

/**
 * Immutable double-entry ledger.
 *  - Amounts are integers (minor units, or share counts for security "currencies").
 *  - Within one transaction, postings of each currency sum to zero.
 *  - Entries are never edited or deleted. A correction is a new reversing transaction.
 *  - Every transaction carries an idempotency key: replaying the same request returns the original result;
 *    reusing a key with a different payload is a conflict, not a silent overwrite.
 *  - Each entry is hash-chained to the previous one, so tampering with history is detectable.
 */
export interface Posting {
  account: string;
  currency: string;
  amount: number; // + debit-to-account, - credit-from-account (signed integer)
}
export interface LedgerTxn {
  seq: number;
  id: string;
  key: string;
  ts: number;
  memo: string;
  postings: Posting[];
  reverses?: string;
  payloadHash: string;
  prevHash: string;
  hash: string;
}
export interface PostRequest {
  key: string;
  ts: number;
  memo: string;
  postings: Posting[];
  reverses?: string;
}

export class LedgerError extends Error {
  constructor(public code: 'UNBALANCED' | 'INVALID_AMOUNT' | 'IDEMPOTENCY_CONFLICT' | 'UNKNOWN_TXN' | 'ALREADY_REVERSED' | 'EMPTY', msg: string) {
    super(msg);
  }
}

export interface LedgerStore {
  all(): Promise<LedgerTxn[]>;
  findByKey(key: string): Promise<LedgerTxn | null>;
  /** Must fail (throw) if `key` already exists: the storage layer is the final idempotency guard. */
  append(t: LedgerTxn): Promise<void>;
}

export class MemoryLedgerStore implements LedgerStore {
  private rows: LedgerTxn[] = [];
  private byKey = new Map<string, LedgerTxn>();
  async all() { return [...this.rows]; }
  async findByKey(k: string) { return this.byKey.get(k) ?? null; }
  async append(t: LedgerTxn) {
    if (this.byKey.has(t.key)) throw new Error('duplicate key');
    this.rows.push(t);
    this.byKey.set(t.key, t);
  }
}

const GENESIS = '0'.repeat(64);

export class Ledger {
  constructor(private store: LedgerStore) {}

  static validate(postings: Posting[]) {
    if (!postings.length) throw new LedgerError('EMPTY', 'transaction has no postings');
    const byCcy = new Map<string, number>();
    for (const p of postings) {
      if (!Number.isInteger(p.amount)) throw new LedgerError('INVALID_AMOUNT', `non-integer amount on ${p.account}`);
      byCcy.set(p.currency, (byCcy.get(p.currency) ?? 0) + p.amount);
    }
    for (const [c, s] of byCcy) if (s !== 0) throw new LedgerError('UNBALANCED', `currency ${c} is off by ${s}`);
  }

  async post(req: PostRequest): Promise<{ txn: LedgerTxn; replayed: boolean }> {
    Ledger.validate(req.postings);
    const payloadHash = sha256(stableStringify({ postings: req.postings, memo: req.memo, reverses: req.reverses ?? null }));
    const existing = await this.store.findByKey(req.key);
    if (existing) {
      if (existing.payloadHash !== payloadHash) throw new LedgerError('IDEMPOTENCY_CONFLICT', `key ${req.key} was used with a different payload`);
      return { txn: existing, replayed: true };
    }
    const rows = await this.store.all();
    const last = rows[rows.length - 1];
    const seq = (last?.seq ?? 0) + 1;
    const prevHash = last?.hash ?? GENESIS;
    // Never put `undefined` in a hashed body: JSON/BSON stores turn it into null (or drop it) and the recomputed hash would differ.
    const body = { seq, id: `txn_${seq}`, key: req.key, ts: req.ts, memo: req.memo, postings: req.postings, ...(req.reverses ? { reverses: req.reverses } : {}), payloadHash, prevHash };
    const txn: LedgerTxn = { ...body, hash: sha256(stableStringify(body)) };
    try {
      await this.store.append(txn);
    } catch {
      // lost a race with a concurrent identical request: return the winner
      const w = await this.store.findByKey(req.key);
      if (w && w.payloadHash === payloadHash) return { txn: w, replayed: true };
      throw new LedgerError('IDEMPOTENCY_CONFLICT', `key ${req.key} raced with a different payload`);
    }
    return { txn, replayed: false };
  }

  /** Corrections are new entries that negate an earlier transaction. */
  async reverse(txnId: string, key: string, ts: number, memo = 'reversal') {
    const rows = await this.store.all();
    const orig = rows.find((r) => r.id === txnId);
    if (!orig) throw new LedgerError('UNKNOWN_TXN', txnId);
    if (rows.some((r) => r.reverses === txnId)) throw new LedgerError('ALREADY_REVERSED', txnId);
    return this.post({ key, ts, memo: `${memo} of ${txnId}`, reverses: txnId, postings: orig.postings.map((p) => ({ ...p, amount: -p.amount })) });
  }

  /** Balances per account per currency, projected from entries (never stored separately, so they cannot drift). */
  async balances(): Promise<Map<string, Map<string, number>>> {
    const out = new Map<string, Map<string, number>>();
    for (const t of await this.store.all())
      for (const p of t.postings) {
        const m = out.get(p.account) ?? new Map<string, number>();
        m.set(p.currency, (m.get(p.currency) ?? 0) + p.amount);
        out.set(p.account, m);
      }
    return out;
  }
  async balance(account: string, currency: string): Promise<number> {
    return (await this.balances()).get(account)?.get(currency) ?? 0;
  }
  /** The sum of all balances in each currency must be exactly zero. */
  async trialBalance(): Promise<Record<string, number>> {
    const tb: Record<string, number> = {};
    for (const m of (await this.balances()).values()) for (const [c, v] of m) tb[c] = (tb[c] ?? 0) + v;
    return tb;
  }
  /** Re-derive the hash chain; returns the first broken sequence number or null. */
  async verifyChain(): Promise<{ ok: boolean; brokenAt: number | null }> {
    let prev = GENESIS;
    for (const t of await this.store.all()) {
      const { hash, ...body } = t;
      if (t.prevHash !== prev || sha256(stableStringify(body)) !== hash) return { ok: false, brokenAt: t.seq };
      prev = hash;
    }
    return { ok: true, brokenAt: null };
  }
  entries() {
    return this.store.all();
  }
}
