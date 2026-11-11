'use client';
import { useState } from 'react';
import { ErrorBox, Field, HBar, LineChart, Note, Panel, Pill, Spinner, Stat, Table, inputCls, useApi, num, pct } from './kit';

const COLORS = ['#9ca3af', '#eab308', '#60a5fa', '#34d399'];
export default function EvaluatePanel({ tickers }: { tickers: { ticker: string; name: string }[] }) {
  const [ticker, setTicker] = useState(tickers[0]?.ticker ?? 'NWSC');
  const { data: d, loading, error } = useApi<any>(`/api/lab/evaluate?ticker=${ticker}`);
  const v = d?.study.verdict;
  return (
    <div className="space-y-5">
      <Note>
        The evaluation engine is the core of the project. It asks of any strategy or agent: <b>Did it use the future?</b> (temporal non-interference test), <b>Is it just the best of many tries?</b> (deflated Sharpe, probability of backtest
        overfitting), <b>Does it survive out of sample?</b> (walk-forward), and <b>Does it survive costs?</b> (commission, spread, square-root impact, borrow, next-open execution). Data here is synthetic with a planted post-earnings drift,
        so an &ldquo;edge&rdquo; is possible by construction. The point is whether the machinery judges it honestly.
      </Note>
      <Field label="Ticker"><select className={`${inputCls} w-64`} value={ticker} onChange={(e) => setTicker(e.target.value)}>{tickers.map((t) => <option key={t.ticker} value={t.ticker}>{t.ticker} · {t.name}</option>)}</select></Field>
      <ErrorBox error={error} />
      {loading && !d && <Spinner label="Running grid search, walk-forward, DSR, PBO and leak tests…" />}
      {d && (
        <>
          <Panel title="Verdict on the best strategy found" right={<Pill tone={v.level === 'pass' ? 'good' : v.level === 'warn' ? 'warn' : 'bad'}>{v.level.toUpperCase()}</Pill>} sub={`${d.study.nTrials} configurations searched. Best: ${d.study.best.id}`}>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <Stat label="Best Sharpe (net)" value={num(d.study.best.sharpe)} />
              <Stat label="Sharpe 95% CI" value={`${num(d.study.best.ci.lo, 1)} … ${num(d.study.best.ci.hi, 1)}`} hint="stationary bootstrap" />
              <Stat label="Deflated Sharpe" value={num(d.study.best.dsr)} tone={d.study.best.dsr >= 0.95 ? 'good' : d.study.best.dsr >= 0.5 ? 'warn' : 'bad'} hint="probability the true Sharpe beats what luck would produce after this many trials" />
              <Stat label="Prob. of overfitting" value={pct(d.study.pbo.pbo, 0)} tone={d.study.pbo.pbo > 0.5 ? 'bad' : d.study.pbo.pbo > 0.25 ? 'warn' : 'good'} hint="CSCV" />
              <Stat label="Walk-forward OOS Sharpe" value={num(d.study.walkForward.oosSharpe)} tone={d.study.walkForward.oosSharpe < 0 ? 'bad' : undefined} hint={`in-sample avg ${num(d.study.walkForward.meanIsSharpe)}`} />
            </div>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-gray-300">{v.reasons.map((r: string) => <li key={r}>{r}</li>)}</ul>
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Leak detector" sub="Replace everything known after t with garbage; a decision at t must not change.">
              <Table head={['Strategy', 'Checks', 'Violations', 'Result']} rows={d.leaks.map((l: any) => [l.strategy, l.checks, l.violations, <Pill key={l.strategy} tone={l.leaky ? 'bad' : 'good'}>{l.leaky ? 'USES THE FUTURE' : 'clean'}</Pill>])} />
              <p className="mt-3 text-sm text-gray-400">Why it matters: the deliberately leaky strategy scores <b className="text-red-300">Sharpe {num(d.leakyIllusion.sharpe, 1)}</b> in a naive backtest ({pct(d.leakyIllusion.totalReturn, 0)} return). {d.leakyIllusion.note}</p>
            </Panel>
            <Panel title="Transaction-cost sensitivity" sub="momentum(20) Sharpe under three cost regimes">
              <HBar items={d.costSensitivity.map((c: any) => ({ label: c.label, value: c.sharpe }))} />
              <p className="mt-3 text-xs text-gray-500">Edges that vanish when costs rise are usually not edges.</p>
            </Panel>
          </div>

          <Panel title="Equity curves (net of costs)">
            <LineChart height={220} series={d.runs.map((r: any, i: number) => ({ name: `${r.name} (Sharpe ${num(r.metrics.sharpe)})`, data: r.equity, color: COLORS[i % COLORS.length] }))} />
            <Table dense head={['Strategy', 'Return', 'CAGR', 'Vol', 'Sharpe', 'Max DD', 'Turnover', 'Cost drag (bps)']} rows={d.runs.map((r: any) => [r.name, pct(r.metrics.totalReturn), pct(r.metrics.cagr), pct(r.metrics.annVol), num(r.metrics.sharpe), pct(r.metrics.maxDrawdown), num(r.metrics.turnover, 1), num(r.metrics.costDragBps, 0)])} />
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Walk-forward folds" sub="Choose the best config on the past year, trade the next quarter, repeat.">
              <Table dense head={['Test window', 'Chosen', 'IS Sharpe', 'OOS Sharpe']} rows={d.study.walkForward.folds.map((f: any) => [`${f.test[0]} → ${f.test[1]}`, f.chosen, num(f.isSharpe), num(f.oosSharpe)])} />
              <p className="mt-2 text-xs text-gray-500">In-sample average {num(d.study.walkForward.meanIsSharpe)} vs out-of-sample {num(d.study.walkForward.oosSharpe)}: the gap is the optimism you would have fooled yourself with.</p>
            </Panel>
            <Panel title="Leaderboard (all configs searched)"><HBar items={d.study.leaderboard.slice(0, 12).map((l: any) => ({ label: l.id, value: l.sharpe }))} /></Panel>
          </div>
        </>
      )}
    </div>
  );
}
