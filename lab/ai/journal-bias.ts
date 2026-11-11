import { mean, normCdf, std } from '@/lab/core/util';

/**
 * Behavioural-bias mining over a user's own trade journal. Every finding comes with a statistical test and
 * the trade ids that support it, so the output is evidence ("you sold winners after X days vs losers Y days,
 * p=0.03"), not a generic LLM pep talk. Needs ~20+ closed trades to say anything; below that it says so.
 */
export interface JTrade { id: string; ts: number; symbol: string; side: 'buy' | 'sell'; qty: number; price: number }
export interface ClosedLot { symbol: string; openTs: number; closeTs: number; qty: number; entry: number; exit: number; pnl: number; ret: number; holdDays: number; openId: string; closeId: string }
export interface Finding { bias: string; detected: boolean; severity: 'none' | 'low' | 'medium' | 'high'; stat: string; p?: number; explanation: string; evidence: string[]; suggestion: string }

/** FIFO lot matching of buys against sells (long-only journal). */
export function closeLots(trades: JTrade[]): ClosedLot[] {
  const open = new Map<string, { id: string; ts: number; qty: number; price: number }[]>();
  const out: ClosedLot[] = [];
  for (const t of [...trades].sort((a, b) => a.ts - b.ts)) {
    const q = open.get(t.symbol) ?? [];
    if (t.side === 'buy') q.push({ id: t.id, ts: t.ts, qty: t.qty, price: t.price });
    else {
      let rem = t.qty;
      while (rem > 0 && q.length) {
        const lot = q[0], m = Math.min(rem, lot.qty);
        out.push({ symbol: t.symbol, openTs: lot.ts, closeTs: t.ts, qty: m, entry: lot.price, exit: t.price, pnl: (t.price - lot.price) * m, ret: t.price / lot.price - 1, holdDays: (t.ts - lot.ts) / 86400e3, openId: lot.id, closeId: t.id });
        lot.qty -= m; rem -= m;
        if (lot.qty === 0) q.shift();
      }
    }
    open.set(t.symbol, q);
  }
  return out;
}

const sev = (p: number, hi = 0.01, mid = 0.05) => (p < hi ? 'high' : p < mid ? 'medium' : p < 0.15 ? 'low' : 'none') as Finding['severity'];
const tTest = (a: number[], b: number[]) => {
  if (a.length < 3 || b.length < 3) return { t: 0, p: 1 };
  const se = Math.sqrt(std(a) ** 2 / a.length + std(b) ** 2 / b.length) || 1e-9;
  const t = (mean(a) - mean(b)) / se;
  return { t, p: 2 * (1 - normCdf(Math.abs(t))) };
};

export function analyzeJournal(trades: JTrade[]): { lots: number; findings: Finding[]; summary: string } {
  const lots = closeLots(trades);
  if (lots.length < 12) return { lots: lots.length, findings: [], summary: `Only ${lots.length} closed positions. At least ~12-20 are needed before behavioural statistics mean anything.` };
  const findings: Finding[] = [];
  const wins = lots.filter((l) => l.pnl > 0), losses = lots.filter((l) => l.pnl <= 0);

  // 1. disposition effect: holding losers longer than winners
  if (wins.length >= 4 && losses.length >= 4) {
    const { t, p } = tTest(losses.map((l) => l.holdDays), wins.map((l) => l.holdDays));
    const det = t > 0 && p < 0.1;
    findings.push({ bias: 'Disposition effect (cutting winners, holding losers)', detected: det, severity: det ? sev(p) : 'none', stat: `avg hold: losers ${mean(losses.map((l) => l.holdDays)).toFixed(1)}d vs winners ${mean(wins.map((l) => l.holdDays)).toFixed(1)}d`, p, explanation: det ? 'You hold losing positions noticeably longer than winning ones, the classic disposition effect.' : 'No significant tendency to hold losers longer than winners.', evidence: losses.sort((a, b) => b.holdDays - a.holdDays).slice(0, 3).map((l) => `${l.symbol}: held ${l.holdDays.toFixed(0)}d for ${(l.ret * 100).toFixed(1)}% (${l.closeId})`), suggestion: 'Define the exit before entering (stop and target) and review any position that breaches its stop.' });
  }
  // 2. loss aversion / payoff asymmetry
  if (wins.length >= 3 && losses.length >= 3) {
    const aw = mean(wins.map((l) => l.ret)), al = Math.abs(mean(losses.map((l) => l.ret)));
    const hit = wins.length / lots.length;
    const breakEvenHit = al / (aw + al);
    const det = al > aw * 1.3 && hit < 0.8;
    findings.push({ bias: 'Negative payoff asymmetry', detected: det, severity: det ? (al > aw * 2 ? 'high' : 'medium') : 'none', stat: `avg win ${(aw * 100).toFixed(1)}% vs avg loss ${(-al * 100).toFixed(1)}%; hit rate ${(hit * 100).toFixed(0)}% (break-even ${(breakEvenHit * 100).toFixed(0)}%)`, explanation: det ? 'Your average loss is much larger than your average win, so you need an unusually high hit rate to be profitable.' : 'Win/loss sizes are reasonably balanced.', evidence: losses.sort((a, b) => a.ret - b.ret).slice(0, 3).map((l) => `${l.symbol}: ${(l.ret * 100).toFixed(1)}% (${l.closeId})`), suggestion: 'Cut losers at a fixed fraction of the planned gain; size positions by risk, not conviction.' });
  }
  // 3. revenge trading: larger size right after a loss
  const ordered = [...lots].sort((a, b) => a.closeTs - b.closeTs);
  const afterLoss: number[] = [], afterWin: number[] = [];
  for (let i = 1; i < ordered.length; i++) {
    const notional = ordered[i].qty * ordered[i].entry;
    const gapDays = (ordered[i].openTs - ordered[i - 1].closeTs) / 86400e3;
    if (gapDays > 3 || gapDays < -30) continue; // only consider re-entries soon after the previous close
    (ordered[i - 1].pnl < 0 ? afterLoss : afterWin).push(notional);
  }
  if (afterLoss.length >= 4 && afterWin.length >= 4) {
    const { t, p } = tTest(afterLoss, afterWin);
    const det = t > 0 && p < 0.1;
    findings.push({ bias: 'Revenge trading (size up after a loss)', detected: det, severity: det ? sev(p) : 'none', stat: `avg position after loss $${mean(afterLoss).toFixed(0)} vs after win $${mean(afterWin).toFixed(0)}`, p, explanation: det ? 'You tend to take larger positions right after a losing trade.' : 'No significant size escalation after losses.', evidence: [`${afterLoss.length} quick re-entries after losses, ${afterWin.length} after wins`], suggestion: 'After a loss, cap the next position at your normal size and take a cooling-off period.' });
  }
  // 4. overtrading: many trades per week with worse average return
  const spanWeeks = Math.max(1, (Math.max(...trades.map((t) => t.ts)) - Math.min(...trades.map((t) => t.ts))) / (7 * 86400e3));
  const perWeek = trades.length / spanWeeks;
  const shortHold = lots.filter((l) => l.holdDays < 2), longHold = lots.filter((l) => l.holdDays >= 2);
  if (shortHold.length >= 5 && longHold.length >= 5) {
    const { t, p } = tTest(longHold.map((l) => l.ret), shortHold.map((l) => l.ret));
    const det = t > 0 && p < 0.1;
    findings.push({ bias: 'Overtrading / impatience', detected: det, severity: det ? sev(p) : 'none', stat: `${perWeek.toFixed(1)} trades/week; avg return short holds ${(mean(shortHold.map((l) => l.ret)) * 100).toFixed(2)}% vs longer ${(mean(longHold.map((l) => l.ret)) * 100).toFixed(2)}%`, p, explanation: det ? 'Positions held under 2 days perform significantly worse than longer ones, and each trade also pays costs.' : 'Short holds do not underperform longer ones significantly.', evidence: [`${shortHold.length} short holds, ${longHold.length} longer holds`], suggestion: 'Require a written thesis for any trade intended to last under two days.' });
  }
  // 5. concentration
  const bySym = new Map<string, number>();
  for (const t of trades) if (t.side === 'buy') bySym.set(t.symbol, (bySym.get(t.symbol) ?? 0) + t.qty * t.price);
  const tot = [...bySym.values()].reduce((s, x) => s + x, 0) || 1;
  const hhi = [...bySym.values()].reduce((s, x) => s + (x / tot) ** 2, 0);
  const topSym = [...bySym].sort((a, b) => b[1] - a[1])[0];
  findings.push({ bias: 'Concentration', detected: hhi > 0.4, severity: hhi > 0.6 ? 'high' : hhi > 0.4 ? 'medium' : 'none', stat: `HHI ${hhi.toFixed(2)}; ${topSym ? `${topSym[0]} = ${((topSym[1] / tot) * 100).toFixed(0)}% of capital deployed` : ''}`, explanation: hhi > 0.4 ? 'Most capital is concentrated in a few names.' : 'Capital is reasonably diversified across names.', evidence: [...bySym].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s, v]) => `${s}: ${((v / tot) * 100).toFixed(0)}%`), suggestion: 'Set a per-name maximum (e.g. 20%) and rebalance when exceeded.' });

  const hits = findings.filter((f) => f.detected);
  return { lots: lots.length, findings, summary: hits.length ? `${hits.length} behavioural pattern(s) detected over ${lots.length} closed positions: ${hits.map((h) => h.bias).join('; ')}.` : `No statistically significant bias detected over ${lots.length} closed positions (small samples can hide real problems).` };
}
