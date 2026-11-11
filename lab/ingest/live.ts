import type { Bar, Filing } from '@/lab/data/types';

/**
 * Live ingestion (optional). The lab runs fully offline on the synthetic universe; these loaders let you
 * point the same pipeline at real data. SEC requires a descriptive User-Agent with contact info:
 * set SEC_USER_AGENT="YourApp your-contact@example.com" in the environment.
 */
export async function fetchYahooBars(symbol: string, years = 3): Promise<Bar[]> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = await import('yahoo-finance2');
  const YF = (mod as any).default;
  const yf = typeof YF === 'function' ? new YF({ suppressNotices: ['yahooSurvey'] }) : YF;
  const period1 = new Date(Date.now() - years * 365 * 86_400_000);
  const rows = await yf.chart(symbol, { period1, interval: '1d' });
  const quotes: any[] = rows.quotes ?? [];
  return quotes
    .filter((q) => q.close != null && q.open != null)
    .map((q) => {
      const d = new Date(q.date);
      return { t: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()), o: q.open, h: q.high, l: q.low, c: q.close, v: q.volume ?? 0 };
    });
}

const UA = () => process.env.SEC_USER_AGENT || 'QuantisLab research (set SEC_USER_AGENT)';

async function secJson(url: string) {
  const r = await fetch(url, { headers: { 'User-Agent': UA(), Accept: 'application/json' } });
  if (!r.ok) throw new Error(`SEC ${r.status} for ${url}`);
  return r.json();
}

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|tr|h\d|li|table)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#\d+;|&[a-z]+;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

/** Recent 10-K / 10-Q / 8-K filings for a ticker, with acceptance time as knownAt. Text is truncated for demo storage. */
export async function fetchEdgarFilings(ticker: string, max = 6, maxChars = 60_000): Promise<Filing[]> {
  const map = await secJson('https://www.sec.gov/files/company_tickers.json');
  const hit = Object.values<any>(map).find((x) => x.ticker.toUpperCase() === ticker.toUpperCase());
  if (!hit) throw new Error(`Ticker ${ticker} not found at SEC`);
  const cik = String(hit.cik_str).padStart(10, '0');
  const sub = await secJson(`https://data.sec.gov/submissions/CIK${cik}.json`);
  const r = sub.filings.recent;
  const out: Filing[] = [];
  for (let i = 0; i < r.form.length && out.length < max; i++) {
    const form = r.form[i];
    if (!['10-K', '10-Q', '10-K/A', '10-Q/A'].includes(form)) continue;
    const acc = String(r.accessionNumber[i]);
    const url = `https://www.sec.gov/Archives/edgar/data/${hit.cik_str}/${acc.replace(/-/g, '')}/${r.primaryDocument[i]}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA() } });
    if (!res.ok) continue;
    const text = htmlToText(await res.text()).slice(0, maxChars);
    const accepted = r.acceptanceDateTime?.[i] ? Date.parse(r.acceptanceDateTime[i]) : Date.parse(r.filingDate[i] + 'T21:00:00Z');
    out.push({
      id: `${ticker}-${acc}`, ticker: ticker.toUpperCase(), company: sub.name, form, period: r.reportDate[i] || r.filingDate[i],
      periodEnd: Date.parse((r.reportDate[i] || r.filingDate[i]) + 'T00:00:00Z'), filedAt: accepted, text, facts: {}, source: 'edgar', url,
    });
    await new Promise((res2) => setTimeout(res2, 150)); // be polite to SEC rate limits
  }
  return out;
}
