'use client';
import { useState } from 'react';
import { Btn, ErrorBox, Note, Panel, Pill, Spinner, Table, useApi, num } from './kit';

export default function JournalPanel() {
  const [demo, setDemo] = useState(false);
  const { data: d, loading, error } = useApi<any>(`/api/lab/journal${demo ? '?demo=1' : ''}`);
  return (
    <div className="space-y-5">
      <Note>
        Behavioural-bias mining over your own trades: disposition effect, negative payoff asymmetry, revenge trading, overtrading and concentration. Each finding has a statistical test and the trades that support it.
        It refuses to opine on small samples. Uses your paper-trading history; if you have none it falls back to a demo trader who deliberately cuts winners and holds losers.
      </Note>
      <div className="flex gap-2"><Btn variant={demo ? 'ghost' : 'primary'} onClick={() => setDemo(false)}>My trades</Btn><Btn variant={demo ? 'primary' : 'ghost'} onClick={() => setDemo(true)}>Demo trader</Btn></div>
      <ErrorBox error={error} />
      {loading && !d && <Spinner />}
      {d && (
        <>
          <Panel title="Summary" sub={`${d.source} · ${d.trades} executions · ${d.lots} closed positions`}><p className="text-gray-200">{d.summary}</p></Panel>
          <div className="grid gap-5 lg:grid-cols-2">
            {d.findings.map((f: any) => (
              <Panel key={f.bias} title={f.bias} right={<Pill tone={f.detected ? (f.severity === 'high' ? 'bad' : 'warn') : 'good'}>{f.detected ? `${f.severity} severity` : 'not detected'}</Pill>}>
                <p className="text-sm text-gray-300">{f.explanation}</p>
                <p className="mt-2 text-xs text-gray-500">{f.stat}{f.p != null ? ` · p = ${num(f.p, 3)}` : ''}</p>
                {f.evidence.length > 0 && <ul className="mt-2 list-disc pl-5 text-xs text-gray-400">{f.evidence.map((e: string) => <li key={e}>{e}</li>)}</ul>}
                {f.detected && <p className="mt-3 rounded-lg bg-gray-900/60 p-2 text-sm text-yellow-200">Try: {f.suggestion}</p>}
              </Panel>
            ))}
          </div>
          {d.findings.length === 0 && <Table head={['Note']} rows={[['Not enough closed positions yet for reliable statistics.']]} />}
        </>
      )}
    </div>
  );
}
