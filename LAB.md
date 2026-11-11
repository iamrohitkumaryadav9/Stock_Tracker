# Quantis Lab

A point-in-time research and trading-simulation platform that **tries to break its own ideas**: it tests AI trading
agents and models for look-ahead, memorisation, overfitting, cost drag and miscalibrated judges, and reports the
failures. Everything runs offline on a seeded synthetic universe (fictional companies), so every result is reproducible.

Open it at `/lab` after signing in.

## Modules

| # | Module | Where | What it does |
|---|---|---|---|
| 1 | Point-in-time data layer | `lab/pit`, `lab/data` | Bitemporal store (`validAt` / `knownAt`), restatements as new revisions, `PitView` that **throws** on look-ahead. Synthetic demo market; optional Yahoo/EDGAR loaders in `lab/ingest/live.ts`. |
| 2 | Exchange core | `lab/exchange` | Limit order book (price-time priority; limit/market/IOC/FOK; cancel/replace; self-trade prevention), event-sourced deterministic replay with state hash, agent-based simulator, stylised-fact realism checks. |
| 3 | Money core | `lab/money` | Immutable double-entry ledger (idempotency keys, reversals, hash chain), pre-trade risk engine with reason codes, reconciliation (reports breaks, never auto-corrects), trade surveillance. |
| 4 | AI layer | `lab/ai`, `lab/ml` | Cited, restatement-aware RAG with abstention + eval harness; agent team (analysts, bull/bear debate, FinMem-style layered memory, deterministic risk veto); forecasting with conformal intervals; LOB direction models; RL execution vs TWAP; market-making skew; journal bias mining. |
| 5 | Evaluation engine | `lab/eval` | Leak detector (temporal non-interference), entity neutering, costed backtester (next-open execution, spread, sqrt impact, borrow), walk-forward, Deflated Sharpe, Probability of Backtest Overfitting (CSCV), bootstrap CIs, hash-chained forward-test decision log. |

## Results the lab currently reports (all on synthetic data)

These are measured by the code in this repo, including the unflattering ones:

- **Order book**: matches a naive reference implementation over 30 random sessions; replay reproduces the exact state hash.
- **Leak detector**: honest strategies and the agent team pass; a deliberately leaky strategy scores Sharpe > 3 in a naive backtest and is flagged.
- **Strategy search**: best of 23 configurations has net Sharpe ~1.2 but **Deflated Sharpe 0.20** and the verdict is `FAIL`: not distinguishable from luck after accounting for the search.
- **Filings RAG**: wording A (template, in-distribution) 100%; wording B (dev paraphrases, tuned against) ~82%; wording C (**held-out** paraphrases) ~60%, ~5% wrong answers. Abstains correctly on 100% of unanswerable questions. A lenient LLM-style judge inflates a naive baseline's accuracy by ~30 points.
- **Forecasting**: conformal intervals reach ~89-91% coverage at a 90% target; no model significantly beats naive for daily direction, as expected.
- **LOB model**: macro-F1 ~0.40 vs 0.28 baseline, but not significantly profitable after paying the spread.
- **RL execution**: with enough training the agent converges to roughly TWAP; no significant edge (p ~ 0.3).

## Honest limitations

- All data is synthetic. A planted post-earnings drift exists, so "edges" are possible by construction, and say nothing about real markets.
- Wording A/B RAG scores are upper bounds (the parser was developed on them). Only wording C is a fair generalisation check.
- Kronos / TimesFM / Chronos are **not bundled** (they need GPUs). `remoteForecast()` in `lab/ai/forecast.ts` is an HTTP adapter for a service you run.
- The EDGAR loader is written but was not verified live (SEC blocks requests without a real contact User-Agent; set `SEC_USER_AGENT`).
- The LOB/RL models are small from-scratch implementations, not DeepLOB-scale networks.
- Educational software. Not financial advice.

## Running

```bash
npm install
npm run dev          # http://localhost:3000, requires MongoDB (MONGODB_URI)
npm test             # 55 tests (matching engine, ledger, PIT, eval, RAG, agents, ML, API, MongoDB integration)
```

Lab state (your sandbox venue, ledger, decision log, agent memory) is stored in MongoDB. If MongoDB is unreachable the
lab falls back to in-process memory and says so in the UI.

## Deploying to Vercel

The Lab is plain Next.js + Node (no native modules, no Python), so it deploys as-is.

1. Use **MongoDB Atlas** (the app's auth also needs it). Allow Vercel's IPs (or `0.0.0.0/0`) under Network Access.
2. Set environment variables in Vercel: `MONGODB_URI`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (your deployed URL), `NEXT_PUBLIC_BASE_URL`; optional `GEMINI_API_KEY`, `FINNHUB_API_KEY`, `NEXT_PUBLIC_FINNHUB_API_KEY`, `SEC_USER_AGENT`. See `.env.example`.
3. Atlas must be reachable **at build time**: `lib/better-auth/auth.ts` connects on import.
4. Heavy studies (`/api/lab/micro?kind=exec`, `/evaluate`) take several seconds and set `maxDuration = 60`. Results are cached per server instance; on the Hobby plan keep an eye on function time limits.

Streamlit is not applicable: this is a Next.js app. Hosting it on Streamlit would mean rewriting it in Python.

## Layout

```
lab/
  core/       seeded RNG, stats helpers
  pit/        bitemporal store + look-ahead guard
  data/       types + synthetic market generator
  exchange/   order book, simulator, stylised facts
  money/      ledger, risk, reconciliation, venue, surveillance
  ai/         rag, rag-eval, agents, memory, forecast, journal-bias
  ml/         lob (direction models), execution (RL, market making)
  eval/       backtest, strategies, validate (leak/WF/DSR/PBO), decisionlog, stats
  server/     Mongo/in-memory stores, universe cache, auth helper
  __tests__/  vitest suites
app/api/lab/[action]/route.ts    JSON API
components/Lab/                  UI (one panel per module)
```
