import { median } from '@/lab/core/util';
import type { HistoryRow } from './venue';

/**
 * Trade surveillance / anomaly detection with explainable alerts.
 * Rules (each returns evidence): wash-trade attempts (self-trade prevention hits), spoofing/layering
 * (large far-side orders cancelled quickly), quote stuffing (message bursts), and a robust z-score on
 * cancel-rate and order-to-trade ratio against a peer baseline (median/MAD, not mean/std, so a few
 * extreme peers do not hide an outlier).
 */
export interface Alert {
  user: string;
  rule: 'WASH_TRADE_ATTEMPT' | 'SPOOFING_PATTERN' | 'MESSAGE_BURST' | 'CANCEL_RATE_OUTLIER' | 'ORDER_TO_TRADE_OUTLIER';
  severity: 'low' | 'medium' | 'high';
  message: string;
  evidence: Record<string, number | string>;
}
export interface UserStats {
  user: string;
  orders: number;
  cancels: number;
  fills: number;
  cancelRate: number;
  orderToTrade: number;
  stpHits: number;
}

export function userStats(hist: HistoryRow[]): UserStats[] {
  const m = new Map<string, UserStats>();
  const get = (u: string) => m.get(u) ?? m.set(u, { user: u, orders: 0, cancels: 0, fills: 0, cancelRate: 0, orderToTrade: 0, stpHits: 0 }).get(u)!;
  for (const h of hist) {
    const s = get(h.user);
    if (h.op === 'submit') s.orders++;
    for (const e of h.events) {
      if (e.kind === 'cancelled' && e.reason === 'user' && h.op === 'cancel') s.cancels++;
      if (e.kind === 'cancelled' && e.reason === 'stp') s.stpHits++;
      if (e.kind === 'fill') {
        get(e.fill.takerTrader).fills++;
        if (e.fill.makerTrader !== e.fill.takerTrader) get(e.fill.makerTrader).fills++;
      }
    }
  }
  for (const s of m.values()) {
    s.cancelRate = s.orders ? s.cancels / s.orders : 0;
    s.orderToTrade = s.orders / Math.max(1, s.fills);
  }
  return [...m.values()];
}

function robustZ(x: number, pop: number[]) {
  const med = median(pop);
  const mad = median(pop.map((v) => Math.abs(v - med))) || 1e-9;
  return (0.6745 * (x - med)) / mad;
}

export function analyze(hist: HistoryRow[], opts: { burstWindow?: number; burstLimit?: number; spoofQtyMult?: number; spoofLifetime?: number } = {}): { alerts: Alert[]; stats: UserStats[] } {
  const { burstWindow = 5, burstLimit = 30, spoofQtyMult = 3, spoofLifetime = 3 } = opts;
  const alerts: Alert[] = [];
  const stats = userStats(hist);
  const humans = stats.filter((s) => !s.user.startsWith('sim:'));
  const peers = stats.filter((s) => s.orders >= 5);

  for (const s of stats) {
    if (s.stpHits > 0 && !s.user.startsWith('sim:'))
      alerts.push({ user: s.user, rule: 'WASH_TRADE_ATTEMPT', severity: s.stpHits >= 3 ? 'high' : 'medium', message: `${s.stpHits} order(s) would have traded against the user's own resting orders (blocked by self-trade prevention).`, evidence: { stpHits: s.stpHits } });
  }

  // message bursts (per user, sliding window over timestamps)
  const byUser = new Map<string, HistoryRow[]>();
  for (const h of hist) (byUser.get(h.user) ?? byUser.set(h.user, []).get(h.user)!).push(h);
  for (const [u, rows] of byUser) {
    if (u.startsWith('sim:')) continue;
    let lo = 0, worst = 0, at = 0;
    for (let hi = 0; hi < rows.length; hi++) {
      while (rows[hi].ts - rows[lo].ts > burstWindow) lo++;
      if (hi - lo + 1 > worst) { worst = hi - lo + 1; at = rows[hi].ts; }
    }
    if (worst > burstLimit) alerts.push({ user: u, rule: 'MESSAGE_BURST', severity: 'medium', message: `${worst} messages within ${burstWindow} time units (limit ${burstLimit}).`, evidence: { messages: worst, window: burstWindow, atTs: at } });

    // spoofing: a large order (>= mult x user's median size) that is cancelled within `spoofLifetime` without any fill,
    // followed by an opposite-side fill for the same user shortly after
    const sizes = rows.filter((r) => r.op === 'submit' && r.qty).map((r) => r.qty as number);
    const med = median(sizes) || 1;
    for (const r of rows) {
      if (r.op !== 'submit' || !r.qty || r.qty < spoofQtyMult * med || !r.side) continue;
      const cancel = rows.find((c) => c.op === 'cancel' && c.id === r.id && c.ts - r.ts <= spoofLifetime);
      if (!cancel) continue;
      const opp = rows.find((x) => x.ts >= r.ts && x.ts <= cancel.ts + spoofLifetime && x.side && x.side !== r.side && x.events.some((e) => e.kind === 'fill'));
      if (opp) alerts.push({ user: u, rule: 'SPOOFING_PATTERN', severity: 'high', message: `Large ${r.side} order (${r.qty}, ${(r.qty / med).toFixed(1)}x typical) cancelled after ${cancel.ts - r.ts} time units, with an opposite-side execution nearby.`, evidence: { orderId: r.id, qty: r.qty, typical: med, opposite: opp.id } });
    }
  }

  // peer-relative outliers
  if (peers.length >= 4)
    for (const s of humans) {
      if (s.orders < 5) continue;
      const zc = robustZ(s.cancelRate, peers.map((p) => p.cancelRate));
      if (zc > 3.5 && s.cancelRate > 0.5) alerts.push({ user: s.user, rule: 'CANCEL_RATE_OUTLIER', severity: 'medium', message: `Cancel rate ${(s.cancelRate * 100).toFixed(0)}% is a robust-z ${zc.toFixed(1)} outlier versus peers.`, evidence: { cancelRate: +s.cancelRate.toFixed(3), robustZ: +zc.toFixed(2) } });
      const zo = robustZ(s.orderToTrade, peers.map((p) => p.orderToTrade));
      if (zo > 3.5 && s.orderToTrade > 10) alerts.push({ user: s.user, rule: 'ORDER_TO_TRADE_OUTLIER', severity: 'low', message: `Order-to-trade ratio ${s.orderToTrade.toFixed(1)} is a robust-z ${zo.toFixed(1)} outlier versus peers.`, evidence: { orderToTrade: +s.orderToTrade.toFixed(2), robustZ: +zo.toFixed(2) } });
    }
  return { alerts, stats };
}
