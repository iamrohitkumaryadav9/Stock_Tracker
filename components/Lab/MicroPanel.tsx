'use client';
import { useState } from 'react';
import { ErrorBox, HBar, LineChart, Note, Panel, Pill, Spinner, Stat, Table, Btn, useApi, num, pct } from './kit';

function Lob() {
  const { data: d, loading, error } = useApi<any>('/api/lab/micro?kind=lob');
  if (loading && !d) return <Spinner label="Training models on simulated order books…" />;
  if (error) return <ErrorBox error={error} />;
  if (!d) return null;
  return (
    <div className="space-y-5">
      <Note>Predict the mid-price move 10 steps ahead (down / flat / up) from top-5 book levels, imbalance, order flow and recent returns. Models are written from scratch. Train, validation and test sets are different simulator seeds (separate &ldquo;days&rdquo;). Then the real test: trade it, paying the spread at entry and exit.</Note>
      <Panel title="Classification vs profit" sub={`train ${d.sizes.train.toLocaleString()} · val ${d.sizes.val.toLocaleString()} · test ${d.sizes.test.toLocaleString()} samples. Test class balance (down/flat/up): ${d.models[0].cls.classBalance.map((x: number) => pct(x, 0)).join(' / ')}`}>
        <Table head={['Model', 'Accuracy', 'Macro-F1', 'Trades', 'Gross ticks/trade', 'Net ticks/trade', 'p(net>0)', 'Verdict']} rows={d.models.map((m: any) => [m.name, pct(m.cls.accuracy), num(m.cls.macroF1, 3), m.trading.trades, num(m.trading.grossTicksPerTrade), num(m.trading.netTicksPerTrade), num(m.trading.pValue, 3), <Pill key={m.name} tone={m.trading.significantlyProfitable ? 'good' : m.trading.trades === 0 ? 'gray' : 'bad'}>{m.trading.significantlyProfitable ? 'profitable' : m.trading.trades === 0 ? 'no trades' : 'not profitable'}</Pill>])} />
        <p className="mt-3 text-xs text-gray-500">Majority-class accuracy ({pct(d.models[0].cls.accuracy, 0)}) beats most models on raw accuracy because &ldquo;flat&rdquo; dominates, which is why macro-F1 and P&amp;L matter. With confidence thresholding:</p>
        <Table dense head={['Model', 'Trades', 'Net ticks/trade', 'p(net>0)']} rows={d.models.slice(1).map((m: any) => [m.name, m.tradingConfident.trades, num(m.tradingConfident.netTicksPerTrade), num(m.tradingConfident.pValue, 3)])} />
      </Panel>
      <Note tone="warn">{d.verdict}</Note>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Permutation feature importance (MLP, test set)"><HBar fmt={(v) => v.toFixed(3)} items={d.featureImportance.map((f: any) => ({ label: f.feature, value: f.dropInF1 }))} /></Panel>
        <Panel title="MLP validation loss (early stopping)"><LineChart height={150} series={[{ name: 'validation loss', data: d.valCurve, color: '#60a5fa' }]} /></Panel>
      </div>
    </div>
  );
}

function Exec() {
  const { data: d, loading, error } = useApi<any>('/api/lab/micro?kind=exec');
  if (loading && !d) return <Spinner label="Training a Q-learning execution agent (a few seconds)…" />;
  if (error) return <ErrorBox error={error} />;
  if (!d) return null;
  return (
    <div className="space-y-5">
      <Note>Sell {d.config.Q} shares within {d.config.T} steps, minimising implementation shortfall versus the arrival mid. A tabular Q-learning agent ({d.episodesTrained.toLocaleString()} training episodes) is compared with TWAP, dumping at once and random, on held-out seeds with a paired t-test. Published work warns RL agents in simulators often just rediscover TWAP, and this page reports it when that happens.</Note>
      <Panel title="Shortfall per share (ticks, lower is better)">
        <HBar items={d.results.map((r: any) => ({ label: `${r.name} ±${num(r.std, 1)}`, value: r.meanShortfall }))} color="#eab308" />
        <p className="mt-4 text-sm"><Pill tone={d.vsTwap.p < 0.05 ? (d.vsTwap.meanDiff < 0 ? 'good' : 'bad') : 'gray'}>agent − TWAP = {num(d.vsTwap.meanDiff)} ticks, p = {num(d.vsTwap.p, 3)}</Pill> <span className="text-gray-300">{d.vsTwap.verdict}</span></p>
      </Panel>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Learning curve (shortfall during training)"><LineChart height={150} series={[{ name: 'training shortfall (10-episode avg checkpoints)', data: d.learningCurve, color: '#34d399' }]} /></Panel>
        <Panel title="What the learned policy does" sub="Share of greedy actions by time bucket (child order size as a multiple of the TWAP slice)">
          <Table dense head={['Time', ...Object.keys(d.policySummary[0].share)]} rows={d.policySummary.map((p: any) => [p.timeBucket, ...Object.values(p.share).map((v: any) => pct(v, 0))])} />
        </Panel>
      </div>
    </div>
  );
}

function MM() {
  const { data: d, loading, error } = useApi<any>('/api/lab/micro?kind=mm');
  if (loading && !d) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  if (!d) return null;
  return (
    <div className="space-y-5">
      <Note>Market-maker inventory skew (Avellaneda-Stoikov-style): shift quotes against inventory so risk mean-reverts. Compared across 12 seeds. Reported as PnL and inventory risk, not a claim of profit.</Note>
      <Panel title="Quoting policy comparison"><Table head={['Policy', 'Mean PnL (tick·qty)', 'PnL std', 'Mean |inventory|', 'PnL/std']} rows={d.map((r: any) => [r.label, Math.round(r.meanPnl).toLocaleString(), Math.round(r.pnlStd).toLocaleString(), num(r.meanAbsInventory, 1), num(r.sharpeLike)])} /></Panel>
    </div>
  );
}

export default function MicroPanel() {
  const [tab, setTab] = useState<'lob' | 'exec' | 'mm'>('lob');
  return (
    <div className="space-y-5">
      <div className="flex gap-2">{([['lob', 'LOB direction model'], ['exec', 'RL execution vs TWAP'], ['mm', 'Market-making skew']] as const).map(([k, l]) => <Btn key={k} variant={tab === k ? 'primary' : 'ghost'} onClick={() => setTab(k)}>{l}</Btn>)}</div>
      {tab === 'lob' ? <Lob /> : tab === 'exec' ? <Exec /> : <MM />}
    </div>
  );
}
