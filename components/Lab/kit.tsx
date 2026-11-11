'use client';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

/* ---------- data hooks ---------- */
export function useApi<T>(url: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(url, { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setData(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);
  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load, setData };
}
export async function post<T = any>(action: string, body: unknown): Promise<T> {
  const r = await fetch(`/api/lab/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

/* ---------- formatting ---------- */
export const pct = (x: number | null | undefined, d = 1) => (x == null || !Number.isFinite(x) ? 'n/a' : `${(x * 100).toFixed(d)}%`);
export const num = (x: number | null | undefined, d = 2) => (x == null || !Number.isFinite(x) ? 'n/a' : x.toFixed(d));
export const usd = (cents: number | null | undefined) => (cents == null ? 'n/a' : (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' }));
export const day = (t: number) => new Date(t).toISOString().slice(0, 10);

/* ---------- primitives ---------- */
export function Panel({ title, sub, children, right, className = '' }: { title?: string; sub?: string; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-gray-600 bg-gray-800 p-5 ${className}`}>
      {(title || right) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-base font-semibold text-gray-100">{title}</h3>}
            {sub && <p className="mt-0.5 text-sm text-gray-500">{sub}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}
export function Stat({ label, value, tone, hint }: { label: string; value: ReactNode; tone?: 'good' | 'bad' | 'warn'; hint?: string }) {
  const c = tone === 'good' ? 'text-emerald-400' : tone === 'bad' ? 'text-red-400' : tone === 'warn' ? 'text-yellow-400' : 'text-gray-100';
  return (
    <div className="rounded-lg border border-gray-600 bg-gray-900/60 px-4 py-3" title={hint}>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${c}`}>{value}</div>
    </div>
  );
}
export function Pill({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'good' | 'bad' | 'warn' | 'info' }) {
  const m = { gray: 'bg-gray-700 text-gray-300', good: 'bg-emerald-900/60 text-emerald-300', bad: 'bg-red-900/60 text-red-300', warn: 'bg-yellow-900/50 text-yellow-300', info: 'bg-blue-900/50 text-blue-300' }[tone];
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${m}`}>{children}</span>;
}
export function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'bad' }) {
  const m = { info: 'border-blue-800 bg-blue-950/40 text-blue-200', warn: 'border-yellow-800 bg-yellow-950/30 text-yellow-200', bad: 'border-red-800 bg-red-950/40 text-red-200' }[tone];
  return <div className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${m}`}>{children}</div>;
}
export function Btn({ children, onClick, disabled, variant = 'primary', type = 'button' }: { children: ReactNode; onClick?: () => void; disabled?: boolean; variant?: 'primary' | 'ghost' | 'danger'; type?: 'button' | 'submit' }) {
  const m = { primary: 'bg-yellow-500 text-gray-900 hover:bg-yellow-400', ghost: 'border border-gray-600 text-gray-300 hover:bg-gray-700', danger: 'bg-red-600 text-white hover:bg-red-500' }[variant];
  return <button type={type} onClick={onClick} disabled={disabled} className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${m}`}>{children}</button>;
}
export const inputCls = 'rounded-lg border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 focus:border-yellow-500 focus:outline-none';
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="flex flex-col gap-1 text-xs text-gray-400">{label}{children}</label>;
}
export function Spinner({ label = 'Running…' }: { label?: string }) {
  return <div className="flex items-center gap-2 py-6 text-sm text-gray-400"><span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-600 border-t-yellow-500" />{label}</div>;
}
export function ErrorBox({ error }: { error: string | null }) {
  return error ? <Note tone="bad">{error}</Note> : null;
}
export function Table({ head, rows, dense }: { head: string[]; rows: ReactNode[][]; dense?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead><tr className="border-b border-gray-600 text-xs uppercase tracking-wide text-gray-500">{head.map((h) => <th key={h} className={`${dense ? 'py-1.5' : 'py-2'} pr-4 font-medium`}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-gray-700/60 text-gray-300">{r.map((c, j) => <td key={j} className={`${dense ? 'py-1.5' : 'py-2'} pr-4 tabular-nums`}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

/* ---------- charts (dependency-free SVG) ---------- */
export function LineChart({ series, height = 180, labels, band }: { series: { name: string; data: number[]; color: string; dashed?: boolean }[]; height?: number; labels?: string[]; band?: { lo: number[]; hi: number[]; color: string } }) {
  const W = 700, H = height, P = 28;
  const all = series.flatMap((s) => s.data).concat(band ? [...band.lo, ...band.hi] : []).filter(Number.isFinite);
  if (!all.length) return null;
  const lo = Math.min(...all), hi = Math.max(...all), span = hi - lo || 1;
  const n = Math.max(...series.map((s) => s.data.length));
  const x = (i: number) => P + (i / Math.max(1, n - 1)) * (W - P - 8);
  const y = (v: number) => H - P / 1.5 - ((v - lo) / span) * (H - P * 1.4);
  const path = (d: number[]) => d.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
        {[0, 0.5, 1].map((f) => <g key={f}><line x1={P} x2={W - 8} y1={y(lo + span * f)} y2={y(lo + span * f)} stroke="#374151" strokeDasharray="3 3" /><text x={2} y={y(lo + span * f) + 4} fontSize="10" fill="#6b7280">{(lo + span * f).toFixed(span < 5 ? 2 : 0)}</text></g>)}
        {band && <path d={`${band.hi.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ')} ${[...band.lo].reverse().map((v, i) => `L${x(band.lo.length - 1 - i)},${y(v)}`).join(' ')} Z`} fill={band.color} opacity="0.18" />}
        {series.map((s) => <path key={s.name} d={path(s.data)} fill="none" stroke={s.color} strokeWidth="1.6" strokeDasharray={s.dashed ? '5 4' : undefined} />)}
        {labels && labels.length > 1 && [0, labels.length - 1].map((i) => <text key={i} x={x(i * (n - 1) / (labels.length - 1))} y={H - 4} fontSize="10" fill="#6b7280" textAnchor={i ? 'end' : 'start'}>{labels[i]}</text>)}
      </svg>
      <div className="mt-1 flex flex-wrap gap-4 text-xs text-gray-400">{series.map((s) => <span key={s.name} className="flex items-center gap-1.5"><i className="inline-block h-0.5 w-4" style={{ background: s.color }} />{s.name}</span>)}</div>
    </div>
  );
}
export function DepthChart({ bids, asks }: { bids: { price: number; qty: number }[]; asks: { price: number; qty: number }[] }) {
  const rows = [...asks.slice(0, 8).reverse().map((a) => ({ ...a, side: 'ask' as const })), ...bids.slice(0, 8).map((b) => ({ ...b, side: 'bid' as const }))];
  const max = Math.max(1, ...rows.map((r) => r.qty));
  return (
    <div className="space-y-0.5 font-mono text-xs">
      {rows.map((r, i) => (
        <div key={i} className="relative flex items-center justify-between rounded px-2 py-0.5">
          <div className={`absolute inset-y-0 right-0 rounded ${r.side === 'ask' ? 'bg-red-500/20' : 'bg-emerald-500/20'}`} style={{ width: `${(r.qty / max) * 100}%` }} />
          <span className={`relative ${r.side === 'ask' ? 'text-red-300' : 'text-emerald-300'}`}>{(r.price / 100).toFixed(2)}</span>
          <span className="relative text-gray-300">{r.qty}</span>
        </div>
      ))}
    </div>
  );
}
export function HBar({ items, max, fmt = (v: number) => v.toFixed(2), color = '#eab308' }: { items: { label: string; value: number }[]; max?: number; fmt?: (v: number) => string; color?: string }) {
  const m = max ?? Math.max(...items.map((i) => Math.abs(i.value)), 1e-9);
  return (
    <div className="space-y-1.5">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-3 text-xs">
          <span className="w-44 shrink-0 truncate text-gray-400" title={i.label}>{i.label}</span>
          <div className="relative h-3 flex-1 rounded bg-gray-700"><div className="absolute inset-y-0 left-0 rounded" style={{ width: `${Math.min(100, (Math.abs(i.value) / m) * 100)}%`, background: i.value < 0 ? '#f87171' : color }} /></div>
          <span className="w-16 text-right tabular-nums text-gray-300">{fmt(i.value)}</span>
        </div>
      ))}
    </div>
  );
}
