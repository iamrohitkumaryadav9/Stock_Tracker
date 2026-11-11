import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import net from 'node:net';

vi.mock('@/lab/server/auth', () => ({ requireUser: async () => ({ id: 'mongo-user', name: 'Tester' }) }));

const URI = 'mongodb://127.0.0.1:27017/quantis_lab_test'; // throwaway database, dropped afterwards
const up = await new Promise<boolean>((res) => { const s = net.connect(27017, '127.0.0.1').once('connect', () => { s.destroy(); res(true); }).once('error', () => res(false)); });

describe.skipIf(!up)('lab API with real MongoDB storage', () => {
  let route: typeof import('@/app/api/lab/[action]/route');
  let store: typeof import('@/lab/server/store');
  beforeAll(async () => {
    process.env.MONGODB_URI = URI;
    store = await import('@/lab/server/store');
    route = await import('@/app/api/lab/[action]/route');
  });
  afterAll(async () => {
    const db = await store.labDb();
    await db?.dropDatabase();
    const { default: mongoose } = await import('mongoose');
    await mongoose.disconnect();
  });
  const post = async (action: string, body: unknown) => {
    const res = await route.POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ action }) });
    return res.json();
  };
  const get = async (action: string) => (await route.GET(new Request('http://x'), { params: Promise.resolve({ action }) })).json();

  it('persists event-sourced venue state, enforces unique idempotency keys, and the ledger chain verifies', async () => {
    expect((await get('overview')).storage).toBe('mongodb');
    await post('venue', { op: 'reset' });
    await post('venue', { op: 'deposit', amount: 5000, key: 'dep' });
    const a = await post('venue', { op: 'order', side: 'buy', type: 'market', qty: 7, key: 'm1' });
    expect(a.result.status).toBe('accepted');
    const dup = await post('venue', { op: 'order', side: 'buy', type: 'market', qty: 7, key: 'm1' });
    expect(dup.result.status).toBe('duplicate');
    const s = await get('venue');
    expect(s.portfolio.position).toBe(7);
    expect(s.recon.clean).toBe(true);
    expect(s.ledger.chain.ok).toBe(true);
    const db = (await store.labDb())!;
    expect(await db.collection('lab_venue').countDocuments({ sessionId: 'venue:mongo-user' })).toBe(1);
    // storage layer is the last-line guard: inserting a second entry with an existing key must fail
    const row = await db.collection('lab_ledger').findOne({ ledgerId: 'venue:mongo-user' });
    await expect(db.collection('lab_ledger').insertOne({ ...row!, _id: undefined as never, seq: 999 })).rejects.toThrow(/duplicate key/);
  }, 60000);

  it('decision log persists and detects tampering made directly in the database', async () => {
    await post('logdecision', { ticker: 'HLGD', asOf: Date.UTC(2025, 5, 2, 21) });
    await post('logdecision', { ticker: 'MRDB', asOf: Date.UTC(2025, 5, 3, 21) });
    expect((await get('log')).verify.ok).toBe(true);
    const db = (await store.labDb())!;
    await db.collection('lab_log').updateOne({ logId: 'log:mongo-user', seq: 1 }, { $set: { 'payload.weight': 0.99 } });
    expect((await get('log')).verify).toMatchObject({ ok: false, brokenAt: 1 });
  }, 60000);
});
