import { Rng, mean } from '@/lab/core/util';
import { OrderBook, type Command, type Fill, type Side } from './orderbook';

/**
 * Seeded agent-based market simulator: market makers, noise traders and informed traders trading
 * through the real matching engine. Used for (1) the live exchange sandbox, (2) training/evaluating
 * limit-order-book models, (3) RL execution experiments, (4) realism (stylised-fact) checks.
 */
export interface SimConfig {
  seed: number;
  startPrice: number; // ticks (cents)
  nMarketMakers: number;
  nNoise: number;
  nInformed: number;
  fundVol: number; // per-step fundamental volatility in ticks
  jumpProb: number;
  jumpSize: number;
  mmHalfSpread: number; // ticks
  mmSize: number;
  noiseRate: number; // prob. each noise trader acts per step
  informedEdge: number; // ticks of mispricing needed before informed trader acts
  mmInventorySkew: number; // ticks of quote shift per unit inventory (Avellaneda-Stoikov-style skew; 0 = symmetric)
  mmInventoryRisk?: number;
}
export const DEFAULT_SIM: SimConfig = {
  seed: 1, startPrice: 10_000, nMarketMakers: 2, nNoise: 12, nInformed: 2,
  fundVol: 1.2, jumpProb: 0.01, jumpSize: 12, mmHalfSpread: 2, mmSize: 25,
  noiseRate: 0.35, informedEdge: 3, mmInventorySkew: 0.02,
};

export interface Snapshot {
  t: number;
  mid: number;
  spread: number;
  micro: number;
  bidPx: number[]; bidQty: number[]; askPx: number[]; askQty: number[];
  flow: number; // signed aggressor volume this step (+buy)
  fundamental: number;
}
export interface Candle { t: number; o: number; h: number; l: number; c: number; v: number }

export class Simulation {
  book = new OrderBook();
  rng: Rng;
  t = 0;
  fund: number;
  commands: Command[] = [];
  fills: Fill[] = [];
  snapshots: Snapshot[] = [];
  private seq = 0;
  private mmQuotes = new Map<string, string[]>();
  private mmInv = new Map<string, number>();
  private noiseOrders = new Map<string, string[]>();
  private lastMid: number;
  private stepFlow = 0;
  /** per-market-maker realised cash flow (ticks*qty) and inventory, for market-making PnL studies */
  mmCash = new Map<string, number>();

  constructor(public cfg: SimConfig = DEFAULT_SIM) {
    this.rng = new Rng(cfg.seed);
    this.fund = cfg.startPrice;
    this.lastMid = cfg.startPrice;
  }

  private oid(prefix: string) {
    return `${prefix}${++this.seq}`;
  }
  exec(cmd: Command): ReturnType<OrderBook['apply']> {
    this.commands.push(cmd);
    const r = this.book.apply(cmd);
    for (const f of r.fills) {
      this.fills.push(f);
      this.stepFlow += f.side === 'buy' ? f.qty : -f.qty;
      for (const [who, s] of [[f.makerTrader, f.side === 'buy' ? 'sell' : 'buy'], [f.takerTrader, f.side]] as const) {
        if (!who.startsWith('sim:mm')) continue;
        const sg = s === 'buy' ? 1 : -1;
        this.mmInv.set(who, (this.mmInv.get(who) ?? 0) + sg * f.qty);
        this.mmCash.set(who, (this.mmCash.get(who) ?? 0) - sg * f.qty * f.price);
      }
    }
    return r;
  }
  mmInventory(id: string) { return this.mmInv.get(id) ?? 0; }
  mmPnl(id: string, mark: number) { return (this.mmCash.get(id) ?? 0) + (this.mmInv.get(id) ?? 0) * mark; }

  private limit(trader: string, side: Side, price: number, qty: number, prefix: string) {
    const id = this.oid(prefix);
    this.exec({ op: 'submit', ts: this.t, order: { id, trader, side, type: 'limit', price: Math.max(1, Math.round(price)), qty } });
    return id;
  }

  step() {
    const c = this.cfg, rng = this.rng;
    this.t++;
    this.stepFlow = 0;
    // fundamental: diffusion + rare jumps
    this.fund += c.fundVol * rng.normal() + (rng.next() < c.jumpProb ? (rng.bool() ? 1 : -1) * c.jumpSize : 0);
    this.fund = Math.max(50, this.fund);
    const mid = this.book.mid() ?? this.lastMid;
    this.lastMid = mid;

    // market makers re-quote around mid (blend of book mid and slow fundamental belief)
    for (let m = 1; m <= c.nMarketMakers; m++) {
      const id = `sim:mm${m}`;
      for (const q of this.mmQuotes.get(id) ?? []) this.exec({ op: 'cancel', ts: this.t, id: q, trader: id });
      const inv = this.mmInv.get(id) ?? 0;
      const belief = 0.7 * mid + 0.3 * this.fund;
      const shift = -c.mmInventorySkew * inv;
      const hs = c.mmHalfSpread + (m - 1);
      const qs: string[] = [];
      for (let lvl = 0; lvl < 3; lvl++) {
        const size = Math.max(1, Math.round(c.mmSize * (1 - 0.25 * lvl)));
        qs.push(this.limit(id, 'buy', belief + shift - hs - lvl * 2, size, 'm'));
        qs.push(this.limit(id, 'sell', belief + shift + hs + lvl * 2, size, 'm'));
      }
      this.mmQuotes.set(id, qs);
    }

    // noise traders: random market or passive limit orders; they also cancel stale quotes
    for (let n = 1; n <= c.nNoise; n++) {
      if (rng.next() > c.noiseRate) continue;
      const id = `sim:n${n}`;
      const side: Side = rng.bool() ? 'buy' : 'sell';
      const r = rng.next();
      if (r < 0.3) this.exec({ op: 'submit', ts: this.t, order: { id: this.oid('n'), trader: id, side, type: 'market', qty: rng.int(1, 8) } });
      else if (r < 0.9) {
        const off = 1 + Math.floor(-Math.log(Math.max(rng.next(), 1e-9)) * 2.5);
        const lid = this.limit(id, side, side === 'buy' ? mid - off : mid + off, rng.int(1, 10), 'n');
        const arr = this.noiseOrders.get(id) ?? [];
        arr.push(lid);
        this.noiseOrders.set(id, arr);
      } else {
        const arr = this.noiseOrders.get(id) ?? [];
        const old = arr.shift();
        if (old) this.exec({ op: 'cancel', ts: this.t, id: old, trader: id });
      }
    }

    // informed traders act when price deviates from fundamental
    for (let i = 1; i <= c.nInformed; i++) {
      const dev = this.fund - mid;
      if (Math.abs(dev) > c.informedEdge && rng.next() < 0.5)
        this.exec({ op: 'submit', ts: this.t, order: { id: this.oid('i'), trader: `sim:inf${i}`, side: dev > 0 ? 'buy' : 'sell', type: 'market', qty: rng.int(2, 10) } });
    }

    const d = this.book.depth(5);
    const pad = (a: number[], f: number) => { while (a.length < 5) a.push(f); return a; };
    const b = this.book.bestBid() ?? mid - 1, a = this.book.bestAsk() ?? mid + 1;
    this.snapshots.push({
      t: this.t, mid: (a + b) / 2, spread: a - b, micro: this.book.microprice() ?? (a + b) / 2,
      bidPx: pad(d.bids.map((x) => x.price), b), bidQty: pad(d.bids.map((x) => x.qty), 0),
      askPx: pad(d.asks.map((x) => x.price), a), askQty: pad(d.asks.map((x) => x.qty), 0),
      flow: this.stepFlow, fundamental: this.fund,
    });
  }

  run(steps: number, onStep?: (sim: Simulation) => void) {
    for (let i = 0; i < steps; i++) {
      this.step();
      onStep?.(this);
    }
    return this;
  }

  candles(every = 20): Candle[] {
    const out: Candle[] = [];
    for (let i = 0; i < this.snapshots.length; i += every) {
      const w = this.snapshots.slice(i, i + every);
      const ts0 = w[0].t, ts1 = w[w.length - 1].t;
      const trades = this.fills.filter((f) => f.ts >= ts0 && f.ts <= ts1);
      const px = trades.length ? trades.map((f) => f.price) : w.map((s) => s.mid);
      out.push({ t: ts0, o: px[0], h: Math.max(...px), l: Math.min(...px), c: px[px.length - 1], v: trades.reduce((s, f) => s + f.qty, 0) });
    }
    return out;
  }
  mids() { return this.snapshots.map((s) => s.mid); }
  avgSpread() { return mean(this.snapshots.map((s) => s.spread)); }
}
