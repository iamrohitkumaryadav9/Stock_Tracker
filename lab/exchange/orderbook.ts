import { sha256, stableStringify } from '@/lab/core/util';

/**
 * Deterministic limit order book with price-time priority.
 * Prices are integer ticks and quantities are integers, so there is no floating-point drift.
 * Every mutation is a Command; the same command log always reproduces the same book and the same state hash.
 */
export type Side = 'buy' | 'sell';
export type TIF = 'GTC' | 'IOC' | 'FOK';

export interface NewOrder {
  id: string;
  trader: string;
  side: Side;
  type: 'limit' | 'market';
  price?: number; // ticks, required for limit
  qty: number;
  tif?: TIF; // market orders behave as IOC
}

export type Command =
  | { op: 'submit'; ts: number; order: NewOrder }
  | { op: 'cancel'; ts: number; id: string; trader: string }
  | { op: 'replace'; ts: number; id: string; trader: string; price: number; qty: number };

export interface Fill {
  tradeId: number;
  ts: number;
  price: number;
  qty: number;
  side: Side; // aggressor (taker) side
  makerOrderId: string;
  takerOrderId: string;
  makerTrader: string;
  takerTrader: string;
}

export type BookEvent =
  | { kind: 'accepted'; ts: number; id: string }
  | { kind: 'rejected'; ts: number; id: string; reason: string }
  | { kind: 'cancelled'; ts: number; id: string; reason: 'user' | 'stp' | 'ioc_remainder' | 'fok_unfilled' | 'replace' }
  | { kind: 'replaced'; ts: number; id: string; keptPriority: boolean }
  | { kind: 'fill'; fill: Fill };

export interface Result {
  events: BookEvent[];
  fills: Fill[];
}

interface Resting {
  id: string;
  trader: string;
  side: Side;
  price: number;
  qty: number;
  seq: number;
  ts: number;
}
interface Level {
  price: number;
  orders: Resting[];
  total: number;
}

export interface DepthLevel {
  price: number;
  qty: number;
  orders: number;
}

export class OrderBook {
  private bids: Level[] = []; // sorted descending by price
  private asks: Level[] = []; // sorted ascending by price
  private index = new Map<string, Resting>();
  private seen = new Set<string>(); // every id ever accepted: ids are never reused
  private seq = 0;
  private tradeSeq = 0;
  readonly log: Command[] = [];
  lastPrice: number | null = null;

  /* ---------- queries ---------- */
  bestBid(): number | null {
    return this.bids.length ? this.bids[0].price : null;
  }
  bestAsk(): number | null {
    return this.asks.length ? this.asks[0].price : null;
  }
  mid(): number | null {
    const b = this.bestBid(), a = this.bestAsk();
    return b !== null && a !== null ? (a + b) / 2 : this.lastPrice;
  }
  spread(): number | null {
    const b = this.bestBid(), a = this.bestAsk();
    return b !== null && a !== null ? a - b : null;
  }
  depth(levels = 10): { bids: DepthLevel[]; asks: DepthLevel[] } {
    const f = (l: Level): DepthLevel => ({ price: l.price, qty: l.total, orders: l.orders.length });
    return { bids: this.bids.slice(0, levels).map(f), asks: this.asks.slice(0, levels).map(f) };
  }
  get(id: string): Resting | undefined {
    return this.index.get(id);
  }
  openOrders(trader?: string): Resting[] {
    return [...this.index.values()].filter((o) => !trader || o.trader === trader);
  }
  /** Volume-weighted microprice from the top of book. */
  microprice(): number | null {
    const b = this.bids[0], a = this.asks[0];
    if (!b || !a) return null;
    return (b.price * a.total + a.price * b.total) / (a.total + b.total);
  }

  /* ---------- commands ---------- */
  apply(cmd: Command): Result {
    this.log.push(cmd);
    if (cmd.op === 'submit') return this.submit(cmd.order, cmd.ts);
    if (cmd.op === 'cancel') return this.cancel(cmd.id, cmd.trader, cmd.ts);
    return this.replace(cmd.id, cmd.trader, cmd.price, cmd.qty, cmd.ts);
  }

  submit(o: NewOrder, ts: number): Result {
    const res: Result = { events: [], fills: [] };
    const reject = (reason: string): Result => {
      res.events.push({ kind: 'rejected', ts, id: o.id, reason });
      return res;
    };
    if (this.seen.has(o.id)) return reject('duplicate_order_id');
    if (!Number.isInteger(o.qty) || o.qty <= 0) return reject('invalid_qty');
    if (o.type === 'limit' && (!Number.isInteger(o.price) || (o.price as number) <= 0)) return reject('invalid_price');
    if (o.side !== 'buy' && o.side !== 'sell') return reject('invalid_side');
    this.seen.add(o.id);
    res.events.push({ kind: 'accepted', ts, id: o.id });

    const tif: TIF = o.type === 'market' ? 'IOC' : o.tif ?? 'GTC';
    const limit = o.type === 'limit' ? (o.price as number) : null;
    const opp = o.side === 'buy' ? this.asks : this.bids;
    const crosses = (lvl: Level) => limit === null || (o.side === 'buy' ? lvl.price <= limit : lvl.price >= limit);

    // FOK: verify full fill is possible (liquidity from other traders, since same-trader resting orders are cancelled by STP)
    if (tif === 'FOK') {
      let avail = 0;
      for (const lvl of opp) {
        if (!crosses(lvl)) break;
        for (const r of lvl.orders) if (r.trader !== o.trader) avail += r.qty;
        if (avail >= o.qty) break;
      }
      if (avail < o.qty) {
        res.events.push({ kind: 'cancelled', ts, id: o.id, reason: 'fok_unfilled' });
        return res;
      }
    }

    let remaining = o.qty;
    while (remaining > 0 && opp.length && crosses(opp[0])) {
      const lvl = opp[0];
      const maker = lvl.orders[0];
      if (maker.trader === o.trader) {
        // Self-trade prevention: cancel the resting order (cancel-resting policy)
        this.removeResting(maker);
        res.events.push({ kind: 'cancelled', ts, id: maker.id, reason: 'stp' });
        continue;
      }
      const q = Math.min(remaining, maker.qty);
      const fill: Fill = {
        tradeId: ++this.tradeSeq,
        ts,
        price: lvl.price,
        qty: q,
        side: o.side,
        makerOrderId: maker.id,
        takerOrderId: o.id,
        makerTrader: maker.trader,
        takerTrader: o.trader,
      };
      this.lastPrice = lvl.price;
      res.fills.push(fill);
      res.events.push({ kind: 'fill', fill });
      remaining -= q;
      maker.qty -= q;
      lvl.total -= q;
      if (maker.qty === 0) {
        lvl.orders.shift();
        this.index.delete(maker.id);
        if (lvl.orders.length === 0) opp.shift();
      }
    }

    if (remaining > 0) {
      if (tif === 'GTC' && limit !== null) {
        this.rest({ id: o.id, trader: o.trader, side: o.side, price: limit, qty: remaining, seq: ++this.seq, ts });
      } else {
        res.events.push({ kind: 'cancelled', ts, id: o.id, reason: 'ioc_remainder' });
      }
    }
    return res;
  }

  cancel(id: string, trader: string, ts: number): Result {
    const res: Result = { events: [], fills: [] };
    const r = this.index.get(id);
    if (!r) res.events.push({ kind: 'rejected', ts, id, reason: 'unknown_order' });
    else if (r.trader !== trader) res.events.push({ kind: 'rejected', ts, id, reason: 'not_owner' });
    else {
      this.removeResting(r);
      res.events.push({ kind: 'cancelled', ts, id, reason: 'user' });
    }
    return res;
  }

  /** Replace keeps queue priority only when price is unchanged and quantity does not increase. */
  replace(id: string, trader: string, price: number, qty: number, ts: number): Result {
    const r = this.index.get(id);
    const res: Result = { events: [], fills: [] };
    if (!r) { res.events.push({ kind: 'rejected', ts, id, reason: 'unknown_order' }); return res; }
    if (r.trader !== trader) { res.events.push({ kind: 'rejected', ts, id, reason: 'not_owner' }); return res; }
    if (!Number.isInteger(qty) || qty <= 0 || !Number.isInteger(price) || price <= 0) {
      res.events.push({ kind: 'rejected', ts, id, reason: 'invalid_replace' });
      return res;
    }
    if (price === r.price && qty <= r.qty) {
      const lvl = this.findLevel(r.side, r.price)!;
      lvl.total -= r.qty - qty;
      r.qty = qty;
      res.events.push({ kind: 'replaced', ts, id, keptPriority: true });
      return res;
    }
    const side = r.side;
    this.removeResting(r);
    this.seen.delete(id); // allow the same id to re-enter as a fresh order
    const sub = this.submit({ id, trader, side, type: 'limit', price, qty, tif: 'GTC' }, ts);
    res.events.push({ kind: 'cancelled', ts, id, reason: 'replace' }, { kind: 'replaced', ts, id, keptPriority: false }, ...sub.events.filter((e) => e.kind !== 'accepted'));
    res.fills.push(...sub.fills);
    return res;
  }

  /* ---------- internals ---------- */
  private findLevel(side: Side, price: number): Level | undefined {
    return (side === 'buy' ? this.bids : this.asks).find((l) => l.price === price);
  }
  private rest(r: Resting) {
    const arr = r.side === 'buy' ? this.bids : this.asks;
    const better = (a: number, b: number) => (r.side === 'buy' ? a > b : a < b);
    let i = 0;
    while (i < arr.length && better(arr[i].price, r.price)) i++;
    if (i < arr.length && arr[i].price === r.price) {
      arr[i].orders.push(r);
      arr[i].total += r.qty;
    } else arr.splice(i, 0, { price: r.price, orders: [r], total: r.qty });
    this.index.set(r.id, r);
  }
  private removeResting(r: Resting) {
    const arr = r.side === 'buy' ? this.bids : this.asks;
    const i = arr.findIndex((l) => l.price === r.price);
    if (i >= 0) {
      const lvl = arr[i];
      const j = lvl.orders.findIndex((x) => x.id === r.id);
      if (j >= 0) lvl.orders.splice(j, 1);
      lvl.total -= r.qty;
      if (lvl.orders.length === 0) arr.splice(i, 1);
    }
    this.index.delete(r.id);
  }

  /* ---------- integrity ---------- */
  /** Returns a list of violated invariants (empty = healthy). Used by tests and the /lab health panel. */
  checkInvariants(): string[] {
    const errs: string[] = [];
    const b = this.bestBid(), a = this.bestAsk();
    if (b !== null && a !== null && b >= a) errs.push(`crossed book: bid ${b} >= ask ${a}`);
    for (const [name, side] of [['bids', this.bids], ['asks', this.asks]] as const) {
      for (let i = 0; i < side.length; i++) {
        const lvl = side[i];
        const tot = lvl.orders.reduce((s, o) => s + o.qty, 0);
        if (tot !== lvl.total) errs.push(`${name} level ${lvl.price}: total ${lvl.total} != sum ${tot}`);
        if (lvl.orders.length === 0) errs.push(`${name} level ${lvl.price}: empty level retained`);
        if (i > 0 && (name === 'bids' ? side[i - 1].price <= lvl.price : side[i - 1].price >= lvl.price)) errs.push(`${name}: levels not strictly sorted`);
        for (let j = 1; j < lvl.orders.length; j++) if (lvl.orders[j - 1].seq >= lvl.orders[j].seq) errs.push(`${name} ${lvl.price}: time priority violated`);
        for (const o of lvl.orders) if (o.qty <= 0) errs.push(`order ${o.id} has non-positive qty`);
      }
    }
    const indexed = this.bids.reduce((s, l) => s + l.orders.length, 0) + this.asks.reduce((s, l) => s + l.orders.length, 0);
    if (indexed !== this.index.size) errs.push(`index size ${this.index.size} != resting orders ${indexed}`);
    return errs;
  }

  /** Canonical hash of book state: two books with the same hash are identical (used to prove deterministic replay). */
  stateHash(): string {
    const snap = (ls: Level[]) => ls.map((l) => [l.price, l.orders.map((o) => [o.id, o.trader, o.qty])]);
    return sha256(stableStringify({ bids: snap(this.bids), asks: snap(this.asks), trades: this.tradeSeq }));
  }

  static replay(commands: Command[]): { book: OrderBook; fills: Fill[] } {
    const book = new OrderBook();
    const fills: Fill[] = [];
    for (const c of commands) fills.push(...book.apply(c).fills);
    return { book, fills };
  }
}
