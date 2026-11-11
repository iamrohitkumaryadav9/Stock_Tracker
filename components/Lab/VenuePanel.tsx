'use client';
import { useState } from 'react';
import { Btn, DepthChart, ErrorBox, Field, Note, Panel, Pill, Spinner, Stat, Table, inputCls, post, useApi, usd, num } from './kit';

export default function VenuePanel() {
  const { data: s, error, loading, setData, reload } = useApi<any>('/api/lab/venue');
  const [form, setForm] = useState({ side: 'buy', type: 'market', qty: 10, price: '', tif: 'GTC' });
  const [dep, setDep] = useState(10000);
  const [msg, setMsg] = useState<{ tone: 'info' | 'warn' | 'bad'; text: string; reasons?: any[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [lastKey, setLastKey] = useState<string | null>(null);

  const run = async (fn: () => Promise<any>) => {
    setBusy(true); setMsg(null);
    try { const r = await fn(); if (r?.state) setData(r.state); else if (r?.book) setData(r); return r; }
    catch (e) { setMsg({ tone: 'bad', text: e instanceof Error ? e.message : 'failed' }); }
    finally { setBusy(false); }
  };
  const order = async (key?: string) => {
    const k = key ?? `ord-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setLastKey(k);
    const r = await run(() => post('venue', { op: 'order', key: k, ...form, price: form.type === 'limit' ? Number(form.price) : undefined }));
    if (!r?.result) return;
    const x = r.result;
    if (x.status === 'rejected') setMsg({ tone: 'warn', text: 'Rejected by the pre-trade risk engine.', reasons: x.risk?.reasons ?? [] });
    else if (x.status === 'duplicate') setMsg({ tone: 'info', text: `Duplicate request recognised by its idempotency key. No second order was created (order ${x.orderId}).` });
    else setMsg({ tone: 'info', text: `Accepted. ${x.fills.length} fill(s), ${x.fills.reduce((a: number, f: any) => a + f.qty, 0)} shares.` });
  };

  if (loading && !s) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  if (!s) return null;
  const p = s.portfolio;
  return (
    <div className="space-y-5">
      <Note>
        Your own sandbox exchange, with simulated counterparties. Orders pass a deterministic pre-trade risk engine, match in the engine, and every fill is booked
        in an immutable double-entry ledger with idempotency keys. State is event-sourced: only the command log is stored. Storage right now: <b>{s.storage}</b>
        {s.storage === 'memory' && ' (state is lost when the server restarts; connect MongoDB to persist it)'}.
      </Note>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Cash" value={usd(p.cash)} />
        <Stat label={`Position (${s.symbol})`} value={p.position} />
        <Stat label="Mark" value={p.mark ? usd(p.mark) : 'n/a'} />
        <Stat label="Equity" value={usd(p.equity)} />
        <Stat label="P&L vs deposits" value={usd(p.pnl)} tone={p.pnl > 0 ? 'good' : p.pnl < 0 ? 'bad' : undefined} />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Order ticket" sub={`Spread ${s.book.spread ?? 'n/a'} ticks, mid ${s.book.mid ? usd(s.book.mid) : 'n/a'}`}>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Btn variant="ghost" onClick={() => run(() => post('venue', { op: 'deposit', amount: dep }))} disabled={busy}>Deposit</Btn>
              <input className={`${inputCls} w-28`} type="number" value={dep} onChange={(e) => setDep(+e.target.value)} aria-label="deposit amount in dollars" />
              <span className="self-center text-xs text-gray-500">USD</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Side"><select className={inputCls} value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value })}><option>buy</option><option>sell</option></select></Field>
              <Field label="Type"><select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option>market</option><option>limit</option></select></Field>
              <Field label="Quantity"><input className={inputCls} type="number" min={1} value={form.qty} onChange={(e) => setForm({ ...form, qty: +e.target.value })} /></Field>
              <Field label="Limit price ($)"><input className={inputCls} type="number" step="0.01" disabled={form.type !== 'limit'} value={form.price} placeholder={s.book.mid ? (s.book.mid / 100).toFixed(2) : ''} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
              <Field label="Time in force"><select className={inputCls} disabled={form.type !== 'limit'} value={form.tif} onChange={(e) => setForm({ ...form, tif: e.target.value })}><option>GTC</option><option>IOC</option><option>FOK</option></select></Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn onClick={() => order()} disabled={busy}>Submit order</Btn>
              <Btn variant="ghost" onClick={() => lastKey && order(lastKey)} disabled={busy || !lastKey}>Resend last (same key)</Btn>
            </div>
            <p className="text-xs text-gray-500">&ldquo;Resend last&rdquo; replays the same idempotency key, like a client retrying after a network timeout. It must not create a second order.</p>
            {msg && (
              <Note tone={msg.tone}>
                {msg.text}
                {msg.reasons?.length ? <ul className="mt-2 list-disc pl-5">{msg.reasons.map((r: any) => <li key={r.code}><b>{r.code}</b>: {r.message} (limit {String(r.limit)}, actual {String(r.actual)})</li>)}</ul> : null}
              </Note>
            )}
          </div>
        </Panel>
        <Panel title="Order book" sub={`state hash ${s.book.hash}`}><DepthChart bids={s.book.depth.bids} asks={s.book.depth.asks} /></Panel>
        <Panel title="Controls & risk limits">
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between"><span>Kill switch</span><Btn variant={s.killSwitch ? 'danger' : 'ghost'} onClick={() => run(() => post('venue', { op: 'kill', on: !s.killSwitch }))} disabled={busy}>{s.killSwitch ? 'HALTED. Click to resume' : 'Trading enabled'}</Btn></div>
            <Table dense head={['Limit', 'Value']} rows={[['Max order qty', s.limits.maxOrderQty], ['Max order notional', usd(s.limits.maxOrderNotional)], ['Max position', s.limits.maxPositionQty], ['Price collar', `${s.limits.collarPct * 100}%`], ['Max open orders', s.limits.maxOpenOrders], ['Shorting', s.limits.allowShort ? 'on' : 'off']]} />
            <Btn variant="ghost" onClick={() => confirm('Reset your sandbox venue and ledger?') && run(() => post('venue', { op: 'reset' }))} disabled={busy}>Reset sandbox</Btn>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Reconciliation" sub="Independent check: exchange fills vs ledger balances. Breaks are reported, never auto-corrected." right={<Pill tone={s.recon.clean ? 'good' : 'bad'}>{s.recon.clean ? 'clean' : `${s.recon.breaks.length} break(s)`}</Pill>}>
          <p className="text-sm text-gray-400">{s.recon.note} Checked {s.recon.checked} exchange fills.</p>
          {s.recon.breaks.length > 0 && <Table dense head={['Type', 'User', 'Detail']} rows={s.recon.breaks.map((b: any) => [b.type, b.user, b.detail])} />}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-400">
            <Pill tone={s.ledger.chain.ok ? 'good' : 'bad'}>hash chain {s.ledger.chain.ok ? 'valid' : `broken at #${s.ledger.chain.brokenAt}`}</Pill>
            <Pill tone={Object.values(s.ledger.trialBalance).every((v: any) => v === 0) ? 'good' : 'bad'}>trial balance {Object.values(s.ledger.trialBalance).every((v: any) => v === 0) ? 'zero in every currency' : 'OFF'}</Pill>
            <span>{s.ledger.total} ledger entries</span>
          </div>
        </Panel>
        <Panel title="Trade surveillance" sub="Wash-trade attempts, spoofing patterns, message bursts, robust-z outliers vs peers.">
          {s.alerts.length === 0 ? <p className="text-sm text-gray-500">No alerts. Try placing a buy limit just inside the spread, then a sell that would hit your own bid.</p> :
            <ul className="space-y-2">{s.alerts.map((a: any, i: number) => <li key={i} className="rounded-lg border border-gray-600 p-3 text-sm"><div className="flex items-center gap-2"><Pill tone={a.severity === 'high' ? 'bad' : a.severity === 'medium' ? 'warn' : 'gray'}>{a.severity}</Pill><b className="text-gray-200">{a.rule}</b></div><p className="mt-1 text-gray-400">{a.message}</p></li>)}</ul>}
          {s.stats[0] && <p className="mt-3 text-xs text-gray-500">Your activity: {s.stats[0].orders} orders, {s.stats[0].cancels} cancels, {s.stats[0].fills} fills, order-to-trade {num(s.stats[0].orderToTrade, 1)}.</p>}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Your open orders">
          {s.myOrders.length === 0 ? <p className="text-sm text-gray-500">None.</p> : <Table dense head={['ID', 'Side', 'Price', 'Qty', '']} rows={s.myOrders.map((o: any) => [o.id.slice(0, 10), o.side, usd(o.price), o.qty, <Btn key={o.id} variant="ghost" onClick={() => run(() => post('venue', { op: 'cancel', id: o.id }))}>Cancel</Btn>])} />}
        </Panel>
        <Panel title="Ledger (latest entries)" sub="Immutable. Corrections are new reversing entries.">
          <Table dense head={['#', 'Memo', 'Key']} rows={s.ledger.entries.slice(0, 8).map((e: any) => [e.seq, e.memo, <code key={e.key} className="text-xs text-gray-500">{e.key.slice(0, 22)}</code>])} />
        </Panel>
      </div>
      <div><Btn variant="ghost" onClick={reload}>Refresh</Btn></div>
    </div>
  );
}
