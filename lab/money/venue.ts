import { OrderBook, type Command, type Fill, type BookEvent, type Side } from '@/lab/exchange/orderbook';
import { Ledger } from './ledger';
import { preTradeCheck, DEFAULT_LIMITS, type RiskLimits, type RiskDecision } from './risk';
import { acct, CASH, fillPostings, reconcile, type ReconReport } from './reconcile';
import { sha256 } from '@/lab/core/util';

/** A command plus the context needed for audit/surveillance and idempotent re-submission. */
export interface VenueCommand {
  cmd: Command;
  user: string;
  key?: string; // client idempotency key
}
export interface HistoryRow {
  ts: number;
  user: string;
  op: Command['op'];
  side?: Side;
  price?: number;
  qty?: number;
  id: string;
  events: BookEvent[];
}
export interface SubmitResult {
  status: 'accepted' | 'rejected' | 'duplicate';
  orderId: string;
  risk?: RiskDecision;
  events: BookEvent[];
  fills: Fill[];
}

export const isSim = (u: string) => u.startsWith('sim:');

/**
 * The trading venue = matching engine + ledger + pre-trade risk.
 * State is event-sourced: `commands` is the only thing that has to be persisted. The book is rebuilt by
 * replaying it, and ledger postings are re-applied idempotently by fill id, so a crash/retry never double-books.
 */
export class Venue {
  book = new OrderBook();
  commands: VenueCommand[] = [];
  history: HistoryRow[] = [];
  fills: Fill[] = [];
  users = new Set<string>();
  private keys = new Map<string, string>(); // idempotency key -> order id
  killSwitch = false;
  clock = 0;

  constructor(
    public sym: string,
    public ledger: Ledger,
    public opts: { feeBps: number; limits: RiskLimits } = { feeBps: 1, limits: DEFAULT_LIMITS },
  ) {}

  /** Load persisted commands (market seed + user orders) and rebuild the book without touching the ledger. */
  async hydrate(saved: VenueCommand[]) {
    for (const vc of saved) await this.run(vc, false);
  }

  private async run(vc: VenueCommand, settle: boolean): Promise<{ events: BookEvent[]; fills: Fill[] }> {
    this.commands.push(vc);
    this.clock = Math.max(this.clock, vc.cmd.ts);
    const r = this.book.apply(vc.cmd);
    const o = vc.cmd.op === 'submit' ? vc.cmd.order : null;
    this.history.push({
      ts: vc.cmd.ts, user: vc.user, op: vc.cmd.op, id: vc.cmd.op === 'submit' ? vc.cmd.order.id : vc.cmd.id,
      side: o?.side, price: o?.price, qty: o?.qty ?? (vc.cmd.op === 'replace' ? vc.cmd.qty : undefined), events: r.events,
    });
    if (vc.key && vc.cmd.op === 'submit') this.keys.set(vc.key, vc.cmd.order.id);
    if (!isSim(vc.user)) this.users.add(vc.user);
    for (const f of r.fills) {
      this.fills.push(f);
      if (settle) await this.settle(f);
    }
    return r;
  }

  private async settle(f: Fill) {
    const legs: [string, Side][] = [[f.takerTrader, f.side], [f.makerTrader, f.side === 'buy' ? 'sell' : 'buy']];
    for (const [who, side] of legs) {
      if (isSim(who)) continue;
      const fee = Math.round((f.qty * f.price * this.opts.feeBps) / 10_000);
      await this.ledger.post({
        key: `fill:${f.tradeId}:${who}`, ts: f.ts, memo: `${side} ${f.qty} ${this.sym} @ $${(f.price / 100).toFixed(2)} (trade ${f.tradeId})`,
        postings: fillPostings(who, this.sym, side, f.qty, f.price, fee),
      });
    }
  }

  async deposit(user: string, amountMinor: number, key: string) {
    this.users.add(user);
    return this.ledger.post({
      key: `deposit:${key}`, ts: this.clock, memo: `deposit for ${user}`,
      postings: [{ account: acct.cash(user), currency: CASH, amount: amountMinor }, { account: 'external:funding', currency: CASH, amount: -amountMinor }],
    });
  }

  async riskContext(user: string) {
    const open = this.book.openOrders(user);
    const mid = this.book.mid() ?? 10_000;
    const cash = await this.ledger.balance(acct.cash(user), CASH);
    const position = await this.ledger.balance(acct.pos(user), this.sym);
    const funded = -(await this.ledger.balance('external:funding', CASH));
    const equity = cash + position * mid;
    return {
      cash, position, openOrders: open.length,
      openBuyQty: open.filter((o) => o.side === 'buy').reduce((s, o) => s + o.qty, 0),
      openSellQty: open.filter((o) => o.side === 'sell').reduce((s, o) => s + o.qty, 0),
      referencePrice: mid, dayPnl: funded > 0 ? equity - funded : 0, killSwitch: this.killSwitch,
    };
  }

  /** Idempotent order entry. Replaying the same key returns the original order instead of creating a second one. */
  async submit(user: string, order: { side: Side; type: 'limit' | 'market'; price?: number; qty: number; tif?: 'GTC' | 'IOC' | 'FOK' }, key: string): Promise<SubmitResult> {
    const prior = this.keys.get(`${user}:${key}`);
    if (prior) return { status: 'duplicate', orderId: prior, events: [], fills: [] };
    const orderId = `u_${sha256(`${user}:${key}`).slice(0, 12)}`;
    const risk = preTradeCheck({ side: order.side, qty: order.qty, price: order.type === 'limit' ? order.price : undefined }, await this.riskContext(user), this.opts.limits);
    if (!risk.approved) return { status: 'rejected', orderId, risk, events: [], fills: [] };
    const ts = this.clock + 1;
    const r = await this.run({ user, key: `${user}:${key}`, cmd: { op: 'submit', ts, order: { id: orderId, trader: user, ...order } } }, true);
    const rej = r.events.find((e) => e.kind === 'rejected');
    return { status: rej ? 'rejected' : 'accepted', orderId, risk, events: r.events, fills: r.fills };
  }

  async cancel(user: string, id: string) {
    return this.run({ user, cmd: { op: 'cancel', ts: this.clock + 1, id, trader: user } }, true);
  }

  async reconcile(): Promise<ReconReport> {
    const funded: Record<string, number> = {};
    for (const e of await this.ledger.entries()) if (e.key.startsWith('deposit:')) for (const p of e.postings) if (p.account.startsWith('user:') && p.currency === CASH) {
      const u = p.account.split(':')[1];
      funded[u] = (funded[u] ?? 0) + p.amount;
    }
    return reconcile(this.ledger, this.fills, this.sym, [...this.users], this.opts.feeBps, funded);
  }

  async portfolio(user: string) {
    const ctx = await this.riskContext(user);
    const mid = this.book.mid() ?? 0;
    return { cash: ctx.cash, position: ctx.position, mark: mid, equity: ctx.cash + ctx.position * mid, pnl: ctx.dayPnl, openOrders: this.book.openOrders(user) };
  }
}
