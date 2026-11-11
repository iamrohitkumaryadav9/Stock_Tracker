import { mean, std, normCdf, normInv, quantile, clamp } from '@/lab/core/util';

/**
 * Forecasting with calibrated uncertainty. Every model emits a mean and a sigma for the next-h log return;
 * conformal prediction turns that into intervals whose real coverage is measured, not assumed.
 * Baselines (naive, drift, EWMA, GARCH) are always evaluated alongside the heavier models, and the
 * Diebold-Mariano test says whether a model is genuinely better than naive or just lucky.
 *
 * Foundation models (Kronos / TimesFM / Chronos) need GPUs and Python, so they are not bundled. They plug
 * in through `RemoteForecaster` (see bottom): point FOUNDATION_MODEL_URL at any service returning {mean,sigma}.
 */
export interface Forecaster {
  name: string;
  fit?(returns: number[]): void;
  predict(returns: number[], h: number): { mean: number; sigma: number };
}

const lastN = (a: number[], n: number) => a.slice(Math.max(0, a.length - n));
const SIG_FLOOR = 1e-5;

export const naive: Forecaster = {
  name: 'naive (zero drift, 60d vol)',
  predict: (r, h) => ({ mean: 0, sigma: Math.max(SIG_FLOOR, std(lastN(r, 60))) * Math.sqrt(h) }),
};
export const drift: Forecaster = {
  name: 'drift (250d mean)',
  predict: (r, h) => ({ mean: mean(lastN(r, 250)) * h, sigma: Math.max(SIG_FLOOR, std(lastN(r, 250))) * Math.sqrt(h) }),
};
export const ewma = (lambda = 0.94): Forecaster => ({
  name: `EWMA vol (λ=${lambda})`,
  predict: (r, h) => {
    let v = std(r.slice(0, 30)) ** 2 || 1e-4;
    for (const x of r) v = lambda * v + (1 - lambda) * x * x;
    return { mean: 0, sigma: Math.sqrt(Math.max(v, SIG_FLOOR ** 2) * h) };
  },
});

/** GARCH(1,1) with variance targeting; (alpha, beta) by grid-search on Gaussian log-likelihood. */
export function garch(): Forecaster {
  let alpha = 0.08, beta = 0.9;
  const llh = (r: number[], a: number, b: number, v0: number) => {
    const omega = v0 * (1 - a - b);
    let v = v0, ll = 0;
    for (const x of r) {
      ll += -0.5 * (Math.log(v) + (x * x) / v);
      v = omega + a * x * x + b * v;
    }
    return ll;
  };
  return {
    name: 'GARCH(1,1)',
    fit(r) {
      const w = lastN(r, 500);
      const v0 = std(w) ** 2 || 1e-4;
      let best = -Infinity;
      for (const a of [0.03, 0.06, 0.1, 0.15]) for (const b of [0.8, 0.85, 0.9, 0.94]) {
        if (a + b >= 0.999) continue;
        const l = llh(w, a, b, v0);
        if (l > best) { best = l; alpha = a; beta = b; }
      }
    },
    predict(r, h) {
      const w = lastN(r, 500);
      const v0 = std(w) ** 2 || 1e-4;
      const omega = v0 * (1 - alpha - beta);
      let v = v0;
      for (const x of w) v = omega + alpha * x * x + beta * v;
      // h-step variance: sum of mean-reverting forecasts
      let tot = 0, vv = v;
      for (let i = 0; i < h; i++) { tot += vv; vv = omega + (alpha + beta) * vv; }
      return { mean: 0, sigma: Math.sqrt(Math.max(tot, SIG_FLOOR ** 2)) };
    },
  };
}

/** Ridge-regularised AR(p) on returns, fit by solving normal equations. */
export function arRidge(p = 5, lambda = 5e-4, window = 400): Forecaster {
  let coef: number[] = new Array(p + 1).fill(0);
  let resid = 0.01;
  const design = (r: number[]) => {
    const X: number[][] = [], y: number[] = [];
    for (let t = p; t < r.length; t++) { X.push([1, ...Array.from({ length: p }, (_, k) => r[t - 1 - k])]); y.push(r[t]); }
    return { X, y };
  };
  return {
    name: `AR(${p}) ridge`,
    fit(r) {
      const { X, y } = design(lastN(r, window));
      if (X.length < p + 10) return;
      const k = p + 1;
      const A = Array.from({ length: k }, () => new Array(k).fill(0));
      const b = new Array(k).fill(0);
      for (let i = 0; i < X.length; i++) for (let a = 0; a < k; a++) { b[a] += X[i][a] * y[i]; for (let c = 0; c < k; c++) A[a][c] += X[i][a] * X[i][c]; }
      for (let a = 1; a < k; a++) A[a][a] += lambda * X.length; // do not shrink intercept
      coef = solve(A, b);
      resid = std(X.map((row, i) => y[i] - row.reduce((s, v, j) => s + v * coef[j], 0)));
    },
    predict(r, h) {
      const x = [1, ...Array.from({ length: p }, (_, k) => r[r.length - 1 - k] ?? 0)];
      const m = x.reduce((s, v, j) => s + v * coef[j], 0);
      return { mean: clamp(m, -0.05, 0.05) * h, sigma: Math.max(SIG_FLOOR, resid) * Math.sqrt(h) };
    },
  };
}

function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let i = 0; i < n; i++) {
    let piv = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[piv][i])) piv = r;
    [M[i], M[piv]] = [M[piv], M[i]];
    if (Math.abs(M[i][i]) < 1e-14) continue;
    for (let r = i + 1; r < n; r++) {
      const f = M[r][i] / M[i][i];
      for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let c = i + 1; c < n; c++) s -= M[i][c] * x[c];
    x[i] = Math.abs(M[i][i]) < 1e-14 ? 0 : s / M[i][i];
  }
  return x;
}

export const defaultModels = (): Forecaster[] => [naive, drift, ewma(), garch(), arRidge()];

/* ------------------------- evaluation ------------------------- */
export interface ModelReport {
  model: string;
  n: number;
  mae: number;
  rmse: number;
  directionalAcc: number;
  directionalP: number; // one-sided binomial-normal p vs 50%
  meanLogScore: number; // Gaussian predictive log score (higher is better)
  coverage: number; // empirical coverage of the conformal interval
  nominal: number;
  avgWidth: number;
  pinball: number; // average pinball loss across 10/50/90% quantiles
  dmVsNaive: { stat: number; p: number } | null;
}
export interface EvalOutput {
  reports: ModelReport[];
  ensembleName: string;
  last: { t: number; actual: number; forecasts: Record<string, { mean: number; lo: number; hi: number }> }[];
  note: string;
}

function dmTest(e1: number[], e2: number[], h: number) {
  const d = e1.map((x, i) => x * x - e2[i] * e2[i]);
  const n = d.length, m = mean(d);
  let lrv = 0;
  const lags = Math.max(0, h - 1);
  for (let l = -lags; l <= lags; l++) {
    let s = 0;
    for (let i = Math.abs(l); i < n; i++) s += (d[i] - m) * (d[i - Math.abs(l)] - m);
    lrv += (1 - Math.abs(l) / (lags + 1)) * (s / n);
  }
  const stat = m / Math.sqrt(Math.max(lrv, 1e-30) / n);
  return { stat, p: 2 * (1 - normCdf(Math.abs(stat))) };
}

export function evaluateForecasters(closes: number[], opts: { models?: Forecaster[]; minTrain?: number; h?: number; refitEvery?: number; alpha?: number; calWindow?: number } = {}): EvalOutput {
  const { minTrain = 250, h = 1, refitEvery = 40, alpha = 0.1, calWindow = 120 } = opts;
  const models = opts.models ?? defaultModels();
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
  const names = [...models.map((m) => m.name), 'ensemble (inverse-MSE)'];
  const preds: Record<string, { mean: number; sigma: number }[]> = Object.fromEntries(names.map((n) => [n, []]));
  const actual: number[] = [];
  const tIdx: number[] = [];

  for (let t = minTrain; t + h <= rets.length; t++) {
    const train = rets.slice(0, t);
    if ((t - minTrain) % refitEvery === 0) models.forEach((m) => m.fit?.(train));
    const a = rets.slice(t, t + h).reduce((s, x) => s + x, 0);
    // ensemble weights use ONLY errors already realised before t (no look-ahead)
    const ready = actual.length - h; // predictions whose outcomes are known at time t
    const w = models.map((m) => {
      if (ready < 20) return 1;
      const errs = preds[m.name].slice(Math.max(0, ready - 60), ready).map((p, i) => (p.mean - actual[Math.max(0, ready - 60) + i]) ** 2);
      return 1 / Math.max(mean(errs), 1e-12);
    });
    const ws = w.reduce((s, x) => s + x, 0);
    let em = 0, es = 0;
    models.forEach((m, i) => {
      const p = m.predict(train, h);
      preds[m.name].push(p);
      em += (w[i] / ws) * p.mean;
      es += (w[i] / ws) * p.sigma;
    });
    preds[names[names.length - 1]].push({ mean: em, sigma: es });
    actual.push(a);
    tIdx.push(t);
  }

  const reports: ModelReport[] = [];
  const naiveErr = preds[models[0].name].map((p, i) => actual[i] - p.mean);
  const last: EvalOutput['last'] = [];
  const intervals: Record<string, { lo: number; hi: number }[]> = {};

  for (const name of names) {
    const P = preds[name];
    // online split-conformal on normalised residuals using only past points
    const scores: number[] = [];
    const iv: { lo: number; hi: number }[] = [];
    let covered = 0, counted = 0, width = 0, pin = 0;
    for (let i = 0; i < P.length; i++) {
      const cal = scores.slice(Math.max(0, i - h - calWindow), Math.max(0, i - h + 1)); // only outcomes known at i
      const qHat = cal.length >= 30 ? quantile(cal, Math.min(1, (1 - alpha) * (1 + 1 / cal.length))) : normInv(1 - alpha / 2);
      const lo = P[i].mean - qHat * P[i].sigma, hi = P[i].mean + qHat * P[i].sigma;
      iv.push({ lo, hi });
      if (cal.length >= 30) { counted++; if (actual[i] >= lo && actual[i] <= hi) covered++; width += hi - lo; }
      scores.push(Math.abs(actual[i] - P[i].mean) / P[i].sigma);
      for (const q of [0.1, 0.5, 0.9]) {
        const qv = P[i].mean + normInv(q) * P[i].sigma;
        const e = actual[i] - qv;
        pin += (e >= 0 ? q * e : (q - 1) * e) / 3;
      }
    }
    intervals[name] = iv;
    const errs = P.map((p, i) => actual[i] - p.mean);
    const dirs = P.map((p, i) => (Math.sign(p.mean) !== 0 && Math.sign(actual[i]) !== 0 ? (Math.sign(p.mean) === Math.sign(actual[i]) ? 1 : 0) : null)).filter((x): x is 0 | 1 => x !== null);
    const da = dirs.length ? mean(dirs) : 0.5;
    const dp = dirs.length ? 1 - normCdf((da - 0.5) / Math.sqrt(0.25 / dirs.length)) : 1;
    reports.push({
      model: name, n: P.length, mae: mean(errs.map(Math.abs)), rmse: Math.sqrt(mean(errs.map((e) => e * e))),
      directionalAcc: da, directionalP: dp,
      meanLogScore: mean(P.map((p, i) => -0.5 * Math.log(2 * Math.PI * p.sigma ** 2) - (actual[i] - p.mean) ** 2 / (2 * p.sigma ** 2))),
      coverage: counted ? covered / counted : NaN, nominal: 1 - alpha, avgWidth: counted ? width / counted : NaN, pinball: pin / P.length,
      dmVsNaive: name === models[0].name ? null : dmTest(errs, naiveErr, h),
    });
  }
  const ens = names[names.length - 1];
  for (let i = Math.max(0, tIdx.length - 60); i < tIdx.length; i++)
    last.push({ t: tIdx[i], actual: actual[i], forecasts: { [ens]: { mean: preds[ens][i].mean, lo: intervals[ens][i].lo, hi: intervals[ens][i].hi } } });
  return {
    reports, ensembleName: ens, last,
    note: 'Intervals are online split-conformal (calibrated only on outcomes known at forecast time). A model beats naive only if Diebold-Mariano p < 0.05 AND the result survives your multiple-testing budget; with 5+ models, expect one to look good by chance.',
  };
}

/** Forecast for the next h days from the latest data, with conformal-style bands from model sigma. */
export function nextForecast(closes: number[], h = 5, alpha = 0.1) {
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) rets.push(Math.log(closes[i] / closes[i - 1]));
  const models = defaultModels();
  models.forEach((m) => m.fit?.(rets));
  const z = normInv(1 - alpha / 2);
  const last = closes[closes.length - 1];
  return models.map((m) => {
    const p = m.predict(rets, h);
    return { model: m.name, mean: last * Math.exp(p.mean), lo: last * Math.exp(p.mean - z * p.sigma), hi: last * Math.exp(p.mean + z * p.sigma), sigma: p.sigma };
  });
}

/** Adapter for external foundation-model services (Kronos / TimesFM / Chronos). Contract: POST {closes, h} -> {mean, sigma}. */
export async function remoteForecast(url: string, closes: number[], h: number): Promise<{ mean: number; sigma: number }> {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ closes, h }) });
  if (!r.ok) throw new Error(`foundation model service responded ${r.status}`);
  return r.json();
}
