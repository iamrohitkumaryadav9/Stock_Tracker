'use client';
import { useEffect, useState } from 'react';
import { ErrorBox, Note, Panel, Pill, Spinner, Stat, useApi, day } from './kit';
import ExchangePanel from './ExchangePanel';
import VenuePanel from './VenuePanel';
import ResearchPanel from './ResearchPanel';
import AgentsPanel from './AgentsPanel';
import ForecastPanel from './ForecastPanel';
import EvaluatePanel from './EvaluatePanel';
import MicroPanel from './MicroPanel';
import JournalPanel from './JournalPanel';

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'evaluate', label: 'Evaluation engine' },
  { id: 'exchange', label: 'Exchange' },
  { id: 'venue', label: 'Trading & ledger' },
  { id: 'research', label: 'Filings RAG' },
  { id: 'agents', label: 'Agents' },
  { id: 'forecast', label: 'Forecasting' },
  { id: 'micro', label: 'Microstructure ML' },
  { id: 'journal', label: 'Bias mining' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function LabShell() {
  const [tab, setTab] = useState<TabId>('overview');
  const ov = useApi<any>('/api/lab/overview');
  useEffect(() => {
    try { const h = window.location.hash.slice(1) as TabId; if (TABS.some((t) => t.id === h)) setTab(h); } catch { /* ignore */ }
  }, []);
  const go = (t: TabId) => { setTab(t); try { history.replaceState(null, '', `#${t}`); } catch { /* ignore */ } };
  const o = ov.data;
  return (
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-100">Quantis Lab</h1>
        <p className="mt-1 text-gray-400">A point-in-time research and trading-simulation platform that judges AI trading ideas honestly.</p>
      </div>
      <nav className="mb-6 flex flex-wrap gap-1 border-b border-gray-600" aria-label="Lab sections">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => go(t.id)} className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${tab === t.id ? 'border-yellow-500 text-yellow-400' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>{t.label}</button>
        ))}
      </nav>
      <ErrorBox error={ov.error} />
      {tab === 'overview' && (o ? <Overview o={o} go={go} /> : <Spinner label="Loading…" />)}
      {o && tab === 'evaluate' && <EvaluatePanel tickers={o.tickers} />}
      {o && tab === 'exchange' && <ExchangePanel />}
      {o && tab === 'venue' && <VenuePanel />}
      {o && tab === 'research' && <ResearchPanel range={o.range} />}
      {o && tab === 'agents' && <AgentsPanel tickers={o.tickers} range={o.range} />}
      {o && tab === 'forecast' && <ForecastPanel tickers={o.tickers} />}
      {o && tab === 'micro' && <MicroPanel />}
      {o && tab === 'journal' && <JournalPanel />}
      <p className="mt-10 text-xs text-gray-600">Educational research software. Simulated and synthetic data only. Not financial advice, and nothing here claims a profitable strategy.</p>
    </div>
  );
}

function Overview({ o, go }: { o: any; go: (t: TabId) => void }) {
  const cards: { id: TabId; title: string; body: string }[] = [
    { id: 'evaluate', title: '5. Evaluation engine', body: 'Leak detector, walk-forward, deflated Sharpe, probability of backtest overfitting, cost model, hash-chained forward-test log.' },
    { id: 'exchange', title: '2. Exchange core', body: 'Deterministic limit order book, event-sourced replay, agent-based market simulator, stylised-fact realism checks.' },
    { id: 'venue', title: '3. Money core', body: 'Double-entry immutable ledger, idempotent orders, reconciliation, explainable pre-trade risk, surveillance.' },
    { id: 'research', title: '4a. Filings RAG', body: 'Point-in-time retrieval, restatement-aware, cited answers with abstention and an evaluation harness.' },
    { id: 'agents', title: '4b. Agent team', body: 'Analysts, bull/bear debate, layered memory, deterministic risk veto, tamper-evident decision log.' },
    { id: 'forecast', title: '4c. Forecasting', body: 'Baselines vs ensemble, conformal intervals with measured coverage, Diebold-Mariano tests.' },
    { id: 'micro', title: '4d. Microstructure ML', body: 'LOB direction models, cost-aware P&L, RL execution vs TWAP, market-making skew.' },
    { id: 'journal', title: '4e. Bias mining', body: 'Disposition effect, revenge trading, overtrading detected with statistical tests from your own trades.' },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Storage" value={o.storage} tone={o.storage === 'mongodb' ? 'good' : 'warn'} hint="memory = state resets on restart" />
        <Stat label="Data" value={o.dataSource} />
        <Stat label="Price bars" value={o.counts.bars.toLocaleString()} />
        <Stat label="Filings (restatements)" value={`${o.counts.filings} (${o.counts.restatements})`} />
        <Stat label="LLM" value={o.llm} />
      </div>
      <Note>
        Why this exists: most &ldquo;AI trading&rdquo; demos only show wins. This lab is built to <b>try to break its own ideas</b>: it tests for look-ahead, memorisation, overfitting, cost drag and miscalibrated judges, and it reports the failures (several of the results here are honestly negative).
        The world is synthetic ({day(o.range.from)} → {day(o.range.to)}, fictional companies) so everything is reproducible offline, and any edge found says nothing about real markets.
      </Note>
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => (
          <button key={c.id} onClick={() => go(c.id)} className="rounded-xl border border-gray-600 bg-gray-800 p-5 text-left transition hover:border-yellow-500">
            <div className="font-semibold text-gray-100">{c.title}</div>
            <p className="mt-1 text-sm text-gray-400">{c.body}</p>
          </button>
        ))}
      </div>
      <Panel title="Universe (fictional)"><div className="flex flex-wrap gap-2">{o.tickers.map((t: any) => <Pill key={t.ticker}>{t.ticker} · {t.name} · {t.sector}</Pill>)}</div></Panel>
    </div>
  );
}
