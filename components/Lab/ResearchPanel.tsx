'use client';
import { useState } from 'react';
import { Btn, ErrorBox, Field, HBar, Note, Panel, Pill, Spinner, Stat, Table, inputCls, post, useApi, day, pct } from './kit';

const EXAMPLES = [
  "What was Northwind Semiconductors's revenue in 2024Q2?",
  'What was net income for Helio Grid Energy in 2024Q3?',
  'What risks does Meridian Bank Group cite related to credit losses?',
  'What revenue guidance did Aster Health Systems give for the quarter after 2025Q1?',
  'What was Northwind Semiconductors revenue in 2026Q1?',
];

export default function ResearchPanel({ range }: { range: { from: number; to: number } }) {
  const [question, setQuestion] = useState(EXAMPLES[0]);
  const [asOf, setAsOf] = useState(day(range.to));
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ev = useApi<any>('/api/lab/rageval');

  const ask = async () => {
    setBusy(true); setErr(null);
    try { setRes(await post('research', { question, asOf: Date.parse(asOf + 'T21:00:00Z') })); }
    catch (e) { setErr(e instanceof Error ? e.message : 'failed'); }
    finally { setBusy(false); }
  };
  return (
    <div className="space-y-5">
      <Note>
        Point-in-time RAG over company filings. The &ldquo;as of&rdquo; date controls what the system is allowed to know: filings not yet public are invisible, and a restated filing
        replaces the original only <i>after</i> the correction was filed. Answers are extractive with verified citations, and the system abstains when evidence is weak.
        The corpus is synthetic (fictional companies) so results are fully reproducible offline.
      </Note>
      <Panel title="Ask the filings">
        <div className="grid gap-3 md:grid-cols-[1fr_180px_auto] md:items-end">
          <Field label="Question"><input className={inputCls} value={question} onChange={(e) => setQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && ask()} /></Field>
          <Field label="As of (decision date)"><input className={inputCls} type="date" min="2023-03-01" max={day(range.to)} value={asOf} onChange={(e) => setAsOf(e.target.value)} /></Field>
          <Btn onClick={ask} disabled={busy}>Ask</Btn>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">{EXAMPLES.map((e) => <button key={e} onClick={() => setQuestion(e)} className="rounded-full border border-gray-600 px-3 py-1 text-xs text-gray-400 hover:border-yellow-500 hover:text-yellow-400">{e}</button>)}</div>
        <ErrorBox error={err} />
        {busy && <Spinner label="Retrieving…" />}
        {res && !busy && (
          <div className="mt-4 space-y-3">
            <div className={`rounded-lg border p-4 ${res.abstained ? 'border-yellow-800 bg-yellow-950/30' : 'border-emerald-800 bg-emerald-950/30'}`}>
              <div className="mb-1 flex items-center gap-2"><Pill tone={res.abstained ? 'warn' : 'good'}>{res.abstained ? 'abstained' : 'answered'}</Pill><span className="text-xs text-gray-500">confidence {res.confidence} • as of {day(res.asOf)}</span></div>
              <p className="text-gray-100">{res.answer}</p>
            </div>
            {res.citations.map((c: any) => <div key={c.chunkId} className="rounded-lg border border-gray-600 bg-gray-900/60 p-3 text-sm"><div className="text-xs text-gray-500">Source: {c.filingId} • filed {day(c.filedAt)}</div><blockquote className="mt-1 border-l-2 border-yellow-500 pl-3 text-gray-300">{c.quote}</blockquote></div>)}
            {res.notes.length > 0 && <p className="text-xs text-gray-500">{res.notes.join(' ')}</p>}
            <details className="text-xs text-gray-500"><summary className="cursor-pointer">Retrieval trace</summary><Table dense head={['Chunk', 'Section', 'Score']} rows={res.retrieved.map((r: any) => [r.chunkId, r.section, r.score])} /></details>
          </div>
        )}
      </Panel>

      <Panel title="Evaluation harness" sub="FinanceBench-style, on this corpus. Includes restatement-sensitive questions, unanswerable questions, and held-out phrasings.">
        {ev.loading && !ev.data ? <Spinner label="Evaluating…" /> : ev.error ? <ErrorBox error={ev.error} /> : ev.data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
              <Stat label="Questions" value={ev.data.n} />
              <Stat label="Accuracy" value={pct(ev.data.quantis.accuracy)} />
              <Stat label="Wrong answers" value={pct(ev.data.quantis.hallucination)} tone={ev.data.quantis.hallucination > 0.03 ? 'warn' : 'good'} hint="answered, but the figure was wrong" />
              <Stat label="Abstain when it should" value={pct(ev.data.quantis.abstentionRecall)} />
              <Stat label="False abstentions" value={pct(ev.data.quantis.falseAbstain)} tone="warn" />
              <Stat label="Citation validity" value={pct(ev.data.quantis.citationValidity)} />
            </div>
            <div>
              <h4 className="mb-2 text-sm font-medium text-gray-200">Accuracy by slice</h4>
              <HBar max={1} fmt={(v) => pct(v, 0)} items={Object.entries(ev.data.quantis.byWhy).map(([k, v]: any) => ({ label: `${k} (n=${v.n})`, value: v.accuracy }))} />
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Stat label="Naive baseline, strict judge" value={pct(ev.data.naive.strictAccuracy)} hint="top-1 retrieval, ignores dates, never abstains" />
              <Stat label="Same baseline, lenient judge" value={pct(ev.data.naive.lenientJudgeAccuracy)} tone="warn" />
              <Stat label="Judge inflation" value={`+${pct(ev.data.naive.judgeInflation, 0)}`} tone="bad" hint="how much a sloppy LLM-style judge overstates accuracy" />
            </div>
            <Note tone="warn">{ev.data.note}</Note>
            {ev.data.failures.length > 0 && <details className="text-sm"><summary className="cursor-pointer text-gray-400">Sample failures</summary><Table dense head={['Question', 'Gold', 'System']} rows={ev.data.failures.map((f: any) => [f.question, f.gold ?? '', f.answer])} /></details>}
          </div>
        )}
      </Panel>
    </div>
  );
}
