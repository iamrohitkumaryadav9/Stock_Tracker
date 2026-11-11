import { PitView } from '@/lab/pit/store';
import type { PitUniverse } from '@/lab/pit/load';
import { barKnownAt, type Bar, type Filing, type NewsItem } from '@/lab/data/types';
import { maxDrawdown, sharpe, sortino } from './stats';
import { mean, std } from '@/lab/core/util';

/** What a strategy is allowed to see at decision time: only point-in-time views. */
export interface StrategyCtx {
  ticker: string;
  asOf: number;
  bars: Bar[]; // all bars known at asOf, oldest first
  filings: Filing[]; // filings visible at asOf (restatements applied only if already filed)
  news: NewsItem[];
  position: number; // current target weight
  views: { bars: PitView<Bar>; filings: PitView<Filing>; news: PitView<NewsItem> };
}
export interface Strategy {
  name: string;
  /** target weight in [-1, 1] (fraction of equity). */
  decide(ctx: StrategyCtx): number;
}

export interface CostModel {
  commissionBps: number;
  halfSpreadBps: number;
  impactCoef: number; // slippage = impactCoef * sqrt(tradeNotional / ADV) (as a fraction of price)
  borrowBpsPerYear: number;
}
export const DEFAULT_COSTS: CostModel = { commissionBps: 1, halfSpreadBps: 2, impactCoef: 0.1, borrowBpsPerYear: 50 };
export const ZERO_COSTS: CostModel = { commissionBps: 0, halfSpreadBps: 0, impactCoef: 0, borrowBpsPerYear: 0 };

export interface BacktestOpts {
  startIdx?: number; // first decision bar index
  endIdx?: number;
  initialCash?: number;
  costs?: CostModel;
  fromTs?: number;
  toTs?: number;
}
export interface TradeRec { t: number; weightFrom: number; weightTo: number; price: number; cost: number }
export interface BacktestResult {
  ticker: string;
  strategy: string;
  dates: number[];
  equity: number[];
  returns: number[];
  trades: TradeRec[];
  decisions: { t: number; weight: number }[];
  metrics: Metrics;
}
export interface Metrics {
  totalReturn: number;
  cagr: number;
  annVol: number;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  turnover: number; // sum |Δweight|
  exposure: number; // mean |weight|
  costDragBps: number; // total costs / initial equity, bps
  nTrades: number;
  days: number;
}

export function metricsFrom(returns: number[], equity: number[], decisions: { weight: number }[], trades: TradeRec[], costTotal: number, initial: number): Metrics {
  const days = returns.length;
  const total = equity.length ? equity[equity.length - 1] / initial - 1 : 0;
  return {
    totalReturn: total,
    cagr: days > 0 ? (1 + total) ** (252 / days) - 1 : 0,
    annVol: std(returns) * Math.sqrt(252),
    sharpe: sharpe(returns),
    sortino: sortino(returns),
    maxDrawdown: maxDrawdown(equity),
    turnover: trades.reduce((s, t) => s + Math.abs(t.weightTo - t.weightFrom), 0),
    exposure: mean(decisions.map((d) => Math.abs(d.weight))),
    costDragBps: (costTotal / initial) * 1e4,
    nTrades: trades.length,
    days,
  };
}

export function makeCtx(universe: PitUniverse, ticker: string, asOf: number, position = 0): StrategyCtx {
  const views = { bars: new PitView(universe.bars, asOf), filings: new PitView(universe.filings, asOf), news: new PitView(universe.news, asOf) };
  return {
    ticker, asOf, position, views,
    bars: views.bars.series(ticker).map((r) => r.value),
    filings: views.filings.series(ticker).map((r) => r.value),
    news: views.news.series(ticker).map((r) => r.value),
  };
}

/**
 * Daily-bar backtest with realistic timing: the decision is taken at the close of day i using only
 * information known at that moment; the trade executes at the OPEN of day i+1 (never at the signal close),
 * paying commission, half-spread and square-root market impact. Short positions pay borrow.
 */
export function backtest(universe: PitUniverse, ticker: string, strategy: Strategy, opts: BacktestOpts = {}): BacktestResult {
  const costs = opts.costs ?? DEFAULT_COSTS;
  const initial = opts.initialCash ?? 100_000;
  const all = universe.bars.series(ticker, Number.MAX_SAFE_INTEGER).map((r) => r.value);
  const from = opts.startIdx ?? (opts.fromTs !== undefined ? Math.max(0, all.findIndex((b) => b.t >= opts.fromTs!)) : 30);
  const to = Math.min(opts.endIdx ?? (opts.toTs !== undefined ? all.findIndex((b) => b.t > opts.toTs!) - 1 : all.length - 1), all.length - 1);
  let cash = initial, shares = 0, weight = 0, costTotal = 0;
  const equity: number[] = [], dates: number[] = [], rets: number[] = [];
  const trades: TradeRec[] = [], decisions: { t: number; weight: number }[] = [];
  let prevEq = initial;

  for (let i = from; i < to; i++) {
    const asOf = barKnownAt(all[i].t);
    const ctx = makeCtx(universe, ticker, asOf, weight);
    const target = Math.max(-1, Math.min(1, strategy.decide(ctx) || 0));
    decisions.push({ t: all[i].t, weight: target });

    // execute at next open
    const nxt = all[i + 1];
    const eqOpen = cash + shares * nxt.o;
    const wantShares = (target * eqOpen) / nxt.o;
    const dShares = wantShares - shares;
    if (Math.abs(dShares * nxt.o) > 1e-6 && Math.abs(target - weight) > 1e-9) {
      const notional = Math.abs(dShares) * nxt.o;
      const adv = Math.max(1, mean(all.slice(Math.max(0, i - 19), i + 1).map((b) => b.v * b.c)));
      const slipFrac = costs.halfSpreadBps / 1e4 + costs.impactCoef * Math.sqrt(notional / adv);
      const px = nxt.o * (1 + Math.sign(dShares) * slipFrac);
      const fee = (costs.commissionBps / 1e4) * notional;
      cash -= dShares * px + fee;
      shares = wantShares;
      const slipCost = Math.abs(dShares) * Math.abs(px - nxt.o);
      costTotal += fee + slipCost;
      trades.push({ t: nxt.t, weightFrom: weight, weightTo: target, price: px, cost: fee + slipCost });
      weight = target;
    }
    // borrow cost on shorts (daily accrual)
    if (shares < 0) { const b = (costs.borrowBpsPerYear / 1e4 / 252) * Math.abs(shares) * nxt.c; cash -= b; costTotal += b; }
    const eq = cash + shares * nxt.c;
    equity.push(eq);
    dates.push(nxt.t);
    rets.push(eq / prevEq - 1);
    prevEq = eq;
    weight = (shares * nxt.c) / eq; // drift-adjusted actual weight
  }
  return { ticker, strategy: strategy.name, dates, equity, returns: rets, trades, decisions, metrics: metricsFrom(rets, equity, decisions, trades, costTotal, initial) };
}
