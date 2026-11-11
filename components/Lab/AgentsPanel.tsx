'use client';
import { useState } from 'react';
import { Btn, ErrorBox, Field, HBar, Note, Panel, Pill, Spinner, Stat, Table, inputCls, post, useApi, day, num, pct } from './kit';

export default function AgentsPanel({ tickers, range }: { tickers: { ticker: string; name: string }[]; range: { from: number; to: number } }) {
  const [ticker, setTicker] = useState(tickers[0]?.ticker ?? 'NWSC');
  const [asOf, setAsOf] = useState(day(range.to - 200 * 86400e3));
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [useLlm, setUseLlm] = useState(false);
  const log = useApi<any>('/api/lab/log');
  const ms = () => Date.parse(asOf + 'T21:00:00Z');

  const run = async () => {
    setBusy(true); setErr(null);
    try { setRes(await post('agents', { ticker, asOf: ms(), useLlm })); } catch (e) { setErr(e instanceof Error ? e.message : 'failed'); } finally { setBusy(false); }
  };
  const record = async () => {
    setBusy(true); setErr(null);
    try { await post('logdecision', { ticker, asOf: ms() }); await log.reload(); } catch (e) { setErr(e instanceof Error ? e.message : 'failed'); } finally { setBusy(false); }
  };
  const resolve = async (seq: number) => {
    setBusy(true); setErr(null);
    try { await post('resolve', { seq }); await log.reload(); } catch (e) { setErr(e instanceof Error ? e.message : 'failed'); } finally { setBusy(false); }
  };
  const d = res?.decision;
  return (
    <div className="space-y-5">
      <Note>
        A team of agents: technical, fundamental and sentiment analysts feed a bull/bear debate, a trader sizes the position using each analyst&rsquo;s track record
        (layered memory), and a <b>deterministic risk manager</b> can only reduce or veto. The agents see a point-in-time view only, so the same team is backtested and leak-tested like any strategy.
        An LLM, if configured, only <i>narrates</i> the structured evidence and cannot change the position.
      </Note>
      <Panel title="Run the team">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Ticker"><select className={inputCls} value={ticker} onChange={(e) => setTicker(e.target.value)}>{tickers.map((t) => <option key={t.ticker} value={t.ticker}>{t.ticker} · {t.name}</option>)}</select></Field>
          <Field label="Decision date (as of)"><input className={inputCls} type="date" min="2023-06-01" max={day(range.to)} value={asOf} onChange={(e) => setAsOf(e.target.value)} /></Field>
          <label className="flex items-center gap-2 pb-2 text-xs text-gray-400"><input type="checkbox" checked={useLlm} onChange={(e) => setUseLlm(e.target.checked)} />narrate with Gemini (if key set)</label>
          <Btn onClick={run} disabled={busy}>Run team</Btn>
          <Btn variant="ghost" onClick={record} disabled={busy}>Run &amp; log decision</Btn>
        </div>
        <ErrorBox error={err} />
      </Panel>
      {busy && !res && <Spinner />}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Conviction" value={num(d.conviction)} tone={d.conviction > 0.1 ? 'good' : d.conviction < -0.1 ? 'bad' : undefined} />
            <Stat label="Proposed weight" value={pct(d.proposedWeight, 0)} />
            <Stat label="After risk gate" value={pct(d.weight, 0)} tone={d.risk.adjustments.length ? 'warn' : undefined} />
            <Stat label="Realised vol (ann.)" value={pct(d.risk.annVol, 0)} />
            <Stat label="60d drawdown" value={pct(d.risk.drawdown60, 0)} />
          </div>
          <Panel title="Summary" sub={`narrative source: ${res.narrative.source}`}><p className="text-gray-200">{res.narrative.text}</p></Panel>
          <div className="grid gap-5 lg:grid-cols-3">
            {d.analysts.map((a: any) => (
              <Panel key={a.analyst} title={`${a.analyst[0].toUpperCase()}${a.analyst.slice(1)} analyst`} sub={`score ${num(a.score)} · track-record weight ${num(d.reliability[a.analyst])}`}>
                {a.evidence.length === 0 ? <p className="text-sm text-gray-500">No evidence available at this date.</p> :
                  <ul className="space-y-2 text-sm">{a.evidence.map((e: any) => <li key={e.id} className="flex gap-2"><Pill tone={e.direction > 0 ? 'good' : 'bad'}>{e.direction > 0 ? 'bull' : 'bear'}</Pill><span className="text-gray-300">{e.text} <span className="text-gray-500">(weight {num(e.weight)})</span></span></li>)}</ul>}
              </Panel>
            ))}
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Bull / bear debate" sub={`bull ${num(d.bullScore)} vs bear ${num(d.bearScore)} (rebutted points count half)`}>
              <ul className="space-y-2 text-sm">{d.debate.map((t: any, i: number) => <li key={i} className="rounded-lg border border-gray-600 p-3"><Pill tone={t.speaker === 'bull' ? 'good' : 'bad'}>{t.speaker} · round {t.round}</Pill><p className="mt-1 text-gray-300">{t.claim}</p>{t.rebuts && <p className="mt-1 text-xs text-gray-500">rebuts {t.rebuts}</p>}</li>)}</ul>
            </Panel>
            <Panel title="Risk manager" sub="Deterministic. It can only shrink or veto.">
              {d.risk.adjustments.length === 0 ? <p className="text-sm text-gray-400">No adjustments: the proposed size passed every check.</p> : <ul className="space-y-2 text-sm">{d.risk.adjustments.map((a: any) => <li key={a.rule}><Pill tone="warn">{a.rule}</Pill> <span className="text-gray-300">{a.detail}</span></li>)}</ul>}
              {d.memories.length > 0 && <><h4 className="mb-1 mt-4 text-sm font-medium text-gray-200">Relevant memories</h4><ul className="space-y-1 text-xs text-gray-400">{d.memories.map((m: any) => <li key={m.id}>• {m.text}</li>)}</ul></>}
            </Panel>
          </div>
        </>
      )}

      <Panel title="Forward-test decision log" sub="Hash-chained and append-only. A decision is written before its outcome exists; outcomes are separate later entries, so history cannot be rewritten.">
        {log.loading && !log.data ? <Spinner /> : log.data && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2"><Pill tone={log.data.verify.ok ? 'good' : 'bad'}>{log.data.verify.ok ? `chain valid (${log.data.verify.length} entries)` : `BROKEN at #${log.data.verify.brokenAt}`}</Pill><Pill>{log.data.storage}</Pill></div>
            {log.data.scoreboard.length > 0 && <Table dense head={['Actor', 'Resolved', 'Open', 'Hit rate', 'Mean return']} rows={log.data.scoreboard.map((s: any) => [s.actor, s.resolved, s.open, s.hitRate == null ? 'n/a' : pct(s.hitRate, 0), s.meanReturn == null ? 'n/a' : pct(s.meanReturn, 2)])} />}
            {log.data.entries.length === 0 ? <p className="text-sm text-gray-500">No entries yet. Use “Run &amp; log decision”.</p> :
              <Table dense head={['#', 'Kind', 'Ticker', 'Decided at', 'Detail', '']} rows={log.data.entries.map((e: any) => [e.seq, e.kind, e.ticker, day(e.decidedAt), e.kind === 'decision' ? `weight ${num(e.payload.weight)}` : `fwd return ${pct(e.payload.forwardReturn, 2)}`, e.kind === 'decision' && !log.data.entries.some((o: any) => o.refSeq === e.seq) ? <Btn key={e.seq} variant="ghost" onClick={() => resolve(e.seq)} disabled={busy}>Resolve (10d)</Btn> : ''])} />}
            <p className="text-xs text-gray-500">On the synthetic universe, future bars already exist, so &ldquo;resolve&rdquo; reads the next 10 trading days. For live data you would resolve only after real time has passed. The mechanics, and the tamper-evidence, are identical.</p>
          </div>
        )}
      </Panel>
      <div className="hidden"><HBar items={[]} /></div>
    </div>
  );
}
