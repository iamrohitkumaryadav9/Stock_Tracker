import { PitStore } from './store';
import { barKnownAt, type Bar, type Filing, type MarketData, type NewsItem } from '@/lab/data/types';

export interface PitUniverse {
  bars: PitStore<Bar>;
  filings: PitStore<Filing>;
  news: PitStore<NewsItem>;
}

/** Load market data into bitemporal stores with the correct knownAt for every fact. */
export function buildPit(md: MarketData): PitUniverse {
  const bars = new PitStore<Bar>();
  const filings = new PitStore<Filing>();
  const news = new PitStore<NewsItem>();
  for (const [sym, arr] of Object.entries(md.bars)) for (const b of arr) bars.put({ key: sym, validAt: b.t, knownAt: barKnownAt(b.t), value: b });
  // Filings: validAt = fiscal period end, knownAt = filing time. A restatement shares validAt with its original (a new revision).
  for (const f of md.filings) filings.put({ key: `${f.ticker}`, validAt: f.periodEnd, knownAt: f.filedAt, value: f });
  for (const n of md.news) news.put({ key: n.ticker, validAt: n.publishedAt, knownAt: n.publishedAt, value: n });
  return { bars, filings, news };
}
