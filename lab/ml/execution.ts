import { Simulation, DEFAULT_SIM } from '@/lab/exchange/simulator';
import { Rng, mean, std, normCdf } from '@/lab/core/util';

/**
 * Optimal execution: sell Q shares within T steps against the simulated order book, minimising
 * implementation shortfall versus the arrival mid-price. Compares a tabular Q-learning agent with TWAP,
 * "dump now", and random baselines on held-out simulator seeds, with a paired significance test.
 * Per the research record, RL agents in simulators often just re-discover TWAP; this harness reports when that happens.
 */
export interface ExecConfig { Q: number; T: number; warmup: number }
export const DEFAULT_EXEC: ExecConfig = { Q: 240, T: 40, warmup: 80 };
const MULTS = [0, 0.5, 1, 2]; // child order size = mult * Q/T

type Policy = (state: number, t: number, rng: Rng) => number;

function bucket(x: number, edges: number[]) { let i = 0; while (i < edges.length && x > edges[i]) i++; return i; }

interface Env { sim: Simulation; arrival: number; remaining: number; t: number; cost: number; filled: number }
function reset(seed: number, cfg: ExecConfig): Env {
  const sim = new Simulation({ ...DEFAULT_SIM, seed, nNoise: 8 });
  sim.run(cfg.warmup);
  return { sim, arrival: sim.book.mid() ?? sim.cfg.startPrice, remaining: cfg.Q, t: 0, cost: 0, filled: 0 };
}
function stateOf(e: Env, cfg: ExecConfig): number {
  const s = e.sim.snapshots[e.sim.snapshots.length - 1];
  const tb = Math.min(3, Math.floor((e.t / cfg.T) * 4));
  const ib = Math.min(3, Math.floor((e.remaining / cfg.Q) * 4 - 1e-9) + (e.remaining > 0 ? 0 : 0));
  const sb = bucket(s.spread, [2, 4]);
  const imb = (s.bidQty[0] - s.askQty[0]) / Math.max(1, s.bidQty[0] + s.askQty[0]);
  const mb = bucket(imb, [-0.25, 0.25]);
  return ((tb * 4 + Math.max(0, ib)) * 3 + sb) * 3 + mb;
}
const N_STATES = 4 * 4 * 3 * 3;

function sell(e: Env, qty: number) {
  if (qty <= 0) return;
  const r = e.sim.exec({ op: 'submit', ts: e.sim.t + 0.5, order: { id: `x${e.sim.commands.length}`, trader: 'strategy', side: 'sell', type: 'market', qty } });
  for (const f of r.fills) { e.cost += (e.arrival - f.price) * f.qty; e.filled += f.qty; e.remaining -= f.qty; }
}

/** Runs one episode; returns shortfall in ticks per share (lower is better) and the (s,a,r,s') transitions. */
function episode(seed: number, cfg: ExecConfig, pick: Policy, rng: Rng) {
  const e = reset(seed, cfg);
  const trans: { s: number; a: number; r: number; s2: number; done: boolean }[] = [];
  for (let t = 0; t < cfg.T; t++) {
    e.t = t;
    const s = stateOf(e, cfg);
    const a = pick(s, t, rng);
    const before = e.cost, rem0 = e.remaining;
    sell(e, Math.min(e.remaining, Math.round(MULTS[a] * (cfg.Q / cfg.T))));
    if (t === cfg.T - 1) { sell(e, e.remaining); e.cost += e.remaining * 25; e.remaining = 0; } // unfilled penalty at the horizon
    e.sim.step();
    const shaped = -(e.cost - before) / cfg.Q + 0 * rem0; // reward = negative incremental cost per share
    trans.push({ s, a, r: shaped, s2: stateOf({ ...e, t: t + 1 }, cfg), done: t === cfg.T - 1 });
  }
  return { shortfall: e.cost / Math.max(1, cfg.Q), trans };
}

const twap: Policy = () => 2;
const dump: Policy = (_s, t) => (t === 0 ? 3 : 0);
const random: Policy = (_s, _t, rng) => rng.int(0, 3);

export interface ExecStudy {
  config: ExecConfig;
  episodesTrained: number;
  results: { name: string; meanShortfall: number; std: number; n: number }[];
  vsTwap: { meanDiff: number; t: number; p: number; verdict: string };
  learningCurve: number[];
  policySummary: { timeBucket: string; share: Record<string, number> }[];
}

export function executionStudy(opts: { trainEpisodes?: number; testEpisodes?: number; cfg?: ExecConfig; seed?: number } = {}): ExecStudy {
  const { trainEpisodes = 2500, testEpisodes = 100, cfg = DEFAULT_EXEC, seed = 1 } = opts;
  const rng = new Rng(seed);
  const Qt: number[][] = Array.from({ length: N_STATES }, () => new Array(MULTS.length).fill(0));
  const visits: number[][] = Array.from({ length: N_STATES }, () => new Array(MULTS.length).fill(0));
  const curve: number[] = [];
  const alpha = 0.15, gamma = 0.98;
  for (let ep = 0; ep < trainEpisodes; ep++) {
    const eps = Math.max(0.05, 1 - ep / (trainEpisodes * 0.7));
    const { shortfall, trans } = episode(10_000 + ep, cfg, (s, _t, r) => (r.next() < eps ? r.int(0, 3) : Qt[s].indexOf(Math.max(...Qt[s]))), rng);
    for (const tr of trans) {
      const target = tr.r + (tr.done ? 0 : gamma * Math.max(...Qt[tr.s2]));
      Qt[tr.s][tr.a] += alpha * (target - Qt[tr.s][tr.a]);
      visits[tr.s][tr.a]++;
    }
    if (ep % 10 === 9) curve.push(shortfall);
  }
  const greedy: Policy = (s) => Qt[s].indexOf(Math.max(...Qt[s]));
  const run = (name: string, p: Policy) => {
    const r = new Rng(77);
    const v = Array.from({ length: testEpisodes }, (_, i) => episode(900_000 + i, cfg, p, r).shortfall); // held-out seeds
    return { name, v };
  };
  const R = [run('TWAP (equal slices)', twap), run('dump at t=0', dump), run('random', random), run('Q-learning agent', greedy)];
  const d = R[3].v.map((x, i) => x - R[0].v[i]);
  const t = mean(d) / ((std(d) / Math.sqrt(d.length)) || 1e-9);
  const p = 2 * (1 - normCdf(Math.abs(t)));
  // what does the learned policy actually do per time bucket?
  const share: Record<number, number[]> = { 0: [0, 0, 0, 0], 1: [0, 0, 0, 0], 2: [0, 0, 0, 0], 3: [0, 0, 0, 0] };
  for (let s = 0; s < N_STATES; s++) { const tb = Math.floor(s / 36); const tot = visits[s].reduce((a, b) => a + b, 0); if (tot) share[tb][Qt[s].indexOf(Math.max(...Qt[s]))] += tot; }
  return {
    config: cfg, episodesTrained: trainEpisodes,
    results: R.map((r) => ({ name: r.name, meanShortfall: mean(r.v), std: std(r.v), n: r.v.length })),
    vsTwap: { meanDiff: mean(d), t, p, verdict: p >= 0.05 ? 'No statistically significant difference from TWAP on held-out seeds: the agent has not shown an edge over the simple baseline.' : mean(d) < 0 ? 'The agent has significantly lower shortfall than TWAP on held-out seeds (in this simulator only).' : 'The agent is significantly WORSE than TWAP.' },
    learningCurve: curve,
    policySummary: [0, 1, 2, 3].map((tb) => { const tot = share[tb].reduce((a, b) => a + b, 0) || 1; return { timeBucket: ['first quarter', 'second quarter', 'third quarter', 'last quarter'][tb], share: Object.fromEntries(MULTS.map((m, i) => [`${m}x`, +(share[tb][i] / tot).toFixed(2)])) }; }),
  };
}

/** Avellaneda-Stoikov-style inventory skew versus a symmetric quoter, over many seeds (market-making study). */
export function marketMakingStudy(opts: { seeds?: number; steps?: number; skews?: number[] } = {}) {
  const { seeds = 12, steps = 1200, skews = [0, 0.02, 0.06, 0.15] } = opts;
  return skews.map((skew) => {
    const pnl: number[] = [], inv: number[] = [];
    for (let s = 0; s < seeds; s++) {
      const sim = new Simulation({ ...DEFAULT_SIM, seed: 500 + s, mmInventorySkew: skew, nNoise: 10 }).run(steps);
      const mark = sim.book.mid() ?? sim.cfg.startPrice;
      pnl.push(sim.mmPnl('sim:mm1', mark));
      inv.push(Math.abs(sim.mmInventory('sim:mm1')));
    }
    return { skew, label: skew === 0 ? 'symmetric quotes' : `inventory skew ${skew}`, meanPnl: mean(pnl), pnlStd: std(pnl), meanAbsInventory: mean(inv), sharpeLike: std(pnl) ? mean(pnl) / std(pnl) : 0 };
  });
}
