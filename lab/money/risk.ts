/**
 * Pre-trade risk engine. Deterministic and explainable: a rejection always carries
 * machine-readable reason codes with the limit that was breached and the value that breached it.
 * The LLM agents can propose trades, but this gate has the final word.
 */
export type RiskCode =
  | 'KILL_SWITCH'
  | 'MAX_ORDER_QTY'
  | 'MAX_ORDER_NOTIONAL'
  | 'MAX_POSITION'
  | 'PRICE_COLLAR'
  | 'INSUFFICIENT_CASH'
  | 'INSUFFICIENT_SHARES'
  | 'MAX_OPEN_ORDERS'
  | 'DAILY_LOSS_LIMIT';

export interface RiskLimits {
  maxOrderQty: number;
  maxOrderNotional: number; // minor units
  maxPositionQty: number; // absolute
  collarPct: number; // limit price must be within +-collar of reference
  maxOpenOrders: number;
  dailyLossLimit: number; // minor units, positive number
  allowShort: boolean;
}
export const DEFAULT_LIMITS: RiskLimits = {
  maxOrderQty: 500,
  maxOrderNotional: 5_000_000, // $50,000
  maxPositionQty: 2_000,
  collarPct: 0.1,
  maxOpenOrders: 20,
  dailyLossLimit: 2_000_00,
  allowShort: false,
};

export interface RiskContext {
  cash: number; // minor units available
  position: number; // signed shares currently held
  openOrders: number;
  openBuyQty: number; // reserved by resting buy orders
  openSellQty: number; // reserved by resting sell orders
  referencePrice: number; // minor units per share
  dayPnl: number;
  killSwitch: boolean;
}
export interface OrderIntent {
  side: 'buy' | 'sell';
  qty: number;
  price?: number; // minor units per share; undefined for market
}
export interface RiskDecision {
  approved: boolean;
  reasons: { code: RiskCode; message: string; limit: number | string; actual: number | string }[];
}

export function preTradeCheck(o: OrderIntent, ctx: RiskContext, lim: RiskLimits = DEFAULT_LIMITS): RiskDecision {
  const reasons: RiskDecision['reasons'] = [];
  const add = (code: RiskCode, message: string, limit: number | string, actual: number | string) => reasons.push({ code, message, limit, actual });
  const px = o.price ?? ctx.referencePrice;
  const notional = px * o.qty;

  if (ctx.killSwitch) add('KILL_SWITCH', 'Trading halted by kill switch', 'off', 'on');
  if (o.qty > lim.maxOrderQty) add('MAX_ORDER_QTY', 'Order quantity too large (fat-finger guard)', lim.maxOrderQty, o.qty);
  if (notional > lim.maxOrderNotional) add('MAX_ORDER_NOTIONAL', 'Order notional too large', lim.maxOrderNotional, notional);
  if (o.price !== undefined && ctx.referencePrice > 0) {
    const dev = Math.abs(o.price - ctx.referencePrice) / ctx.referencePrice;
    if (dev > lim.collarPct) add('PRICE_COLLAR', 'Limit price too far from reference price', `${(lim.collarPct * 100).toFixed(1)}%`, `${(dev * 100).toFixed(1)}%`);
  }
  if (ctx.openOrders >= lim.maxOpenOrders) add('MAX_OPEN_ORDERS', 'Too many open orders', lim.maxOpenOrders, ctx.openOrders);
  if (ctx.dayPnl <= -lim.dailyLossLimit) add('DAILY_LOSS_LIMIT', 'Daily loss limit reached', -lim.dailyLossLimit, ctx.dayPnl);

  if (o.side === 'buy') {
    const projected = ctx.position + ctx.openBuyQty + o.qty;
    if (projected > lim.maxPositionQty) add('MAX_POSITION', 'Projected position exceeds limit', lim.maxPositionQty, projected);
    // reserve cash for resting buys conservatively at reference price
    const need = notional + ctx.openBuyQty * ctx.referencePrice;
    if (need > ctx.cash) add('INSUFFICIENT_CASH', 'Not enough cash (including reserved for open buys)', ctx.cash, need);
  } else {
    const sellable = ctx.position - ctx.openSellQty;
    if (!lim.allowShort && o.qty > sellable) add('INSUFFICIENT_SHARES', 'Not enough shares to sell (shorting disabled)', sellable, o.qty);
    if (lim.allowShort && Math.abs(ctx.position - ctx.openSellQty - o.qty) > lim.maxPositionQty) add('MAX_POSITION', 'Projected short exceeds limit', lim.maxPositionQty, ctx.position - o.qty);
  }
  return { approved: reasons.length === 0, reasons };
}
