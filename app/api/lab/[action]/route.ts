import { NextResponse } from 'next/server';
import { requireUser } from '@/lab/server/auth';
import { cached, openVenue, persistLast, universe, SYMBOL } from '@/lab/server/universe';
import { loadDoc, saveDoc, killSwitchSet, labDb, logStore, resetVenue, storageMode } from '@/lab/server/store';
import { Simulation, DEFAULT_SIM } from '@/lab/exchange/simulator';
import { stylizedFacts } from '@/lab/exchange/stylized';
import { OrderBook } from '@/lab/exchange/orderbook';
import { analyze } from '@/lab/money/surveillance';
import { DEFAULT_LIMITS } from '@/lab/money/risk';
import { acct, CASH } from '@/lab/money/reconcile';
import { answerQuestion } from '@/lab/ai/rag';
import { evaluateRag } from '@/lab/ai/rag-eval';
import { evaluateForecasters, nextForecast } from '@/lab/ai/forecast';
import { runTeam, teamStrategy, narrate, geminiLLM, type LLM } from '@/lab/ai/agents';
import { AgentMemory } from '@/lab/ai/memory';
import { analyzeJournal, type JTrade } from '@/lab/ai/journal-bias';
import { backtest, makeCtx, DEFAULT_COSTS, ZERO_COSTS } from '@/lab/eval/backtest';
import { buyAndHold, momentum, pead, leakyPeek } from '@/lab/eval/strategies';
import { leakTest, strategyStudy } from '@/lab/eval/validate';
import { DecisionLog } from '@/lab/eval/decisionlog';
import { lobStudy } from '@/lab/ml/lob';
import { executionStudy, marketMakingStudy } from '@/lab/ml/execution';
import { barKnownAt, DAY } from '@/lab/data/types';
import { COMPANIES } from '@/lab/data/synthetic';
import { round } from '@/lab/core/util';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const bad = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });
const tickerOf = (q: string | null) => (q && COMPANIES.some((c) => c.ticker === q.toUpperCase()) ? q.toUpperCase() : 'NWSC');
const clampAsOf = (v: unknown, tk: string) => {
  const bars = universe().md.bars[tk];
  const lo = barKnownAt(bars[60].t), hi = barKnownAt(bars[bars.length - 1].t);
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : hi;
};

async function llm(): Promise<LLM | undefined> {
  const k = process.env.GEMINI_API_KEY;
  if (!k) return undefined;
  try { return await geminiLLM(k); } catch { return undefined; }
}

/* ---------------------------- GET ---------------------------- */
export async function GET(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const user = await requireUser();
  if (!user) return bad('unauthorized', 401);
  const { action } = await params;
  const url = new URL(req.url);
  const q = url.searchParams;
  const u = universe();

  try {
    switch (action) {
      case 'overview': {
        return NextResponse.json({
          storage: await storageMode(), llm: process.env.GEMINI_API_KEY ? 'gemini (narrative only)' : 'offline template',
          tickers: COMPANIES.map((c) => ({ ticker: c.ticker, name: c.name, sector: c.sector })),
          range: { from: u.md.bars.NWSC[0].t, to: u.md.bars.NWSC[u.md.bars.NWSC.length - 1].t },
          counts: { bars: Object.values(u.md.bars).reduce((s, b) => s + b.length, 0), filings: u.md.filings.length, restatements: u.md.filings.filter((f) => f.restates).length, news: u.md.news.length },
          dataSource: u.md.source,
        });
      }
      case 'bars': {
        const tk = tickerOf(q.get('ticker'));
        return NextResponse.json({ ticker: tk, bars: u.md.bars[tk].map((b) => ({ t: b.t, c: b.c })), filings: u.md.filings.filter((f) => f.ticker === tk).map((f) => ({ id: f.id, form: f.form, period: f.period, filedAt: f.filedAt, restates: f.restates })) });
      }
      case 'market': {
        const seed = Math.max(1, Math.min(1e6, Number(q.get('seed')) || 3));
        const steps = Math.max(200, Math.min(4000, Number(q.get('steps')) || 1500));
        const sim = new Simulation({ ...DEFAULT_SIM, seed }).run(steps);
        const replay = OrderBook.replay(sim.commands).book;
        return NextResponse.json({
          seed, steps, candles: sim.candles(Math.max(5, Math.floor(steps / 80))), depth: sim.book.depth(10), mids: sim.mids().filter((_, i) => i % Math.max(1, Math.floor(steps / 300)) === 0),
          fundamental: sim.snapshots.filter((_, i) => i % Math.max(1, Math.floor(steps / 300)) === 0).map((s) => s.fundamental),
          facts: stylizedFacts(sim), stats: { commands: sim.commands.length, trades: sim.fills.length, avgSpread: round(sim.avgSpread(), 3) },
          integrity: { invariantViolations: sim.book.checkInvariants(), replayHashMatches: replay.stateHash() === sim.book.stateHash(), stateHash: sim.book.stateHash().slice(0, 16) },
        });
      }
      case 'venue': return NextResponse.json(await venueState(user.id));
      case 'rageval': return NextResponse.json(await cached('rageval', 600_000, async () => evaluateRag(await u.rag, u.md.filings)));
      case 'forecast': {
        const tk = tickerOf(q.get('ticker'));
        const closes = u.md.bars[tk].map((b) => b.c);
        const ev = await cached(`fc:${tk}`, 600_000, () => evaluateForecasters(closes));
        return NextResponse.json({ ticker: tk, evaluation: ev, next: nextForecast(closes, 5), history: u.md.bars[tk].slice(-120).map((b) => ({ t: b.t, c: b.c })), foundationModel: process.env.FOUNDATION_MODEL_URL ? 'configured' : 'not configured (see lab/ai/forecast.ts remoteForecast)' });
      }
      case 'evaluate': {
        const tk = tickerOf(q.get('ticker'));
        const out = await cached(`eval:${tk}`, 600_000, () => {
          const study = strategyStudy(u.pit, tk);
          const leaks = [leakTest(momentum(40), u.pit, tk), leakTest(pead(15), u.pit, tk), leakTest(() => teamStrategy(), u.pit, tk), leakTest(leakyPeek, u.pit, tk)];
          const mk = (s: ReturnType<typeof buyAndHold>, c = DEFAULT_COSTS) => { const r = backtest(u.pit, tk, s, { costs: c }); return { name: r.strategy, metrics: r.metrics, equity: r.equity.filter((_, i) => i % 4 === 0), dates: r.dates.filter((_, i) => i % 4 === 0) }; };
          const naive = backtest(u.pit, tk, leakyPeek(u.pit), { costs: ZERO_COSTS });
          return {
            study, leaks,
            runs: [mk(buyAndHold(u.pit)), mk(momentum(40)(u.pit)), mk(pead(15)(u.pit)), mk(teamStrategy())],
            leakyIllusion: { sharpe: naive.metrics.sharpe, totalReturn: naive.metrics.totalReturn, note: 'The leaky strategy peeks at tomorrow. Its naive backtest looks spectacular; the leak test is what exposes it.' },
            costSensitivity: [ZERO_COSTS, DEFAULT_COSTS, { ...DEFAULT_COSTS, halfSpreadBps: 8, commissionBps: 5 }].map((c, i) => ({ label: ['no costs', 'default costs', 'high costs'][i], sharpe: backtest(u.pit, tk, momentum(20)(u.pit), { costs: c }).metrics.sharpe })),
          };
        });
        return NextResponse.json({ ticker: tk, ...out });
      }
      case 'micro': {
        const kind = q.get('kind');
        if (kind === 'lob') return NextResponse.json(await cached('lob', 600_000, () => lobStudy({ steps: 4000 })));
        if (kind === 'exec') return NextResponse.json(await cached('exec', 600_000, () => executionStudy()));
        if (kind === 'mm') return NextResponse.json(await cached('mm', 600_000, () => marketMakingStudy()));
        return bad('kind must be lob|exec|mm');
      }
      case 'log': {
        const log = new DecisionLog(await logStore(`log:${user.id}`));
        return NextResponse.json({ entries: (await log.list()).slice(-50).reverse(), verify: await log.verify(), scoreboard: await log.scoreboard(), storage: await storageMode() });
      }
      case 'journal': {
        const demo = q.get('demo') === '1';
        let trades: JTrade[] = [];
        if (!demo) {
          try {
            const { connectToDatabase } = await import('@/database/mongoose');
            const { Transaction } = await import('@/database/models/transaction.model');
            await connectToDatabase();
            const rows = await Transaction.find({ userId: user.id, status: 'filled' }).sort({ timestamp: 1 }).lean();
            trades = rows.map((r) => ({ id: String(r._id), ts: new Date(r.timestamp).getTime(), symbol: r.symbol, side: r.type, qty: r.quantity, price: r.price }));
          } catch { trades = []; }
        }
        if (demo || trades.length === 0) trades = demoJournal();
        return NextResponse.json({ source: demo || trades === undefined ? 'demo' : trades[0]?.id.startsWith('d') ? 'demo (you have no recorded trades yet)' : 'your paper-trading history', trades: trades.length, ...analyzeJournal(trades) });
      }
      default: return bad('unknown action', 404);
    }
  } catch (e) {
    console.error('lab GET', action, e);
    return bad(e instanceof Error ? e.message : 'internal error', 500);
  }
}

/* ---------------------------- POST ---------------------------- */
export async function POST(req: Request, { params }: { params: Promise<{ action: string }> }) {
  const user = await requireUser();
  if (!user) return bad('unauthorized', 401);
  const { action } = await params;
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* empty body */ }
  const u = universe();

  try {
    switch (action) {
      case 'venue': return NextResponse.json(await venueAction(user.id, body));
      case 'research': {
        const question = String(body.question ?? '').slice(0, 300);
        if (question.length < 5) return bad('question too short');
        const tk = tickerOf(String(body.ticker ?? ''));
        const asOf = clampAsOf(body.asOf, tk);
        const r = await answerQuestion(await u.rag, u.md.filings, question, { asOf });
        return NextResponse.json({ asOf, ...r });
      }
      case 'agents': {
        const tk = tickerOf(String(body.ticker ?? ''));
        const asOf = clampAsOf(body.asOf, tk);
        const mem = AgentMemory.fromJSON(await loadDoc('lab_memory', user.id));
        const d = runTeam(makeCtx(u.pit, tk, asOf), { memory: mem });
        const text = await narrate(d, body.useLlm ? await llm() : undefined);
        return NextResponse.json({ decision: d, narrative: text, fixedWindow: { from: new Date(asOf).toISOString().slice(0, 10) } });
      }
      case 'logdecision': {
        const tk = tickerOf(String(body.ticker ?? ''));
        const asOf = clampAsOf(body.asOf, tk);
        const mem = AgentMemory.fromJSON(await loadDoc('lab_memory', user.id));
        const d = runTeam(makeCtx(u.pit, tk, asOf), { memory: mem });
        const log = new DecisionLog(await logStore(`log:${user.id}`));
        const entry = await log.decide('agent-team v1', tk, asOf, { weight: d.weight, conviction: d.conviction, risk: d.risk.adjustments.map((a) => a.rule) });
        const m = mem.add({ ts: asOf, ticker: tk, kind: 'decision', text: `${tk} team conviction ${d.conviction.toFixed(2)} weight ${d.weight.toFixed(2)}`, importance: 0.4, analyst: 'technical', signal: d.analysts[0].score });
        void m;
        await saveDoc('lab_memory', user.id, mem.toJSON());
        return NextResponse.json({ entry });
      }
      case 'resolve': {
        const seq = Number(body.seq);
        const log = new DecisionLog(await logStore(`log:${user.id}`));
        const d = (await log.list()).find((e) => e.seq === seq && e.kind === 'decision');
        if (!d) return bad('decision not found', 404);
        const bars = u.md.bars[d.ticker];
        const i = bars.findIndex((b) => barKnownAt(b.t) > d.decidedAt);
        const j = Math.min(bars.length - 1, i + 9);
        if (i < 0 || j <= i) return bad('no later data available to resolve this decision yet');
        const fwd = bars[j].c / bars[i].o - 1;
        const entry = await log.resolve(seq, { forwardReturn: fwd, horizonDays: j - i + 1 }, barKnownAt(bars[j].t));
        const mem = AgentMemory.fromJSON(await loadDoc('lab_memory', user.id));
        const dec = mem.items.find((m) => m.kind === 'decision' && m.ts === d.decidedAt && m.ticker === d.ticker);
        if (dec) { mem.reflect(dec.id, fwd, barKnownAt(bars[j].t)); await saveDoc('lab_memory', user.id, mem.toJSON()); }
        return NextResponse.json({ entry });
      }
      default: return bad('unknown action', 404);
    }
  } catch (e) {
    console.error('lab POST', action, e);
    return bad(e instanceof Error ? e.message : 'internal error', 500);
  }
}

/* ---------------------------- venue ---------------------------- */
async function venueState(userId: string) {
  const { venue, ledger } = await openVenue(userId);
  venue.users.add(userId);
  const [portfolio, recon, tb, chain, entries] = await Promise.all([venue.portfolio(userId), venue.reconcile(), ledger.trialBalance(), ledger.verifyChain(), ledger.entries()]);
  const { alerts, stats } = analyze(venue.history);
  return {
    symbol: SYMBOL, storage: await storageMode(), limits: DEFAULT_LIMITS, killSwitch: venue.killSwitch,
    book: { depth: venue.book.depth(10), mid: venue.book.mid(), spread: venue.book.spread(), micro: venue.book.microprice(), invariants: venue.book.checkInvariants(), hash: venue.book.stateHash().slice(0, 16) },
    portfolio, recon, ledger: { entries: entries.slice(-30).reverse(), trialBalance: tb, chain, total: entries.length },
    alerts: alerts.filter((a) => a.user === userId || !a.user.startsWith('sim:')), stats: stats.filter((s) => s.user === userId),
    myOrders: venue.book.openOrders(userId),
    recentTrades: venue.fills.slice(-15).reverse().map((f) => ({ id: f.tradeId, price: f.price, qty: f.qty, side: f.side, mine: f.takerTrader === userId || f.makerTrader === userId })),
  };
}

async function venueAction(userId: string, b: Record<string, unknown>) {
  const op = String(b.op);
  if (op === 'reset') { await resetVenue(`venue:${userId}`); return venueState(userId); }
  const { venue, sessionId, nSaved } = await openVenue(userId);
  venue.users.add(userId);
  if (op === 'kill') {
    if (b.on) killSwitchSet.add(sessionId); else killSwitchSet.delete(sessionId);
    return venueState(userId);
  }
  if (op === 'deposit') {
    const amt = Math.round(Number(b.amount) * 100);
    if (!Number.isFinite(amt) || amt <= 0 || amt > 100_000_000) throw new Error('invalid amount');
    await venue.deposit(userId, amt, String(b.key || `dep-${Date.now()}`));
    return venueState(userId);
  }
  if (op === 'order') {
    const side = b.side === 'sell' ? 'sell' : 'buy';
    const type = b.type === 'limit' ? 'limit' : 'market';
    const qty = Math.round(Number(b.qty));
    const price = type === 'limit' ? Math.round(Number(b.price) * 100) : undefined;
    const tif = (['GTC', 'IOC', 'FOK'] as const).find((t) => t === b.tif);
    const key = String(b.key || `ord-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`).slice(0, 80);
    if (!Number.isFinite(qty) || qty <= 0) throw new Error('invalid quantity');
    const r = await venue.submit(userId, { side, type, price, qty, tif }, key);
    if (r.status === 'accepted') await persistLast(sessionId, venue, nSaved);
    return { result: r, state: await venueState(userId) };
  }
  if (op === 'cancel') {
    await venue.cancel(userId, String(b.id));
    await persistLast(sessionId, venue, nSaved);
    return venueState(userId);
  }
  throw new Error('unknown venue op');
}

function demoJournal(): JTrade[] {
  // Deterministic synthetic trader who cuts winners fast and holds losers: shows what the detector finds.
  const out: JTrade[] = [];
  let ts = Date.UTC(2025, 0, 6), s = 7;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 36; i++) {
    const win = rnd() < 0.55;
    const hold = win ? 1 + Math.floor(rnd() * 3) : 10 + Math.floor(rnd() * 15);
    const entry = 100 + rnd() * 20;
    const exit = win ? entry * (1.02 + 0.02 * rnd()) : entry * (0.93 - 0.03 * rnd());
    const sym = ['AAPL', 'MSFT', 'TSLA', 'NVDA'][i % 4];
    out.push({ id: `d-b${i}`, ts, symbol: sym, side: 'buy', qty: 10, price: +entry.toFixed(2) });
    ts += hold * DAY;
    out.push({ id: `d-s${i}`, ts, symbol: sym, side: 'sell', qty: 10, price: +exit.toFixed(2) });
    ts += DAY;
  }
  return out;
}
void labDb; void acct; void CASH; void round;
