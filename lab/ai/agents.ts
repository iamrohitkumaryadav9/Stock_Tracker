import type { StrategyCtx, Strategy } from '@/lab/eval/backtest';
import { mean, std, clamp } from '@/lab/core/util';
import { AgentMemory } from './memory';
import { DAY } from '@/lab/data/types';

/**
 * Multi-agent research team. Roles: technical, fundamental and sentiment analysts -> bull/bear researchers
 * debate -> trader -> risk manager with veto. The deterministic core below sees ONLY a point-in-time context,
 * so the whole team is backtestable and leak-testable exactly like a plain strategy. An LLM (optional) writes
 * the narrative from the structured evidence; it can never change the numbers or the position.
 */
export interface Evidence { id: string; analyst: 'technical' | 'fundamental' | 'sentiment'; text: string; weight: number; direction: 1 | -1 }
export interface AnalystReport { analyst: Evidence['analyst']; score: number; evidence: Evidence[] }
export interface DebateTurn { speaker: 'bull' | 'bear'; round: number; claim: string; evidenceIds: string[]; rebuts?: string }
export interface RiskReview { approved: boolean; originalWeight: number; finalWeight: number; adjustments: { rule: string; detail: string }[]; annVol: number; drawdown60: number }
export interface TeamDecision {
  ticker: string;
  asOf: number;
  analysts: AnalystReport[];
  debate: DebateTurn[];
  bullScore: number;
  bearScore: number;
  conviction: number;
  proposedWeight: number;
  risk: RiskReview;
  weight: number;
  memories: { id: string; text: string; score: number }[];
  reliability: Record<string, number>;
}

const POS = ['beats', 'lifts', 'strong', 'healthy', 'upgrade', 'record', 'growth', 'surge'];
const NEG = ['misses', 'slide', 'slowing', 'pressure', 'downgrade', 'recall', 'probe', 'warning', 'cut'];

function technical(c: StrategyCtx): AnalystReport {
  const px = c.bars.map((b) => b.c), n = px.length, ev: Evidence[] = [];
  if (n < 70) return { analyst: 'technical', score: 0, evidence: [] };
  const sma = (k: number) => mean(px.slice(-k));
  const last = px[n - 1];
  const trend = (sma(20) - sma(60)) / sma(60);
  const mom = last / px[n - 61] - 1;
  const rets = px.slice(-15).map((x, i, a) => (i ? Math.log(x / a[i - 1]) : 0)).slice(1);
  const gains = rets.filter((r) => r > 0).reduce((s, r) => s + r, 0), losses = -rets.filter((r) => r < 0).reduce((s, r) => s + r, 0);
  const rsi = losses === 0 ? 100 : 100 - 100 / (1 + gains / losses);
  ev.push({ id: 't-trend', analyst: 'technical', text: `20d average is ${(trend * 100).toFixed(1)}% ${trend >= 0 ? 'above' : 'below'} the 60d average`, weight: clamp(Math.abs(trend) * 12, 0, 1), direction: trend >= 0 ? 1 : -1 });
  ev.push({ id: 't-mom', analyst: 'technical', text: `60-day momentum ${(mom * 100).toFixed(1)}%`, weight: clamp(Math.abs(mom) * 3, 0, 1), direction: mom >= 0 ? 1 : -1 });
  if (rsi > 72 || rsi < 28) ev.push({ id: 't-rsi', analyst: 'technical', text: `RSI(14) ${rsi.toFixed(0)} is ${rsi > 72 ? 'overbought' : 'oversold'}`, weight: 0.5, direction: rsi > 72 ? -1 : 1 });
  return { analyst: 'technical', score: clamp(ev.reduce((s, e) => s + e.direction * e.weight, 0) / 2, -1, 1), evidence: ev };
}

function fundamental(c: StrategyCtx): AnalystReport {
  const f = c.filings, ev: Evidence[] = [];
  if (f.length < 3) return { analyst: 'fundamental', score: 0, evidence: [] };
  const g = (i: number) => f[i].facts.revenue / f[i - 1].facts.revenue - 1;
  const L = f.length - 1;
  const surprise = g(L) - mean([g(L - 1), L > 2 ? g(L - 2) : g(L - 1)]);
  const age = (c.asOf - f[L].filedAt) / DAY;
  const fresh = clamp(1 - age / 25, 0, 1); // the market reacts quickly; evidence decays within ~a month
  ev.push({ id: 'f-surprise', analyst: 'fundamental', text: `Latest revenue growth ${(g(L) * 100).toFixed(1)}% vs trailing ${(mean([g(L - 1), g(L > 2 ? L - 2 : L - 1)]) * 100).toFixed(1)}% (${f[L].period}, filed ${age.toFixed(0)}d ago)`, weight: clamp(Math.abs(surprise) * 20, 0, 1) * (0.3 + 0.7 * fresh), direction: surprise >= 0 ? 1 : -1 });
  const margin = f[L].facts.netIncome / f[L].facts.revenue, pm = f[L - 1].facts.netIncome / f[L - 1].facts.revenue;
  ev.push({ id: 'f-margin', analyst: 'fundamental', text: `Net margin ${(margin * 100).toFixed(1)}% vs ${(pm * 100).toFixed(1)}% previous quarter`, weight: clamp(Math.abs(margin - pm) * 15, 0, 1) * (0.3 + 0.7 * fresh), direction: margin >= pm ? 1 : -1 });
  const impl = f[L].facts.guidance / f[L].facts.revenue - 1;
  ev.push({ id: 'f-guide', analyst: 'fundamental', text: `Guidance implies ${(impl * 100).toFixed(1)}% next-quarter growth`, weight: clamp(Math.abs(impl - g(L)) * 10, 0, 0.6), direction: impl >= g(L) ? 1 : -1 });
  if (f[L].form.endsWith('/A')) ev.push({ id: 'f-restate', analyst: 'fundamental', text: 'Latest filing is a restatement: prior figures were corrected', weight: 0.5, direction: -1 });
  return { analyst: 'fundamental', score: clamp(ev.reduce((s, e) => s + e.direction * e.weight, 0) / 2, -1, 1), evidence: ev };
}

function sentiment(c: StrategyCtx): AnalystReport {
  const recent = c.news.filter((n) => c.asOf - n.publishedAt < 10 * DAY).slice(-6);
  const ev: Evidence[] = recent.map((n, i) => {
    const t = (n.headline + ' ' + n.body).toLowerCase();
    const s = POS.filter((w) => t.includes(w)).length - NEG.filter((w) => t.includes(w)).length;
    return { id: `s-${i}`, analyst: 'sentiment' as const, text: `"${n.headline}"`, weight: clamp(Math.abs(s) / 3, 0, 1) * Math.exp(-(c.asOf - n.publishedAt) / (5 * DAY)), direction: (s >= 0 ? 1 : -1) as 1 | -1 };
  }).filter((e) => e.weight > 0.05);
  return { analyst: 'sentiment', score: clamp(ev.reduce((s, e) => s + e.direction * e.weight, 0), -1, 1), evidence: ev };
}

/** Structured debate: the bear rebuts the bull's strongest point (and vice versa); rebutted evidence counts for half. */
function debate(all: Evidence[]) {
  const bull = all.filter((e) => e.direction === 1).sort((a, b) => b.weight - a.weight);
  const bear = all.filter((e) => e.direction === -1).sort((a, b) => b.weight - a.weight);
  const turns: DebateTurn[] = [];
  const rebutted = new Set<string>();
  for (let r = 1; r <= 2; r++) {
    const bb = bull.find((e) => !rebutted.has(e.id)), br = bear.find((e) => !rebutted.has(e.id));
    if (bb) { turns.push({ speaker: 'bull', round: r, claim: bb.text, evidenceIds: [bb.id], rebuts: r > 1 && br ? br.id : undefined }); if (r > 1 && br) rebutted.add(br.id); }
    if (br) { turns.push({ speaker: 'bear', round: r, claim: br.text, evidenceIds: [br.id], rebuts: bb?.id }); if (bb) rebutted.add(bb.id); }
  }
  const val = (list: Evidence[]) => list.reduce((s, e) => s + e.weight * (rebutted.has(e.id) ? 0.5 : 1), 0);
  return { turns, bull: val(bull), bear: val(bear) };
}

export interface TeamOpts {
  memory?: AgentMemory;
  maxWeight?: number;
  targetVol?: number; // annualised
  threshold?: number; // minimum |conviction| to take a position
}

export function runTeam(c: StrategyCtx, opts: TeamOpts = {}): TeamDecision {
  const { maxWeight = 1, targetVol = 0.2, threshold = 0.12, memory } = opts;
  const analysts = [technical(c), fundamental(c), sentiment(c)];
  const all = analysts.flatMap((a) => a.evidence);
  const d = debate(all);
  const rel: Record<string, number> = {};
  for (const a of analysts) rel[a.analyst] = memory ? memory.reliability(a.analyst, c.asOf) : 0.5;
  // trader: reliability-weighted analyst scores, then the debate balance as a tie-break
  const wsum = analysts.reduce((s, a) => s + rel[a.analyst], 0) || 1;
  const blend = analysts.reduce((s, a) => s + a.score * rel[a.analyst], 0) / wsum;
  const debateBalance = d.bull + d.bear > 0 ? (d.bull - d.bear) / (d.bull + d.bear) : 0;
  const conviction = clamp(0.75 * blend + 0.25 * debateBalance * Math.min(1, (d.bull + d.bear) / 2), -1, 1);
  const proposed = Math.abs(conviction) >= threshold ? clamp(conviction * 1.5, -maxWeight, maxWeight) : 0;

  // risk manager: deterministic, can only reduce or veto
  const px = c.bars.map((b) => b.c);
  const rets = px.slice(-21).map((x, i, a) => (i ? Math.log(x / a[i - 1]) : 0)).slice(1);
  const annVol = rets.length > 5 ? std(rets) * Math.sqrt(252) : 0.3;
  const peak = Math.max(...px.slice(-60));
  const dd60 = px.length ? px[px.length - 1] / peak - 1 : 0;
  let w = proposed;
  const adj: RiskReview['adjustments'] = [];
  const cap = annVol > 0 ? targetVol / annVol : 1;
  if (Math.abs(w) > cap) { adj.push({ rule: 'VOL_TARGET', detail: `annualised vol ${(annVol * 100).toFixed(0)}% > target ${(targetVol * 100).toFixed(0)}%: size capped at ${cap.toFixed(2)}` }); w = Math.sign(w) * cap; }
  if (dd60 < -0.2 && w > 0) { adj.push({ rule: 'DRAWDOWN_GUARD', detail: `60d drawdown ${(dd60 * 100).toFixed(0)}%: long size halved` }); w *= 0.5; }
  if (c.filings.length && c.asOf - c.filings[c.filings.length - 1].filedAt < 0) { adj.push({ rule: 'FUTURE_FILING', detail: 'filing timestamp is after decision time: vetoed' }); w = 0; }
  const risk: RiskReview = { approved: w !== 0 || proposed === 0, originalWeight: proposed, finalWeight: w, adjustments: adj, annVol, drawdown60: dd60 };

  const situation = `${c.ticker} ${analysts.map((a) => `${a.analyst} ${a.score.toFixed(1)}`).join(' ')} ${all.map((e) => e.text).join(' ')}`;
  const mems = memory ? memory.retrieve(situation, c.asOf, c.ticker, 3).map((x) => ({ id: x.m.id, text: x.m.text, score: +x.score.toFixed(3) })) : [];
  return { ticker: c.ticker, asOf: c.asOf, analysts, debate: d.turns, bullScore: d.bull, bearScore: d.bear, conviction, proposedWeight: proposed, risk, weight: w, memories: mems, reliability: rel };
}

/** The whole team as a plain Strategy: this is what gets backtested, leak-tested and forward-logged. */
export const teamStrategy = (opts: TeamOpts = {}): Strategy => ({ name: 'agent team (analysts + debate + risk gate)', decide: (c) => runTeam(c, opts).weight });

/* ---------------- narrative ---------------- */
export interface LLM { name: string; complete(system: string, prompt: string): Promise<string> }

export async function geminiLLM(apiKey: string, model = 'gemini-2.5-flash-lite'): Promise<LLM> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const m = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model });
  return { name: model, async complete(system, prompt) { const r = await m.generateContent({ systemInstruction: system, contents: [{ role: 'user', parts: [{ text: prompt }] }] }); return r.response.text(); } };
}

export function templateNarrative(d: TeamDecision): string {
  const dir = d.weight > 0 ? 'long' : d.weight < 0 ? 'short' : 'flat';
  const top = d.analysts.flatMap((a) => a.evidence).sort((a, b) => b.weight - a.weight).slice(0, 3);
  const adj = d.risk.adjustments.map((a) => a.rule).join(', ');
  return `Position: ${dir} ${(Math.abs(d.weight) * 100).toFixed(0)}% (conviction ${d.conviction.toFixed(2)}; bull ${d.bullScore.toFixed(2)} vs bear ${d.bearScore.toFixed(2)}). Key evidence: ${top.map((e) => e.text).join('; ') || 'none strong enough'}. ${adj ? `Risk manager adjusted size (${adj}).` : 'Risk manager made no adjustments.'}`;
}

export async function narrate(d: TeamDecision, llm?: LLM): Promise<{ text: string; source: string }> {
  const fallback = templateNarrative(d);
  if (!llm) return { text: fallback, source: 'template' };
  try {
    const sys = 'You are a risk-aware equity analyst. Explain the decision using ONLY the evidence provided. Do not add facts, numbers or predictions that are not in the evidence. 4 sentences max. This is a simulation, not financial advice.';
    const text = await llm.complete(sys, JSON.stringify({ ticker: d.ticker, conviction: d.conviction, weight: d.weight, evidence: d.analysts.flatMap((a) => a.evidence), debate: d.debate, risk: d.risk.adjustments }));
    // guard: every number the LLM cites must come from the evidence/decision payload
    const allowed = new Set((JSON.stringify(d).match(/-?\d+\.?\d*/g) ?? []).map((x) => parseFloat(x).toFixed(0)));
    const bad = (text.match(/\d+\.?\d*/g) ?? []).filter((x) => !allowed.has(parseFloat(x).toFixed(0)));
    return bad.length > 2 ? { text: fallback, source: 'template (LLM output rejected: unsupported numbers)' } : { text, source: llm.name };
  } catch {
    return { text: fallback, source: 'template (LLM unavailable)' };
  }
}
