import { describe, it, expect } from 'vitest';
import { Simulation, DEFAULT_SIM } from '@/lab/exchange/simulator';
import { stylizedFacts } from '@/lab/exchange/stylized';
import { OrderBook } from '@/lab/exchange/orderbook';
import { Ledger, MemoryLedgerStore, LedgerError } from '@/lab/money/ledger';
import { preTradeCheck, DEFAULT_LIMITS } from '@/lab/money/risk';

describe('Simulation', () => {
  it('is reproducible from a seed and replays to the same book hash', () => {
    const a = new Simulation({ ...DEFAULT_SIM, seed: 7 }).run(300);
    const b = new Simulation({ ...DEFAULT_SIM, seed: 7 }).run(300);
    expect(a.book.stateHash()).toBe(b.book.stateHash());
    expect(OrderBook.replay(a.commands).book.stateHash()).toBe(a.book.stateHash());
    expect(a.book.checkInvariants()).toEqual([]);
    expect(a.fills.length).toBeGreaterThan(50);
  });

  it('reports stylised facts', () => {
    const sim = new Simulation({ ...DEFAULT_SIM, seed: 3 }).run(3000);
    const facts = stylizedFacts(sim);
    console.log(facts.map((f) => `${f.pass ? 'PASS' : 'FAIL'} ${f.name} = ${f.value.toFixed(3)}`).join('\n'));
    expect(facts.length).toBeGreaterThan(5);
  });
});

describe('Ledger', () => {
  const mk = () => new Ledger(new MemoryLedgerStore());
  const pay = (key: string, amt: number) => ({ key, ts: 1, memo: 'm', postings: [{ account: 'a', currency: 'USD', amount: -amt }, { account: 'b', currency: 'USD', amount: amt }] });

  it('rejects unbalanced transactions', async () => {
    await expect(mk().post({ key: 'k', ts: 1, memo: '', postings: [{ account: 'a', currency: 'USD', amount: 5 }] })).rejects.toMatchObject({ code: 'UNBALANCED' });
  });
  it('is idempotent and detects key reuse with a different payload', async () => {
    const l = mk();
    const r1 = await l.post(pay('k1', 100));
    const r2 = await l.post(pay('k1', 100));
    expect(r2.replayed).toBe(true);
    expect(r2.txn.id).toBe(r1.txn.id);
    expect((await l.entries()).length).toBe(1);
    await expect(l.post(pay('k1', 999))).rejects.toBeInstanceOf(LedgerError);
  });
  it('reverses by adding entries, keeps trial balance at zero and a valid hash chain', async () => {
    const l = mk();
    const t = await l.post(pay('k1', 100));
    await l.post(pay('k2', 50));
    await l.reverse(t.txn.id, 'rev1', 2);
    expect(await l.balance('b', 'USD')).toBe(50);
    expect(Object.values(await l.trialBalance()).every((v) => v === 0)).toBe(true);
    expect((await l.verifyChain()).ok).toBe(true);
    await expect(l.reverse(t.txn.id, 'rev2', 3)).rejects.toMatchObject({ code: 'ALREADY_REVERSED' });
  });
  it('detects tampering', async () => {
    const store = new MemoryLedgerStore();
    const l = new Ledger(store);
    await l.post(pay('k1', 100));
    await l.post(pay('k2', 50));
    const rows = await store.all();
    (rows[0].postings[0] as { amount: number }).amount = -1; // mutate history
    // MemoryLedgerStore.all() returns a copy of the array but shares objects, so this mutates stored data
    expect((await l.verifyChain()).ok).toBe(false);
  });
});

describe('Risk engine', () => {
  const ctx = { cash: 100_000, position: 0, openOrders: 0, openBuyQty: 0, openSellQty: 0, referencePrice: 100, dayPnl: 0, killSwitch: false };
  it('approves a sane order and explains rejections', () => {
    expect(preTradeCheck({ side: 'buy', qty: 10, price: 100 }, ctx).approved).toBe(true);
    const d = preTradeCheck({ side: 'buy', qty: 5000, price: 150 }, ctx);
    expect(d.approved).toBe(false);
    const codes = d.reasons.map((r) => r.code);
    expect(codes).toContain('MAX_ORDER_QTY');
    expect(codes).toContain('PRICE_COLLAR');
    expect(codes).toContain('INSUFFICIENT_CASH');
    expect(preTradeCheck({ side: 'sell', qty: 1 }, ctx).reasons[0].code).toBe('INSUFFICIENT_SHARES');
    expect(preTradeCheck({ side: 'buy', qty: 1 }, { ...ctx, killSwitch: true }, DEFAULT_LIMITS).reasons[0].code).toBe('KILL_SWITCH');
  });
});
