import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.mock('@/lab/server/auth', () => ({ requireUser: async () => ({ id: 'test-user', name: 'Tester' }) }));
// Without MONGODB_URI, connectToDatabase() throws and the lab falls back to in-memory storage.
delete process.env.MONGODB_URI;

let route: typeof import('@/app/api/lab/[action]/route');
beforeAll(async () => { route = await import('@/app/api/lab/[action]/route'); });

const get = async (action: string, qs = '') => {
  const res = await route.GET(new Request(`http://x/api/lab/${action}${qs}`), { params: Promise.resolve({ action }) });
  return { status: res.status, body: await res.json() };
};
const post = async (action: string, body: unknown) => {
  const res = await route.POST(new Request(`http://x/api/lab/${action}`, { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ action }) });
  return { status: res.status, body: await res.json() };
};

describe('lab API (end to end, in-memory storage)', () => {
  it('overview', async () => {
    const r = await get('overview');
    expect(r.status).toBe(200);
    expect(r.body.storage).toBe('memory');
    expect(r.body.tickers).toHaveLength(4);
  });
  it('market sim reports integrity', async () => {
    const r = await get('market', '?seed=5&steps=400');
    expect(r.status).toBe(200);
    expect(r.body.integrity.replayHashMatches).toBe(true);
    expect(r.body.integrity.invariantViolations).toEqual([]);
  });
  it('venue: deposit, trade, idempotent retry, risk rejection, reconcile, persistence across requests', async () => {
    await post('venue', { op: 'reset' });
    let s = (await post('venue', { op: 'deposit', amount: 20000, key: 'd1' })).body;
    expect(s.portfolio.cash).toBe(2_000_000);
    const o1 = (await post('venue', { op: 'order', side: 'buy', type: 'market', qty: 10, key: 'k1' })).body;
    expect(o1.result.status).toBe('accepted');
    expect(o1.state.portfolio.position).toBe(10);
    // replay: the venue is rebuilt from persisted commands on every request, then the same key arrives again
    const again = (await post('venue', { op: 'order', side: 'buy', type: 'market', qty: 10, key: 'k1' })).body;
    expect(again.result.status).toBe('duplicate');
    expect(again.state.portfolio.position).toBe(10);
    const rej = (await post('venue', { op: 'order', side: 'buy', type: 'market', qty: 100000, key: 'k2' })).body;
    expect(rej.result.status).toBe('rejected');
    expect(rej.result.risk.reasons.map((x: any) => x.code)).toContain('MAX_ORDER_QTY');
    s = (await get('venue')).body;
    expect(s.recon.clean).toBe(true);
    expect(s.ledger.chain.ok).toBe(true);
    expect(s.portfolio.position).toBe(10);
    // kill switch halts trading
    await post('venue', { op: 'kill', on: true });
    const halted = (await post('venue', { op: 'order', side: 'buy', type: 'market', qty: 1, key: 'k3' })).body;
    expect(halted.result.risk.reasons[0].code).toBe('KILL_SWITCH');
    await post('venue', { op: 'kill', on: false });
  }, 30000);
  it('research answers and abstains', async () => {
    const a = await post('research', { question: "What was Northwind Semiconductors's revenue in 2024Q2?", ticker: 'NWSC' });
    expect(a.body.abstained).toBe(false);
    expect(a.body.citations.length).toBe(1);
    const b = await post('research', { question: "What was Northwind Semiconductors's revenue in 2024Q2?", ticker: 'NWSC', asOf: Date.UTC(2023, 8, 1) });
    expect(b.body.abstained).toBe(true);
  });
  it('agents + decision log + resolve', async () => {
    const a = await post('agents', { ticker: 'NWSC', asOf: Date.UTC(2025, 2, 3, 21) });
    expect(a.status).toBe(200);
    expect(a.body.decision.analysts).toHaveLength(3);
    const l = await post('logdecision', { ticker: 'NWSC', asOf: Date.UTC(2025, 2, 3, 21) });
    const r = await post('resolve', { seq: l.body.entry.seq });
    expect(r.status).toBe(200);
    const log = (await get('log')).body;
    expect(log.verify.ok).toBe(true);
    expect(log.entries.length).toBe(2);
  });
  it('forecast, evaluate, micro, rageval, journal', async () => {
    expect((await get('forecast', '?ticker=HLGD')).body.evaluation.reports.length).toBe(6);
    const ev = (await get('evaluate', '?ticker=NWSC')).body;
    expect(ev.leaks.find((l: any) => l.strategy.startsWith('LEAKY')).leaky).toBe(true);
    expect(ev.leaks.filter((l: any) => !l.strategy.startsWith('LEAKY')).every((l: any) => !l.leaky)).toBe(true);
    expect((await get('rageval')).body.n).toBeGreaterThan(100);
    expect((await get('micro', '?kind=mm')).body.length).toBe(4);
    const j = (await get('journal', '?demo=1')).body;
    expect(j.findings.find((f: any) => f.bias.startsWith('Disposition')).detected).toBe(true);
    expect((await get('nope')).status).toBe(404);
  }, 120000);
});
