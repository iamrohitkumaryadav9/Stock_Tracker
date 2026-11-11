import { describe, it, expect } from 'vitest';
import { Venue } from '@/lab/money/venue';
import { Ledger, MemoryLedgerStore } from '@/lab/money/ledger';
import { Simulation, DEFAULT_SIM } from '@/lab/exchange/simulator';
import { analyze } from '@/lab/money/surveillance';
import { acct } from '@/lab/money/reconcile';

async function seeded() {
  const sim = new Simulation({ ...DEFAULT_SIM, seed: 11 }).run(120);
  const ledger = new Ledger(new MemoryLedgerStore());
  const v = new Venue('QNT', ledger);
  await v.hydrate(sim.commands.map((cmd) => ({ cmd, user: (cmd.op === 'submit' ? cmd.order.trader : (cmd as { trader: string }).trader) })));
  return { v, ledger };
}

describe('Venue', () => {
  it('settles fills through the ledger and reconciles cleanly', async () => {
    const { v, ledger } = await seeded();
    await v.deposit('alice', 1_000_000, 'seed');
    const ask = v.book.bestAsk()!;
    const r = await v.submit('alice', { side: 'buy', type: 'market', qty: 10 }, 'k1');
    expect(r.status).toBe('accepted');
    expect(r.fills.length).toBeGreaterThan(0);
    expect(await ledger.balance(acct.pos('alice'), 'QNT')).toBe(10);
    expect(await ledger.balance(acct.cash('alice'), 'USD')).toBeLessThan(1_000_000 - 10 * ask + 1);
    expect(Object.values(await ledger.trialBalance()).every((x) => x === 0)).toBe(true);
    const rep = await v.reconcile();
    expect(rep.clean, JSON.stringify(rep.breaks)).toBe(true);
  });

  it('is idempotent: the same key never creates a second order or double-books', async () => {
    const { v, ledger } = await seeded();
    await v.deposit('bob', 1_000_000, 'seed');
    await v.submit('bob', { side: 'buy', type: 'market', qty: 5 }, 'same');
    const before = (await ledger.entries()).length;
    const again = await v.submit('bob', { side: 'buy', type: 'market', qty: 5 }, 'same');
    expect(again.status).toBe('duplicate');
    expect((await ledger.entries()).length).toBe(before);
  });

  it('rejects with explainable reasons when cash is insufficient', async () => {
    const { v } = await seeded();
    await v.deposit('carol', 1_000, 'seed');
    const r = await v.submit('carol', { side: 'buy', type: 'market', qty: 100 }, 'k');
    expect(r.status).toBe('rejected');
    expect(r.risk!.reasons.map((x) => x.code)).toContain('INSUFFICIENT_CASH');
  });

  it('reconciliation flags a missing ledger entry and never auto-corrects', async () => {
    const { v, ledger } = await seeded();
    await v.deposit('dan', 1_000_000, 'seed');
    await v.submit('dan', { side: 'buy', type: 'market', qty: 4 }, 'k');
    // simulate an operational fault: drop the venue's knowledge of the ledger by checking with an empty ledger
    const empty = new Ledger(new MemoryLedgerStore());
    const v2 = new Venue('QNT', empty);
    v2.fills = v.fills;
    v2.users = new Set(['dan']);
    const rep = await v2.reconcile();
    expect(rep.clean).toBe(false);
    expect(rep.breaks.some((b) => b.type === 'MISSING_IN_LEDGER')).toBe(true);
    expect(rep.note).toMatch(/No automatic correction/);
    void ledger;
  });

  it('surveillance flags a wash-trade attempt', async () => {
    const { v } = await seeded();
    await v.deposit('eve', 10_000_000, 'seed');
    await v.submit('eve', { side: 'buy', type: 'market', qty: 20 }, 'own'); // eve now holds shares
    expect(v.book.bestAsk()! - v.book.bestBid()!).toBeGreaterThanOrEqual(2); // room to improve the bid
    const bid = v.book.bestBid()! + 1; // new best bid, alone at the top of the queue
    const rest = await v.submit('eve', { side: 'buy', type: 'limit', price: bid, qty: 3 }, 'rest');
    expect(rest.status).toBe('accepted');
    // eve now sells at a price that crosses her own resting bid first
    const hit = await v.submit('eve', { side: 'sell', type: 'limit', price: bid - 1, qty: 3 }, 'wash');
    expect(hit.events.some((e) => e.kind === 'cancelled' && e.reason === 'stp') || hit.fills.length > 0).toBe(true);
    const { alerts } = analyze(v.history);
    const wash = alerts.filter((a) => a.user === 'eve' && a.rule === 'WASH_TRADE_ATTEMPT');
    expect(wash.length).toBe(1);
    expect(wash[0].evidence.stpHits).toBeGreaterThan(0);
  });
});
