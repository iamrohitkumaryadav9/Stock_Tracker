import { Rng } from '@/lab/core/util';
import { type Bar, type Filing, type MarketData, type NewsItem, DAY } from './types';

/**
 * Fully synthetic, seeded demo market. Companies are FICTIONAL. The data has realistic structure so every
 * lab feature works offline (and on Vercel without API keys):
 *   - daily OHLCV bars with volatility clustering
 *   - quarterly filings (MD&A text + financial table + risk factors) with one restatement
 *   - post-earnings drift: price reacts to the revenue surprise on the filing date and keeps drifting
 *     for ~15 days, so there is a real, testable (and leak-testable) signal in the data
 *   - news items around earnings
 * Because the world is synthetic, any "edge" found here says nothing about real markets. It exists to test
 * whether the evaluation machinery catches leakage, overfitting and cost drag.
 */
export interface Company {
  ticker: string;
  name: string;
  sector: string;
  startPrice: number;
  baseRevenue: number; // $M per quarter
  growth: number; // qoq mean
  margin: number;
  vol: number; // daily
}
export const COMPANIES: Company[] = [
  { ticker: 'NWSC', name: 'Northwind Semiconductors', sector: 'Technology', startPrice: 84, baseRevenue: 1850, growth: 0.035, margin: 0.21, vol: 0.021 },
  { ticker: 'HLGD', name: 'Helio Grid Energy', sector: 'Utilities', startPrice: 46, baseRevenue: 3120, growth: 0.012, margin: 0.11, vol: 0.011 },
  { ticker: 'MRDB', name: 'Meridian Bank Group', sector: 'Financials', startPrice: 61, baseRevenue: 2240, growth: 0.018, margin: 0.27, vol: 0.015 },
  { ticker: 'ASTH', name: 'Aster Health Systems', sector: 'Healthcare', startPrice: 133, baseRevenue: 980, growth: 0.028, margin: 0.16, vol: 0.017 },
];

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
export const START = Date.UTC(2023, 0, 2);

function isWeekday(t: number) {
  const d = new Date(t).getUTCDay();
  return d !== 0 && d !== 6;
}
export function tradingDays(startMs: number, endMs: number): number[] {
  const out: number[] = [];
  for (let t = startMs; t <= endMs; t += DAY) if (isWeekday(t)) out.push(t);
  return out;
}

interface Quarter { period: string; end: number; filedAt: number; revenue: number; netIncome: number; eps: number; surprise: number; guidance: number }

function genQuarters(c: Company, rng: Rng): Quarter[] {
  const qs: Quarter[] = [];
  let rev = c.baseRevenue;
  let expectedGrowth = c.growth;
  for (let i = 0; i < 12; i++) {
    const year = 2023 + Math.floor(i / 4), q = (i % 4) + 1;
    const end = Date.UTC(year, q * 3, 0); // last day of quarter
    const actualGrowth = c.growth + 0.02 * rng.normal();
    const surprise = actualGrowth - expectedGrowth; // vs. what the street expected
    rev *= 1 + actualGrowth;
    const margin = Math.max(0.03, c.margin + 0.01 * rng.normal());
    const ni = rev * margin;
    qs.push({ period: `${year}Q${q}`, end, filedAt: end + (28 + rng.int(0, 10)) * DAY + 21 * 3_600_000, revenue: +rev.toFixed(1), netIncome: +ni.toFixed(1), eps: +(ni / 410).toFixed(2), surprise, guidance: +(rev * (1 + c.growth)).toFixed(1) });
    expectedGrowth = 0.5 * expectedGrowth + 0.5 * actualGrowth; // street adapts
  }
  return qs;
}

function filingText(c: Company, q: Quarter, prev: Quarter | undefined, restated = false): string {
  const yoy = prev ? (((q.revenue / prev.revenue) - 1) * 100).toFixed(1) : 'n/a';
  const tone = q.surprise > 0.01 ? 'exceeded our expectations' : q.surprise < -0.01 ? 'fell short of our expectations' : 'was broadly in line with our expectations';
  return [
    `${c.name} (${c.ticker}) - Quarterly Report for the period ended ${iso(q.end)}${restated ? ' (AMENDED - RESTATED)' : ''}`,
    '',
    'Item 2. Management\'s Discussion and Analysis',
    `Revenue for ${q.period} was $${q.revenue.toLocaleString('en-US')} million${prev ? `, compared with $${prev.revenue.toLocaleString('en-US')} million in the preceding quarter, a sequential change of ${yoy}%` : ''}. Performance ${tone}.`,
    `Net income was $${q.netIncome.toLocaleString('en-US')} million, or $${q.eps.toFixed(2)} per diluted share. Net margin was ${((q.netIncome / q.revenue) * 100).toFixed(1)}%.`,
    `Outlook: management expects revenue of approximately $${q.guidance.toLocaleString('en-US')} million next quarter.`,
    restated ? 'Restatement note: previously reported revenue included a one-time contract adjustment that has been reversed. Prior figures should no longer be relied upon.' : '',
    '',
    'Financial Summary (in $ millions)',
    `Revenue | ${q.revenue}`,
    `Net income | ${q.netIncome}`,
    `Diluted EPS | ${q.eps.toFixed(2)}`,
    `Guidance next quarter revenue | ${q.guidance}`,
    '',
    'Item 1A. Risk Factors',
    c.sector === 'Technology' ? 'Our business depends on a small number of foundry partners; supply constraints could reduce shipments. Export controls may restrict sales in certain regions.' :
    c.sector === 'Utilities' ? 'Regulatory rate decisions affect our allowed return. Extreme weather events may damage infrastructure and increase restoration costs.' :
    c.sector === 'Financials' ? 'Rising credit losses and changes in interest rates could compress our net interest margin. Regulatory capital requirements may increase.' :
    'Changes in reimbursement policy and clinical trial outcomes may materially affect our results. Data-privacy incidents could lead to penalties.',
  ].filter((l) => l !== undefined).join('\n');
}

export function generateMarket(seed = 42, endMs = Date.UTC(2025, 11, 31)): MarketData {
  const bars: Record<string, Bar[]> = {};
  const filings: Filing[] = [];
  const news: NewsItem[] = [];
  const days = tradingDays(START, endMs);

  COMPANIES.forEach((c, ci) => {
    const rng = new Rng(seed * 1000 + ci * 17 + 1);
    const qs = genQuarters(c, rng);
    // drift windows after each earnings date
    const shock = new Map<number, number>();
    qs.forEach((q) => {
      const day = days.find((d) => d >= q.filedAt - 21 * 3_600_000 + DAY) ?? 0; // first trading day after filing
      const idx = days.indexOf(day);
      for (let k = 0; k < 15; k++) if (idx + k < days.length) shock.set(days[idx + k], (shock.get(days[idx + k]) ?? 0) + (k === 0 ? 3.2 : 0.35) * q.surprise);
    });
    let price = c.startPrice, vol = c.vol;
    const out: Bar[] = [];
    for (const t of days) {
      vol = Math.max(c.vol * 0.5, Math.min(c.vol * 3, 0.9 * vol + 0.1 * c.vol + 0.25 * c.vol * Math.abs(rng.normal()) * 0.4)); // vol clustering
      const r = 0.0002 + vol * rng.normal() + (shock.get(t) ?? 0);
      const o = price * (1 + 0.002 * rng.normal());
      const cl = price * Math.exp(r);
      const hi = Math.max(o, cl) * (1 + Math.abs(vol * 0.4 * rng.normal()));
      const lo = Math.min(o, cl) * (1 - Math.abs(vol * 0.4 * rng.normal()));
      out.push({ t, o: +o.toFixed(2), h: +hi.toFixed(2), l: +lo.toFixed(2), c: +cl.toFixed(2), v: Math.round(1e6 * (1 + 0.6 * Math.abs(rng.normal())) * (1 + 8 * Math.abs(shock.get(t) ?? 0))) });
      price = cl;
    }
    bars[c.ticker] = out;

    qs.forEach((q, i) => {
      const prev = qs[i - 1];
      const id = `${c.ticker}-${q.period}-10Q`;
      filings.push({ id, ticker: c.ticker, company: c.name, form: i % 4 === 3 ? '10-K' : '10-Q', period: q.period, periodEnd: q.end, filedAt: q.filedAt, text: filingText(c, q, prev), facts: { revenue: q.revenue, netIncome: q.netIncome, eps: q.eps, guidance: q.guidance }, source: 'synthetic' });
      news.push({ id: `${id}-news`, ticker: c.ticker, publishedAt: q.filedAt + 3_600_000, headline: q.surprise > 0.01 ? `${c.name} beats estimates, lifts outlook` : q.surprise < -0.01 ? `${c.name} misses on revenue, shares slide` : `${c.name} reports in-line quarter`, body: `${c.name} reported ${q.period} revenue of $${q.revenue} million. ${q.surprise > 0.01 ? 'Analysts cited strong demand and healthy margins.' : q.surprise < -0.01 ? 'Analysts flagged slowing demand and cost pressure.' : 'Analysts said results offered few surprises.'}` });
    });

    // one restatement per company: Q6 revenue corrected down 4%, filed 45 days later
    const q6 = qs[5];
    const fixed = { ...q6, revenue: +(q6.revenue * 0.96).toFixed(1), netIncome: +(q6.netIncome * 0.94).toFixed(1), eps: +(q6.netIncome * 0.94 / 410).toFixed(2) };
    filings.push({ id: `${c.ticker}-${q6.period}-10QA`, ticker: c.ticker, company: c.name, form: '10-Q/A', period: q6.period, periodEnd: q6.end, filedAt: q6.filedAt + 45 * DAY, text: filingText(c, fixed, qs[4], true), facts: { revenue: fixed.revenue, netIncome: fixed.netIncome, eps: fixed.eps, guidance: fixed.guidance }, restates: `${c.ticker}-${q6.period}-10Q`, source: 'synthetic' });
  });
  return { bars, filings, news, source: 'synthetic' };
}

let cache: MarketData | null = null;
export function demoMarket(): MarketData {
  return (cache ??= generateMarket());
}
