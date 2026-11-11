import { demoMarket } from '@/lab/data/synthetic';
import { buildPit, type PitUniverse } from '@/lab/pit/load';
import { RagIndex } from '@/lab/ai/rag';
import type { MarketData } from '@/lab/data/types';
import { Simulation, DEFAULT_SIM } from '@/lab/exchange/simulator';
import { Venue, type VenueCommand } from '@/lab/money/venue';
import { Ledger } from '@/lab/money/ledger';
import { appendVenueCommand, ledgerStore, loadVenueCommands, killSwitchSet } from './store';

declare global {
  // eslint-disable-next-line no-var
  var __labU: { md: MarketData; pit: PitUniverse; rag: Promise<RagIndex>; cache: Map<string, { at: number; v: unknown }> } | undefined;
}
export function universe() {
  if (!globalThis.__labU) {
    const md = demoMarket();
    globalThis.__labU = { md, pit: buildPit(md), rag: RagIndex.build(md.filings), cache: new Map() };
  }
  return globalThis.__labU;
}
/** Memoise expensive studies for a few minutes (they are deterministic, so this is only a latency optimisation). */
export async function cached<T>(key: string, ttlMs: number, f: () => Promise<T> | T): Promise<T> {
  const c = universe().cache;
  const hit = c.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.v as T;
  const v = await f();
  c.set(key, { at: Date.now(), v });
  return v;
}

export const VENUE_SEED = 20260 as const;
export const SYMBOL = 'QNT';

/**
 * Rebuild the user's venue: deterministic simulated market seed (not stored: it is a pure function of the seed)
 * followed by the user's persisted commands. Order IDs are derived from idempotency keys, so a retried request
 * is recognised on replay.
 */
export async function openVenue(userId: string): Promise<{ venue: Venue; ledger: Ledger; sessionId: string; nSaved: number }> {
  const sessionId = `venue:${userId}`;
  const sim = new Simulation({ ...DEFAULT_SIM, seed: VENUE_SEED }).run(160);
  const seedCmds: VenueCommand[] = sim.commands.map((cmd) => ({ cmd, user: cmd.op === 'submit' ? cmd.order.trader : (cmd as { trader: string }).trader }));
  const saved = await loadVenueCommands(sessionId);
  const ledger = new Ledger(await ledgerStore(sessionId));
  const venue = new Venue(SYMBOL, ledger);
  await venue.hydrate([...seedCmds, ...saved]);
  venue.killSwitch = killSwitchSet.has(sessionId);
  for (const v of saved) if (v.user) venue.users.add(v.user);
  return { venue, ledger, sessionId, nSaved: saved.length };
}
export async function persistLast(sessionId: string, venue: Venue, nSaved: number) {
  const vc = venue.commands[venue.commands.length - 1];
  await appendVenueCommand(sessionId, nSaved, vc);
}
