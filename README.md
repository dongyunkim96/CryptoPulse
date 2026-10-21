# CryptoPulse

A focused cryptocurrency dashboard built with React, TypeScript, and Vite. A graphite-and-mint interface brings together market analytics, historical charts, an editorial reading room, and a personal watchlist.

**The project has not been deployed.** It starts with explicitly labeled illustrative data and requires no account, API key, or paid service to review locally.

## Start locally

Use **Node.js 24 LTS** and npm. The current React Router and build dependencies require a newer runtime than Node 20.

```sh
npm ci
npm run dev
```

Open the Local URL printed by Vite (normally `http://127.0.0.1:5173`). The Vite development middleware serves the same validated, credential-free demo API as the Worker. A second server is not required. Vite always uses demo mode; it never reads or forwards an API key.

To exercise the production server locally:

```sh
npm run build
npm run dev:worker
```

Open `http://127.0.0.1:8787`. Wrangler emulates the Worker and SQLite Durable Object on this computer. `npm run preview` only serves the static build; use Wrangler to preview the complete application including `/api`.

## Product

| Route        | Functionality                                                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------------------------- |
| `/`          | Global metrics, asset-selectable historical chart, tracked-universe gainers/losers, major assets, editorial preview |
| `/markets`   | 20 assets, name/symbol search, six sortable columns, gainers/losers/favorites filters, batched sparklines           |
| `/news`      | Lead editorial, article grid, headline search, topic filters, locally paginated results, original resource links    |
| `/watchlist` | Browser-persistent favorites, search/sort/filter, confirmation before clearing, obsolete-ID removal, empty state    |

Coin details use a shared Radix dialog drawer on the existing route. For example, `/markets?coin=bitcoin` opens Bitcoin directly. The drawer includes chart ranges, market statistics, source timestamps, related demo reading, and a favorite toggle. Escape, focus trapping, and focus restoration are supported. The global asset search also has a Ctrl/⌘ K shortcut.

The shell includes a sticky blurred navigation bar, asset ticker, mobile navigation, watchlist count, honest data status, provider attribution, and footer. Fonts are self-hosted. Article artwork is CSS-native and requests no third-party image service. Responsive CSS provides compositions for small phones, tablets, and desktop; secondary table columns are intentionally hidden on small screens.

## Data states and credentials

| Feature                              | No credentials                                   | Configured Worker                                      |
| ------------------------------------ | ------------------------------------------------ | ------------------------------------------------------ |
| All four pages and watchlists        | Works                                            | Works                                                  |
| Market list, global metrics, history | Clearly labeled fixtures                         | Cached CoinGecko aggregate USD data                    |
| Exchange streaming                   | Not connected                                    | Not connected; redistribution rights need verification |
| News                                 | Demo editorials linking to educational resources | Remains demo; no licensed RSS integration              |

Demo values, rankings, price paths, and dates are hand-authored fixtures. **They are not a historical snapshot or investment information.** Demo prices do not tick or pretend to be live. The fallback universe is the 20 entries in `src/data/demo.ts`: BTC, ETH, USDT, BNB, SOL, USDC, XRP, DOGE, TON, ADA, AVAX, SHIB, LINK, DOT, BCH, TRX, NEAR, POL, LTC, UNI. Demo dates are fixed at October 20, 2026; the current footer year is independent.

In configured mode, the tracked universe comes from the first 20 server-ranked CoinGecko assets. No extra metadata request is needed: the batched market response already supplies name, symbol, icon, rank, supply, high/low, and source timestamp. Missing metrics remain null and display “Unavailable.” An untracked saved ID remains removable rather than crashing the app.

`demo`, `cached`, and `stale` are separate response states. The browser also reports offline/unavailable states. Fetched-at timestamps describe application retrieval, while asset timestamps describe the provider's `last_updated`. Chart range changes never splice an exchange price into an aggregate series. Prices and charts are USD throughout; no USDT exchange quote is substituted.

## Enable aggregate data

1. Obtain a **free CoinGecko Demo key**. Review its current plan and terms using the links below.
2. For local Wrangler, copy `.env.example` to `.dev.vars`, set `DATA_MODE=live`, and set `COINGECKO_DEMO_API_KEY`. `.dev.vars` is ignored by Git.
3. Run `npm run build` and `npm run dev:worker`. Vite itself continues to serve demo data.
4. For a future deployment, use the SQLite-backed `MARKET_GATEWAY` binding already declared in `wrangler.jsonc`. Set its `vars.DATA_MODE` to `live`, and store the key with `npx wrangler secret put COINGECKO_DEMO_API_KEY` on the intended Worker.

Live mode requires **all three** of the mode flag, server key, and durable binding. Missing configuration returns labeled demo responses. A configured live upstream/storage failure returns stale cached data, or HTTP 503 if no cache exists. It never uses an unlimited proxy or silently replaces failed live responses with fixtures. The browser's TanStack Query cache is only a local convenience, not the quota mechanism.

Never put credentials in a `VITE_*` variable. No credentials are checked into this repository. Do not share one CoinGecko key with unrelated applications, multiple independently bound Workers, or preview environments: the ledger protects this Worker's upstream usage, not external use of the same key.

## Shared caching and quota enforcement

All visitors reach the same named SQLite-backed Durable Object (`global-v1`). Its durable SQL tables store cache entries, reservations, and provider cooldown. There is no scheduled refresh, alarm, or background upstream polling.

| Resource                               | Application cache TTL |
| -------------------------------------- | --------------------- |
| Ranked markets + metadata + sparklines | 15 minutes            |
| Global metrics                         | 60 minutes            |
| Historical chart, 1 / 7 / 30 days      | 30 minutes            |
| Historical chart, 90 / 365 days        | 6 hours               |

The TTLs are cache policies, not promises about provider freshness. Metadata comes from the existing market batch rather than a separate endpoint. News has no upstream requests in this version.

Before each CoinGecko fetch, `transactionSync` removes expired reservations, checks the rolling counters, and atomically inserts a reservation. The default ceiling is **7,500 calls in the preceding 31 days** and **25 calls in the preceding minute**. Environment values can lower, but cannot raise, those ceilings. Ordinary market/global refreshes stop at 80% of the monthly budget (6,000), reserving the remaining 20% for charts and operational headroom. This does not guarantee every chart will remain available; exhausted budgets serve stale data or unavailable states.

The gateway deduplicates concurrent misses by resource within the single active Durable Object. Reservations and cache survive instance eviction. Failed requests are counted. There is one upstream attempt and no automatic retry. A 429/503 `Retry-After` response establishes a durable cooldown shared by all resources. Requests time out after 10 seconds; later requests can try again only after the cache, cooldown, and reservation checks.

Only `/global`, one fixed `/coins/markets` query, and `/coins/{id}/market_chart` are constructed upstream. Chart IDs must occur in the current ranked market batch. Ranges are restricted to 1, 7, 30, 90, and 365 days. Query values, methods, and response payloads are validated. Chart caches are bounded to 100 entries; the ledger holds at most the configured budget in its active window. No arbitrary URL or API path can be proxied. Browser retries/manual error-state refreshes still pass through this gateway.

## Provider decisions and free limits

Reviewed against official sources on **October 21, 2026**. Provider plans can change; recheck before enabling or publishing.

- [CoinGecko pricing](https://www.coingecko.com/en/api/pricing): Demo lists 10,000 monthly calls and 100 calls/minute. Our 7,500/31-day and 25/minute ceilings are deliberately lower. [API terms](https://www.coingecko.com/en/api_terms) license integration subject to the selected plan and require visible attribution. The configured UI displays **Powered by CoinGecko** with a provider link. This is an application integration, not a general-purpose data resale/proxy service.
- [Demo markets endpoint](https://docs.coingecko.com/demo/reference/coins-markets) supports the market-cap-ordered batched list and sparklines. [Demo historical charts](https://docs.coingecko.com/demo/reference/coins-id-market-chart) support up to 365 days; automatic granularity is used, with no enterprise-only interval flags.
- [Cloudflare Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/): Workers Free supports SQLite objects. The documentation lists 100,000 requests/day, 13,000 GB-s/day, 5 million rows read/day, 100,000 rows written/day, and 5 GB total SQL storage. Operations fail when free limits are exceeded. [Storage limits](https://developers.cloudflare.com/durable-objects/platform/limits/) also apply, including the Free per-object limit. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) are separate. Stay on **Workers Free**, and do not enable paid overages or upgrade for this portfolio. This repository does not create an account or select a billing plan.
- [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts) is Apache 2.0. The v5 `addSeries(AreaSeries, …)` API is used. Its attribution logo remains enabled, with a TradingView link and the upstream copyright notice in the footer and `NOTICE`.
- [Kraken public ticker](https://docs.kraken.com/exchange/api-reference/spot-websocket-v2/ticker) exists, but public access alone does not establish permission to redistribute prices in this product. No socket is opened and no exchange-live badge is shown. [Kraken's terms](https://www.kraken.com/legal) need a display-rights review before this integration is added. Therefore WebSocket reconnection/cleanup is **not implemented or claimed tested** here.
- [CoinDesk terms](https://www.coindesk.com/terms) do not provide a suitable general republishing grant for this use. No publisher feed or images are copied. News remains a functional, clearly labeled editorial demo. A future feed needs explicit display permission, server fetching, conditional requests, bounded caching, canonical-URL deduplication, item validation, text sanitization, and image reuse permission. No scraper or paid summarizer is included.

## Deployment instructions — not executed

The selected target is **Cloudflare Workers Free with static assets and a SQLite-backed Durable Object**, keeping Vite as the frontend build tool.

```sh
npm ci
npm run build
npx wrangler login
# Optional, only when enabling aggregate data:
npx wrangler secret put COINGECKO_DEMO_API_KEY
# Review wrangler.jsonc and DATA_MODE, then intentionally publish:
npm run deploy
```

Complete account login yourself and confirm that the account is on the free plan. `wrangler.jsonc` includes the SQLite migration, assets binding, SPA fallback, and API-first routing. The four routes load directly through the SPA fallback; `/api/*` reaches the Worker first. A static-only host needs an equivalent API deployment and SPA rewrites; uploading `dist/` alone does not provide the server API.

No deployment, account provisioning, paid resource, or paid overage has been activated during implementation.

## Structure

```text
src/
  components/     Shared shell, dialogs, chart, data table, editorial artwork
  pages/          Exactly four main page components
  data/           Typed illustrative fixtures
  lib/            Validated HTTP queries and formatting
  state/          Versioned, defensive watchlist persistence
  domain.ts       Zod schemas and meaningful domain types
server/
  worker.ts       Routing, SQLite transactions, bounded provider access
  gateway.ts      Cache reuse, deduplication, retries/cooldown policy
  normalize.ts    CoinGecko normalization and safe URLs
tests/            Gateway, SQL ledger, normalization, watchlist, application flows
scripts/          Local HTTP smoke checks
```

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
# With the relevant local server running:
npm run test:http -- http://127.0.0.1:8787
npm run test:http -- http://127.0.0.1:5173
```

Actual checks run during implementation:

- TypeScript strict checks: passed.
- ESLint including React hook rules: passed.
- 28 tests: passed. They cover cache reuse/deduplication, quota concurrency, rolling windows/reserve, Retry-After, stale fallback, provider normalization, unsafe URLs, malformed storage, watchlist persistence/interactions, direct routes, global search, drawer Escape/focus restoration, range controls, mobile navigation, clear confirmation, and news filtering/links.
- SQLite integration tests instantiate the production gateway against an in-memory Node SQLite adapter, recreate it on the same database, and verify persisted reservations/cache/cooldown. These validate the SQL and application logic; they do not claim production Cloudflare integration coverage.
- Production frontend build: passed. The chart library is loaded as a separate chunk; the Inter Latin font is self-hosted.
- Local Worker emulator: started successfully with the declared SQLite binding.
- HTTP smoke tests: 13 passed on Vite and 13 passed on Wrangler, covering all four direct routes, API data modes, allowed history, invalid ranges/assets/proxy parameters, and method restrictions.
- Browser visual inspection: **blocked**. The browser first timed out, then rejected preview access under its URL security policy. No screenshot or visual pass is claimed at 375, 768, 1280, or 1536 pixels. Component tests use a mocked chart renderer and do not verify canvas pixels or responsive overflow.
- Real CoinGecko account calls, deployed Durable Objects, exchange streaming, and licensed live news: **not tested/activated**. No credentials were supplied.

Before a public launch, finish real-browser review at the four target widths, test the configured CoinGecko key on the free plan, verify deployed storage behavior, and recheck current terms. The delivered local application and documented demo mode work without those integrations.
