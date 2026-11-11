import type { Fill } from '@/lab/exchange/orderbook';
import type { Ledger } from './ledger';

export const CASH = 'USD';
export const acct = {
  cash: (u: string) => `user:${u}:cash`,
  pos: (u: string) => `user:${u}:pos`,
  clearingCash: 'clearing:cash',
  clearingPos: 'clearing:pos',
  fees: 'fees:revenue',
};

/** Ledger transaction for one fill leg (one per participant). Cash and shares each balance to zero. */
export function fillPostings(user: string, sym: string, side: 'buy' | 'sell', qty: number, priceMinor: number, feeMinor: number) {
  const notional = qty * priceMinor;
  const sgn = side === 'buy' ? 1 : -1;
  const postings = [
    { account: acct.cash(user), currency: CASH, amount: -sgn * notional },
    { account: acct.clearingCash, currency: CASH, amount: sgn * notional },
    { account: acct.pos(user), currency: sym, amount: sgn * qty },
    { account: acct.clearingPos, currency: sym, amount: -sgn * qty },
  ];
  if (feeMinor > 0)
    postings.push({ account: acct.cash(user), currency: CASH, amount: -feeMinor }, { account: acct.fees, currency: CASH, amount: feeMinor });
  return postings;
}

export type BreakType = 'MISSING_IN_LEDGER' | 'MISSING_IN_EXCHANGE' | 'QTY_MISMATCH' | 'CASH_MISMATCH';
export interface ReconBreak {
  type: BreakType;
  user: string;
  detail: string;
  expected?: number;
  actual?: number;
  tradeId?: number;
}
export interface ReconReport {
  checked: number;
  breaks: ReconBreak[];
  clean: boolean;
  note: string;
}

/**
 * Compares two independently produced views: positions/cash implied by exchange fills vs. ledger balances.
 * Breaks are reported for a human to investigate. They are never auto-corrected, because silently
 * "fixing" a mismatch can hide the real fault.
 */
export async function reconcile(ledger: Ledger, fills: Fill[], sym: string, users: string[], feeBps: number, initialCash: Record<string, number> = {}): Promise<ReconReport> {
  const breaks: ReconBreak[] = [];
  const entries = await ledger.entries();
  const ledgerFillKeys = new Set(entries.map((e) => e.key));
  const userSet = new Set(users);
  const expectedPos = new Map<string, number>();
  const expectedCash = new Map<string, number>(users.map((u) => [u, initialCash[u] ?? 0]));

  for (const f of fills) {
    for (const [who, side] of [[f.takerTrader, f.side], [f.makerTrader, f.side === 'buy' ? 'sell' : 'buy']] as const) {
      if (!userSet.has(who)) continue;
      const key = `fill:${f.tradeId}:${who}`;
      if (!ledgerFillKeys.has(key)) breaks.push({ type: 'MISSING_IN_LEDGER', user: who, tradeId: f.tradeId, detail: `Exchange fill #${f.tradeId} has no ledger entry` });
      const sgn = side === 'buy' ? 1 : -1;
      const fee = Math.round((f.qty * f.price * feeBps) / 10_000);
      expectedPos.set(who, (expectedPos.get(who) ?? 0) + sgn * f.qty);
      expectedCash.set(who, (expectedCash.get(who) ?? 0) - sgn * f.qty * f.price - fee);
    }
  }
  const fillKeys = new Set(fills.flatMap((f) => [`fill:${f.tradeId}:${f.takerTrader}`, `fill:${f.tradeId}:${f.makerTrader}`]));
  for (const e of entries) if (e.key.startsWith('fill:') && !fillKeys.has(e.key)) breaks.push({ type: 'MISSING_IN_EXCHANGE', user: e.key.split(':')[2] ?? '?', detail: `Ledger entry ${e.id} (${e.key}) has no matching exchange fill` });

  for (const u of users) {
    const lp = await ledger.balance(acct.pos(u), sym);
    const ep = expectedPos.get(u) ?? 0;
    if (lp !== ep) breaks.push({ type: 'QTY_MISMATCH', user: u, expected: ep, actual: lp, detail: `Position: exchange implies ${ep}, ledger shows ${lp}` });
    const lc = await ledger.balance(acct.cash(u), CASH);
    const ec = expectedCash.get(u) ?? 0;
    if (lc !== ec) breaks.push({ type: 'CASH_MISMATCH', user: u, expected: ec, actual: lc, detail: `Cash: exchange implies ${ec}, ledger shows ${lc}` });
  }
  return {
    checked: fills.length,
    breaks,
    clean: breaks.length === 0,
    note: breaks.length ? 'Breaks require operator review. No automatic correction was applied.' : 'Ledger and exchange agree.',
  };
}
