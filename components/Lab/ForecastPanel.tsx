'use client';
import { useState } from 'react';
import { ErrorBox, Field, LineChart, Note, Panel, Pill, Spinner, Stat, Table, inputCls, useApi, num, pct, day } from './kit';

export default function ForecastPanel({ tickers }: { tickers: { ticker: string; name: string }[] }) {
  const [ticker, setTicker] = useState(tickers[0]?.ticker ?? 'NWSC');
  const { data: d, loading, error } = useApi<any>(`/api/lab/forecast?ticker=${ticker}`);
  const ens = d?.evaluation.reports.find((r: any) => r.model.startsWith('ensemble'));
  return (
    <div className="space-y-5">
      <Note>
        Forecasts carry uncertainty, and the uncertainty is <b>measured</b>, not assumed. Each model emits a mean and a sigma; online split-conformal prediction (calibrated only on outcomes already
        known at forecast time) turns them into intervals, and we report their real coverage. Heavy models are always compared with naive, drift, EWMA and GARCH baselines using a
        Diebold-Mariano test. Foundation models (Kronos / TimesFM / Chronos) are not bundled because they need GPUs; they plug in through an HTTP adapter ({d?.foundationModel ?? '…'}).
      </Note>
      <Field label="Ticker"><select className={`${inputCls} w-64`} value={ticker} onChange={(e) => setTicker(e.target.value)}>{tickers.map((t) => <option key={t.ticker} value={t.ticker}>{t.ticker} · {t.name}</option>)}</select></Field>
      <ErrorBox error={error} />
      {loading && !d && <Spinner label="Walk-forward evaluation…" />}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Out-of-sample forecasts" value={ens.n} />
            <Stat label="Interval coverage" value={`${pct(ens.coverage)} (target ${pct(ens.nominal, 0)})`} tone={Math.abs(ens.coverage - ens.nominal) < 0.04 ? 'good' : 'warn'} />
            <Stat label="Directional accuracy" value={pct(ens.directionalAcc)} hint={`p=${num(ens.directionalP, 3)} vs coin flip`} />
            <Stat label="Beats naive?" value={ens.dmVsNaive && ens.dmVsNaive.p < 0.05 && ens.dmVsNaive.stat < 0 ? 'yes' : 'not significantly'} tone={ens.dmVsNaive && ens.dmVsNaive.p < 0.05 && ens.dmVsNaive.stat < 0 ? 'good' : 'warn'} />
          </div>
          <Panel title="Next 5-day forecast bands (90%)" sub="Latest close, then each model's central forecast and band">
            <LineChart series={[{ name: 'close (last 120 days)', data: d.history.map((h: any) => h.c), color: '#eab308' }]} labels={[day(d.history[0].t), day(d.history[d.history.length - 1].t)]} />
            <Table dense head={['Model', 'Mean', 'Low', 'High', 'Width']} rows={d.next.map((n: any) => [n.model, n.mean.toFixed(2), n.lo.toFixed(2), n.hi.toFixed(2), pct((n.hi - n.lo) / n.mean)])} />
          </Panel>
          <Panel title="Walk-forward scorecard (1-day horizon)">
            <Table head={['Model', 'RMSE', 'Dir. acc.', 'Coverage', 'Avg width', 'Log score', 'DM vs naive (p)']} rows={d.evaluation.reports.map((r: any) => [r.model, r.rmse.toFixed(5), pct(r.directionalAcc), pct(r.coverage), r.avgWidth.toFixed(4), r.meanLogScore.toFixed(3), r.dmVsNaive ? <Pill key={r.model} tone={r.dmVsNaive.p < 0.05 && r.dmVsNaive.stat < 0 ? 'good' : 'gray'}>{r.dmVsNaive.p.toFixed(3)}</Pill> : 'baseline'])} />
            <p className="mt-3 text-xs text-gray-500">{d.evaluation.note} Point forecasts of daily returns barely beat zero in efficient-ish markets, so the useful output here is the volatility and the calibrated interval, not the direction.</p>
          </Panel>
        </>
      )}
    </div>
  );
}
