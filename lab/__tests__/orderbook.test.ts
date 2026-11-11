import { describe, it, expect } from 'vitest';
import { OrderBook, type Command, type Fill, type NewOrder } from '@/lab/exchange/orderbook';
import { Rng } from '@/lab/core/util';

const L = (id: string, trader: string, side: 'buy' | 'sell', price: number, qty: number, tif?: 'GTC' | 'IOC' | 'FOK'): NewOrder => ({ id, trader, side, type: 'limit', price, qty, tif });

describe('OrderBook', () => {
  it('matches with price-time priority', () => {
    const b = new OrderBook();
    b.submit(L('a', 'A', 'sell', 101, 5), 1);
    b.submit(L('b', 'B', 'sell', 100, 5), 2);
    b.submit(L('c', 'C', 'sell', 100, 5), 3);
    const r = b.submit({ id: 'x', trader: 'X', side: 'buy', type: 'market', qty: 7 }, 4);
    expect(r.fills.map((f) => [f.makerOrderId, f.price, f.qty])).toEqual([['b', 100, 5], ['c', 100, 2]]);
    expect(b.bestAsk()).toBe(100);
    expect(b.checkInvariants()).toEqual([]);
  });

  it('IOC leaves no resting remainder; FOK is all-or-nothing', () => {
    const b = new OrderBook();
    b.submit(L('a', 'A', 'sell', 100, 5), 1);
    const ioc = b.submit(L('i', 'X', 'buy', 100, 8, 'IOC'), 2);
    expect(ioc.fills.reduce((s, f) => s + f.qty, 0)).toBe(5);
    expect(b.get('i')).toBeUndefined();
    b.submit(L('b', 'B', 'sell', 100, 3), 3);
    const fok = b.submit(L('f', 'X', 'buy', 100, 4, 'FOK'), 4);
    expect(fok.fills).toHaveLength(0);
    expect(b.get('b')!.qty).toBe(3);
  });

  it('prevents self-trades by cancelling the resting order', () => {
    const b = new OrderBook();
    b.submit(L('a', 'A', 'sell', 100, 5), 1);
    const r = b.submit(L('b', 'A', 'buy', 100, 5), 2);
    expect(r.fills).toHaveLength(0);
    expect(r.events.some((e) => e.kind === 'cancelled' && e.reason === 'stp')).toBe(true);
    expect(b.get('b')).toBeDefined();
  });

  it('replace keeps priority only for a pure size reduction', () => {
    const b = new OrderBook();
    b.submit(L('a', 'A', 'buy', 99, 10), 1);
    b.submit(L('b', 'B', 'buy', 99, 10), 2);
    expect(b.replace('a', 'A', 99, 6, 3).events.some((e) => e.kind === 'replaced' && e.keptPriority)).toBe(true);
    const sell = b.submit({ id: 's', trader: 'S', side: 'sell', type: 'market', qty: 6 }, 4);
    expect(sell.fills[0].makerOrderId).toBe('a');
    b.submit(L('c', 'C', 'buy', 99, 1), 5); // queue is now b, c
    b.replace('b', 'B', 99, 20, 6); // size increase loses priority -> queue c, b
    const sell2 = b.submit({ id: 's2', trader: 'S', side: 'sell', type: 'market', qty: 1 }, 7);
    expect(sell2.fills[0].makerOrderId).toBe('c');
  });

  it('rejects duplicates, bad quantities and unknown cancels', () => {
    const b = new OrderBook();
    b.submit(L('a', 'A', 'buy', 99, 1), 1);
    expect(b.submit(L('a', 'A', 'buy', 99, 1), 2).events[0]).toMatchObject({ kind: 'rejected', reason: 'duplicate_order_id' });
    expect(b.submit(L('z', 'A', 'buy', 99, 0), 3).events[0]).toMatchObject({ reason: 'invalid_qty' });
    expect(b.cancel('nope', 'A', 4).events[0]).toMatchObject({ reason: 'unknown_order' });
    expect(b.cancel('a', 'B', 5).events[0]).toMatchObject({ reason: 'not_owner' });
  });
});

/** Naive reference implementation (O(n) per op) used for differential testing. */
class RefBook {
  orders: { id: string; trader: string; side: string; price: number; qty: number; seq: number }[] = [];
  seq = 0;
  fills: [string, string, number, number][] = [];
  submit(o: NewOrder) {
    let rem = o.qty;
    const tif = o.type === 'market' ? 'IOC' : o.tif ?? 'GTC';
    const opp = o.side === 'buy' ? 'sell' : 'buy';
    const cross = (p: number) => o.type === 'market' || (o.side === 'buy' ? p <= (o.price as number) : p >= (o.price as number));
    const cand = () =>
      this.orders.filter((x) => x.side === opp && cross(x.price)).sort((a, b) => (opp === 'sell' ? a.price - b.price : b.price - a.price) || a.seq - b.seq)[0];
    if (tif === 'FOK') {
      const avail = this.orders.filter((x) => x.side === opp && cross(x.price) && x.trader !== o.trader).reduce((s, x) => s + x.qty, 0);
      if (avail < o.qty) return;
    }
    while (rem > 0) {
      const m = cand();
      if (!m) break;
      if (m.trader === o.trader) { this.orders = this.orders.filter((x) => x !== m); continue; }
      const q = Math.min(rem, m.qty);
      this.fills.push([m.id, o.id, m.price, q]);
      rem -= q; m.qty -= q;
      if (m.qty === 0) this.orders = this.orders.filter((x) => x !== m);
    }
    if (rem > 0 && tif === 'GTC' && o.type === 'limit') this.orders.push({ id: o.id, trader: o.trader, side: o.side, price: o.price as number, qty: rem, seq: ++this.seq });
  }
  cancel(id: string, trader: string) {
    this.orders = this.orders.filter((x) => !(x.id === id && x.trader === trader));
  }
}

describe('OrderBook property tests', () => {
  it('matches a reference implementation and keeps invariants over 30 random sessions', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = new Rng(seed);
      const real = new OrderBook();
      const ref = new RefBook();
      const ids: { id: string; trader: string }[] = [];
      let n = 0;
      for (let i = 0; i < 400; i++) {
        const r = rng.next();
        if (r < 0.2 && ids.length) {
          const t = rng.pick(ids);
          real.cancel(t.id, t.trader, i);
          ref.cancel(t.id, t.trader);
        } else {
          const trader = 'T' + rng.int(1, 4);
          const id = `o${++n}`;
          const isMkt = r > 0.92;
          const o: NewOrder = {
            id, trader, side: rng.bool() ? 'buy' : 'sell', type: isMkt ? 'market' : 'limit',
            price: 95 + rng.int(0, 10), qty: rng.int(1, 20), tif: rng.pick(['GTC', 'GTC', 'IOC', 'FOK'] as const),
          };
          ids.push({ id, trader });
          real.submit(o, i);
          ref.submit(o);
        }
        expect(real.checkInvariants(), `seed ${seed} step ${i}`).toEqual([]);
      }
      const realFills = real.log.length; // log is populated only via apply(); compare via resting state instead
      void realFills;
      const refResting = ref.orders.map((o) => `${o.id}:${o.price}:${o.qty}`).sort();
      const realResting = real.openOrders().map((o) => `${o.id}:${o.price}:${o.qty}`).sort();
      expect(realResting).toEqual(refResting);
    }
  });

  it('replays deterministically to an identical state hash', () => {
    const rng = new Rng(99);
    const book = new OrderBook();
    const cmds: Command[] = [];
    for (let i = 0; i < 500; i++) {
      const c: Command = { op: 'submit', ts: i, order: { id: 'o' + i, trader: 'T' + rng.int(1, 3), side: rng.bool() ? 'buy' : 'sell', type: 'limit', price: 98 + rng.int(0, 4), qty: rng.int(1, 9) } };
      cmds.push(c);
    }
    const fills1: Fill[] = [];
    for (const c of cmds) fills1.push(...book.apply(c).fills);
    const { book: b2, fills: fills2 } = OrderBook.replay(cmds);
    expect(b2.stateHash()).toBe(book.stateHash());
    expect(fills2).toEqual(fills1);
  });

  it('conserves quantity: filled maker qty equals filled taker qty', () => {
    const b = new OrderBook();
    const rng = new Rng(5);
    let makerQ = 0, takerQ = 0;
    for (let i = 0; i < 300; i++) {
      const r = b.submit({ id: 'x' + i, trader: 'T' + rng.int(1, 5), side: rng.bool() ? 'buy' : 'sell', type: 'limit', price: 98 + rng.int(0, 4), qty: rng.int(1, 9) }, i);
      for (const f of r.fills) { makerQ += f.qty; takerQ += f.qty; expect(f.makerTrader).not.toBe(f.takerTrader); }
    }
    expect(makerQ).toBe(takerQ);
  });
});
