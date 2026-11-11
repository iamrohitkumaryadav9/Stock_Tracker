import type { Db } from 'mongodb';
import { connectToDatabase } from '@/database/mongoose';
import type { LedgerStore, LedgerTxn } from '@/lab/money/ledger';
import type { LogEntry, LogStore } from '@/lab/eval/decisionlog';
import type { VenueCommand } from '@/lab/money/venue';
import { MemoryLedgerStore } from '@/lab/money/ledger';
import { MemoryLogStore } from '@/lab/eval/decisionlog';

/**
 * Persistence for the lab. MongoDB when reachable (Atlas on Vercel, local otherwise); otherwise an in-process
 * fallback so the lab still runs (state then lasts only for the life of the server instance, which the UI says).
 */
declare global {
  // eslint-disable-next-line no-var
  var __labMem: { ledgers: Map<string, MemoryLedgerStore>; logs: Map<string, MemoryLogStore>; venue: Map<string, VenueCommand[]>; memory: Map<string, unknown>; killed: Set<string> } | undefined;
}
const mem = (globalThis.__labMem ??= { ledgers: new Map(), logs: new Map(), venue: new Map(), memory: new Map(), killed: new Set() });

let dbPromise: Promise<Db | null> | null = null;
export async function labDb(): Promise<Db | null> {
  dbPromise ??= (async () => {
    try {
      const m = await connectToDatabase();
      return (m.connection.db as unknown as Db) ?? null;
    } catch {
      return null;
    }
  })();
  const db = await dbPromise;
  if (!db) dbPromise = null; // retry next time
  return db;
}
export const storageMode = async (): Promise<'mongodb' | 'memory'> => ((await labDb()) ? 'mongodb' : 'memory');

const indexed = new Set<string>();
async function ensureIndexes(db: Db) {
  if (indexed.has('x')) return;
  indexed.add('x');
  await db.collection('lab_ledger').createIndexes([{ key: { ledgerId: 1, seq: 1 }, unique: true }, { key: { ledgerId: 1, key: 1 }, unique: true }]);
  await db.collection('lab_log').createIndexes([{ key: { logId: 1, seq: 1 }, unique: true }]);
  await db.collection('lab_venue').createIndexes([{ key: { sessionId: 1, n: 1 }, unique: true }]);
}

class MongoLedgerStore implements LedgerStore {
  constructor(private db: Db, private id: string) {}
  async all(): Promise<LedgerTxn[]> {
    return (await this.db.collection('lab_ledger').find({ ledgerId: this.id }, { projection: { _id: 0, ledgerId: 0 } }).sort({ seq: 1 }).toArray()) as unknown as LedgerTxn[];
  }
  async findByKey(key: string) {
    return (await this.db.collection('lab_ledger').findOne({ ledgerId: this.id, key }, { projection: { _id: 0, ledgerId: 0 } })) as unknown as LedgerTxn | null;
  }
  async append(t: LedgerTxn) {
    await this.db.collection('lab_ledger').insertOne({ ...t, ledgerId: this.id }); // unique indexes make this the last-line idempotency guard
  }
}
class MongoLogStore implements LogStore {
  constructor(private db: Db, private id: string) {}
  async all(): Promise<LogEntry[]> {
    return (await this.db.collection('lab_log').find({ logId: this.id }, { projection: { _id: 0, logId: 0 } }).sort({ seq: 1 }).toArray()) as unknown as LogEntry[];
  }
  async append(e: LogEntry) {
    await this.db.collection('lab_log').insertOne({ ...e, logId: this.id });
  }
}

export async function ledgerStore(id: string): Promise<LedgerStore> {
  const db = await labDb();
  if (db) { await ensureIndexes(db); return new MongoLedgerStore(db, id); }
  return mem.ledgers.get(id) ?? mem.ledgers.set(id, new MemoryLedgerStore()).get(id)!;
}
export async function logStore(id: string): Promise<LogStore> {
  const db = await labDb();
  if (db) { await ensureIndexes(db); return new MongoLogStore(db, id); }
  return mem.logs.get(id) ?? mem.logs.set(id, new MemoryLogStore()).get(id)!;
}

/* ---- venue command log (event sourcing: this is the only state we persist for the exchange) ---- */
export async function loadVenueCommands(sessionId: string): Promise<VenueCommand[]> {
  const db = await labDb();
  if (db) {
    await ensureIndexes(db);
    const rows = await db.collection('lab_venue').find({ sessionId }).sort({ n: 1 }).toArray();
    return rows.map((r) => r.vc as VenueCommand);
  }
  return [...(mem.venue.get(sessionId) ?? [])];
}
export async function appendVenueCommand(sessionId: string, n: number, vc: VenueCommand) {
  const db = await labDb();
  if (db) { await ensureIndexes(db); await db.collection('lab_venue').insertOne({ sessionId, n, vc }); return; }
  const arr = mem.venue.get(sessionId) ?? [];
  arr.push(vc);
  mem.venue.set(sessionId, arr);
}
export async function resetVenue(sessionId: string) {
  const db = await labDb();
  if (db) {
    await db.collection('lab_venue').deleteMany({ sessionId });
    await db.collection('lab_ledger').deleteMany({ ledgerId: sessionId });
  }
  mem.venue.delete(sessionId);
  mem.ledgers.delete(sessionId);
  mem.killed.delete(sessionId);
}

/* ---- small per-user documents ---- */
export async function loadDoc<T>(coll: string, id: string): Promise<T | null> {
  const db = await labDb();
  if (db) { const r = await db.collection(coll).findOne({ _id: id as never }); return (r?.doc as T) ?? null; }
  return (mem.memory.get(`${coll}:${id}`) as T) ?? null;
}
export async function saveDoc<T>(coll: string, id: string, doc: T) {
  const db = await labDb();
  if (db) { await db.collection(coll).updateOne({ _id: id as never }, { $set: { doc } }, { upsert: true }); return; }
  mem.memory.set(`${coll}:${id}`, doc);
}
export const killSwitchSet = mem.killed;
