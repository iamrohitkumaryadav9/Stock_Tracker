export interface Bar {
  t: number; // epoch ms (00:00 UTC of the trading day)
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}
export interface Filing {
  id: string;
  ticker: string;
  company: string;
  form: '10-K' | '10-Q' | '8-K' | '10-K/A' | '10-Q/A';
  period: string; // e.g. 2024Q2
  periodEnd: number; // validAt
  filedAt: number; // knownAt
  text: string;
  facts: Record<string, number>;
  restates?: string; // id of the filing this one corrects
  source: 'synthetic' | 'edgar';
  url?: string;
}
export interface NewsItem {
  id: string;
  ticker: string;
  publishedAt: number;
  headline: string;
  body: string;
}
export interface MarketData {
  bars: Record<string, Bar[]>;
  filings: Filing[];
  news: NewsItem[];
  source: 'synthetic' | 'yahoo' | 'mixed';
}

export const DAY = 86_400_000;
/** A daily bar becomes public at the close (21:00 UTC covers US markets in all seasons). */
export const barKnownAt = (t: number) => t + 21 * 3_600_000;
