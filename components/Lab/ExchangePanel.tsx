'use client';
import { useState } from 'react';
import { DepthChart, ErrorBox, LineChart, Note, Panel, Pill, Spinner, Stat, Table, Btn, Field, inputCls, useApi, num } from './kit';

export default function ExchangePanel() {
  const [seed, setSeed] = useState(3);
  const [steps, setSteps] = useState(1500);
  const [q, setQ] = useState({ seed: 3, steps: 1500 });
  const { data: d, error, loading } = useApi<any>(`/api/lab/market?seed=${q.seed}&steps=${q.steps}`);

  return (
    <div className="space-y-5">
      <Note>
        A from-scratch limit-order-book matching engine (price-time priority; limit, market, IOC, FOK; cancel/replace; self-trade prevention) driven by market makers,
        noise traders and informed traders. Every run is seeded and event-sourced: replaying the command log must reproduce the exact book. The engine is
        differentially tested against a naive reference implementation.
      </Note>
      <Panel title="Simulate a market" right={loading ? <span className="text-xs text-gray-500">running…</span> : null}>
        <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); setQ({ seed, steps }); }}>
          <Field label="Random seed"><input className={inputCls} type="number" value={seed} min={1} onChange={(e) => setSeed(+e.target.value)} /></Field>
          <Field label="Steps (200 - 4000)"><input className={inputCls} type="number" value={steps} min={200} max={4000} step={100} onChange={(e) => setSteps(+e.target.value)} /></Field>
          <Btn type="submit" disabled={loading}>Run simulation</Btn>
        </form>
      </Panel>
      <ErrorBox error={error} />
      {loading && !d && <Spinner />}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Stat label="Commands" value={d.stats.commands.toLocaleString()} />
            <Stat label="Trades" value={d.stats.trades.toLocaleString()} />
            <Stat label="Avg spread (ticks)" value={num(d.stats.avgSpread)} />
            <Stat label="Book invariants" value={d.integrity.invariantViolations.length === 0 ? 'healthy' : `${d.integrity.invariantViolations.length} violated`} tone={d.integrity.invariantViolations.length ? 'bad' : 'good'} />
            <Stat label="Replay == live" value={d.integrity.replayHashMatches ? 'identical' : 'MISMATCH'} tone={d.integrity.replayHashMatches ? 'good' : 'bad'} hint={`state hash ${d.integrity.stateHash}`} />
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <Panel title="Mid price vs hidden fundamental" sub="Prices in ticks (cents). The informed traders pull the book toward the fundamental." className="lg:col-span-2">
              <LineChart series={[{ name: 'book mid', data: d.mids, color: '#eab308' }, { name: 'fundamental value', data: d.fundamental, color: '#60a5fa', dashed: true }]} />
            </Panel>
            <Panel title="Final order book depth"><DepthChart bids={d.depth.bids} asks={d.depth.asks} /></Panel>
          </div>
          <Panel title="Realism check: stylised facts" sub="A simulator that cannot reproduce basic empirical regularities should not be used to train or judge trading models.">
            <Table head={['Property', 'Value', 'Expected', 'Result']} rows={d.facts.map((f: any) => [f.name, num(f.value, 3), f.expected, <Pill key={f.name} tone={f.pass ? 'good' : 'bad'}>{f.pass ? 'pass' : 'fail'}</Pill>])} />
            <p className="mt-3 text-xs text-gray-500">Caveat: heavy tails here partly come from a jump process I added, so kurtosis is likely higher than a typical liquid equity. Passing these checks means the simulator is not obviously wrong, not that it is realistic.</p>
          </Panel>
        </>
      )}
    </div>
  );
}
