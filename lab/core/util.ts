import { createHash } from 'node:crypto';

/** Deterministic PRNG (mulberry32). Every simulation in the lab is seeded so results are reproducible. */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }
  normal(): number {
    const u = Math.max(this.next(), 1e-12);
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  bool(p = 0.5): boolean {
    return this.next() < p;
  }
}

export const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');

/** Stable JSON stringify (sorted keys) so hashes do not depend on key order. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  const o = v as Record<string, unknown>;
  // undefined and null are both treated as "absent": stores differ in how they round-trip them
  return '{' + Object.keys(o).sort().filter((k) => o[k] !== undefined && o[k] !== null).map((k) => JSON.stringify(k) + ':' + stableStringify(o[k])).join(',') + '}';
}

export const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export const variance = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1);
};
export const std = (a: number[]) => Math.sqrt(variance(a));
export const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

export function skewness(a: number[]): number {
  const m = mean(a), s = std(a);
  if (s === 0 || a.length < 3) return 0;
  return mean(a.map((x) => ((x - m) / s) ** 3));
}
export function kurtosis(a: number[]): number {
  const m = mean(a), s = std(a);
  if (s === 0 || a.length < 4) return 3;
  return mean(a.map((x) => ((x - m) / s) ** 4));
}
export function autocorr(a: number[], lag = 1): number {
  if (a.length <= lag + 1) return 0;
  const m = mean(a);
  let num = 0, den = 0;
  for (let i = 0; i < a.length; i++) {
    den += (a[i] - m) ** 2;
    if (i >= lag) num += (a[i] - m) * (a[i - lag] - m);
  }
  return den === 0 ? 0 : num / den;
}
export function quantile(a: number[], q: number): number {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}
export function median(a: number[]) {
  return quantile(a, 0.5);
}

/** Standard normal CDF (Abramowitz-Stegun 7.1.26 via erf). */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x) / Math.SQRT2);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(x * x) / 2);
  return 0.5 * (1 + (x >= 0 ? y : -y));
}
/** Inverse normal CDF (Acklam's rational approximation). */
export function normInv(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let q: number, r: number;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  q = p - 0.5;
  r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const round = (x: number, d = 4) => (Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : x);
