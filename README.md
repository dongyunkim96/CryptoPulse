# CryptoPulse

A cryptocurrency market dashboard for exploring market trends, researching individual assets, and following your favorite coins. Built with React and TypeScript, CryptoPulse brings together historical price charts, market statistics, asset search, and a personal watchlist.

### [Open the Live Demo →](https://cryptopulse-snowy.vercel.app/)

[Overview](https://cryptopulse-snowy.vercel.app/) · [Markets](https://cryptopulse-snowy.vercel.app/markets) · [News](https://cryptopulse-snowy.vercel.app/news) · [Watchlist](https://cryptopulse-snowy.vercel.app/watchlist)

The application is deployed on **Vercel**. Configured deployments use cached CoinGecko aggregate market data in USD. Local development runs with clearly labeled demo data and requires no API key.

## Features

| Page                                                        | Features                                                                                                                                     |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [Overview](https://cryptopulse-snowy.vercel.app/)           | Global market capitalization, 24-hour volume, Bitcoin dominance, historical price charts, and gainers and losers within the tracked universe |
| [Markets](https://cryptopulse-snowy.vercel.app/markets)     | Approximately 20 major assets, name and symbol search, sortable statistics, and gainers, losers, and favorites filters                       |
| [News](https://cryptopulse-snowy.vercel.app/news)           | Demo editorials linking to educational resources, headline search, topic filters, and load-more pagination                                   |
| [Watchlist](https://cryptopulse-snowy.vercel.app/watchlist) | Add and remove favorites, browser persistence, search and sorting, and confirmation before clearing saved assets                             |

- Open any coin in a shared details drawer to explore its price, market statistics, historical chart, and related reading.
- Share a selected asset through a URL, such as [Bitcoin details](https://cryptopulse-snowy.vercel.app/markets?coin=bitcoin).
- Switch between 1-day, 7-day, 30-day, 90-day, and 1-year chart ranges.
- Open global asset search with `Ctrl + K` or `⌘ + K`.
- Use responsive layouts, mobile navigation, keyboard interactions, drawer focus management, and reduced-motion support.
- Save favorites in the current browser's localStorage without creating an account.

## Technology Stack

| Category                    | Technologies                                             |
| --------------------------- | -------------------------------------------------------- |
| Frontend                    | React, TypeScript, Vite                                  |
| Styling and interaction     | Tailwind CSS, Motion, Lucide React, self-hosted Inter    |
| Routing                     | React Router                                             |
| Server state / client state | TanStack Query / Zustand                                 |
| Charts / dialogs            | TradingView Lightweight Charts / Radix UI Dialog         |
| Data validation             | Zod                                                      |
| Current deployment          | Vercel Functions + Upstash Redis                         |
| Alternative backend         | Cloudflare Workers + SQLite Durable Objects              |
| Testing                     | Vitest, Testing Library, Node SQLite, a test-only Lua VM |

## Getting Started

Use **Node.js 24 LTS** and npm.

```sh
npm ci
npm run dev
```

Open the Local URL printed in your terminal, usually [http://localhost:5173](http://localhost:5173).

The Vite development server includes a demo API, so all four pages work without a separate server or API key. Demo prices, rankings, and chart paths are illustrative fixtures rather than historical market snapshots.

## Vercel Deployment and Market Data

Vercel builds and deploys commits pushed to the connected GitHub repository. Use the `Vite` framework preset, `npm run build` as the build command, and `dist` as the output directory. Server API entry points live in the root `api/` directory.

Add the following server environment variables under **Settings → Environment Variables** in your Vercel project.

| Variable                   | Value                                           |
| -------------------------- | ----------------------------------------------- |
| `DATA_MODE`                | `live`                                          |
| `COINGECKO_DEMO_API_KEY`   | Your CoinGecko Demo API key                     |
| `UPSTASH_REDIS_REST_URL`   | Your Upstash Redis HTTPS REST URL               |
| `UPSTASH_REDIS_REST_TOKEN` | A REST token with write access to that database |
| `CG_MONTHLY_BUDGET`        | Optional; defaults to `7500`                    |
| `CG_MINUTE_BUDGET`         | Optional; defaults to `25`                      |

Save the variables for the `Production` environment, then **Redeploy** to apply them to a new deployment. Keep API keys and tokens in server environment variables or ignored local files. Variables prefixed with `VITE_` are public and must never contain secrets. Keep credential values blank in `.env.example`.

If the API key or shared storage configuration is missing, the server returns labeled demo data. If a configured provider request fails, the application serves existing cache entries as stale data, or an unavailable state when no cache exists. Every provider request remains subject to the shared quota checks.

**Detailed setup and redeployment instructions:** [Vercel deployment guide](DEPLOY_VERCEL.md)

## Shared Caching and Request Budgets

Vercel instances share cached responses and request reservations through Upstash Redis. Atomic Lua operations reserve quota before each upstream request, while distributed locks deduplicate concurrent refreshes for the same resource.

| Resource                              | Application cache TTL |
| ------------------------------------- | --------------------- |
| Market list, metadata, and sparklines | 15 minutes            |
| Global market metrics                 | 60 minutes            |
| 1-day, 7-day, and 30-day charts       | 30 minutes            |
| 90-day and 1-year charts              | 6 hours               |

- CoinGecko requests are capped at **7,500 per rolling 31 days** and **25 per rolling minute**. Environment variables can lower these limits.
- Regular market and global refreshes stop at 80% of the monthly budget, preserving the remainder for charts and operational headroom.
- Failed requests count toward the budget. The gateway makes one upstream attempt without automatic retries.
- Provider `Retry-After` responses are respected. Only supported API paths, tracked assets, and chart ranges are accepted.
- Shared cache storage is bounded to 102 resources. No scheduled background requests consume provider credits while the site is idle.

Cache TTLs describe application refresh policies and may differ from the provider's data timestamps. The interface distinguishes source timestamps from application fetch times. Check each provider's current plan for its separate free-tier limits.

## Data Coverage and Status

| Status                | Meaning                                                                         |
| --------------------- | ------------------------------------------------------------------------------- |
| Demo data             | Illustrative fixtures included with the project                                 |
| Cached data           | CoinGecko aggregate USD data stored in the shared cache                         |
| Stale data            | An earlier cached response retained after a refresh failure or quota protection |
| Unavailable / Offline | Data could not be retrieved, or the browser is offline                          |

Gainer and loser rankings cover **the approximately 20 tracked assets**, rather than the entire cryptocurrency market. Exchange WebSocket streaming is not connected. News remains a **demo editorial collection** linking to educational resources. Configuring a CoinGecko key enables aggregate market data, not live news or exchange streaming.

## Project Structure

```text
api/                     Vercel Functions entry points
server/
  vercel.ts              Vercel request handling
  redis-gateway.ts       Shared Redis cache, distributed locks, and quota enforcement
  routes.ts              Shared route validation and demo responses
  normalize.ts           Provider response normalization
  worker.ts              Alternative Cloudflare Workers backend
  gateway.ts             Cloudflare cache and request handling
src/
  components/            Navigation, tables, charts, and dialogs
  pages/                 Overview, Markets, News, and Watchlist
  data/                  Demo fixtures
  lib/                   HTTP queries and formatting utilities
  state/                 Watchlist state and persistence
  domain.ts              Shared types and Zod schemas
tests/                   Data, quota, persistence, and user-flow tests
scripts/                 HTTP and compiled-server verification
```

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

The latest local verification passed **40 tests, TypeScript checks, linting, and the full production build**. The build also compiles the server to JavaScript and loads all four API entry points in native Node to verify their JSON responses.

Tests cover concurrent quota reservations, request deduplication, cache reuse, stale fallback, provider normalization, malformed localStorage recovery, watchlist interactions, search and filtering, dialogs, and news links. SQLite and Lua tests use local adapters and do not establish remote storage integration coverage. Component tests mock the chart renderer; canvas pixels and responsive visual behavior require separate browser review. Test-tool dependency limitations are documented in the [deployment guide](DEPLOY_VERCEL.md).

## Alternative Cloudflare Backend

To review the Cloudflare backend locally, copy `.env.example` to `.dev.vars`, configure the required server values, and run:

```sh
npm run build
npm run dev:worker
```

Open [http://localhost:8787](http://localhost:8787). This backend uses a SQLite-backed Durable Object instead of Redis. The `npm run deploy` script deploys to **Cloudflare**, not Vercel. Avoid sharing one CoinGecko key across independent backends with separate quota ledgers.

## Data Providers and Licenses

- Market data: [CoinGecko API](https://www.coingecko.com/en/api) · [API terms](https://www.coingecko.com/en/api_terms) · [Pricing](https://www.coingecko.com/en/api/pricing). Configured market-data views display **Powered by CoinGecko**.
- Charts: [TradingView Lightweight Charts](https://github.com/tradingview/lightweight-charts), Apache 2.0. The chart attribution logo and TradingView link are retained; the copyright notice is included in [NOTICE](NOTICE).
- Font: [Inter](https://github.com/rsms/inter), SIL Open Font License 1.1.
- Hosting and storage: [Vercel](https://vercel.com/) · [Upstash Redis](https://upstash.com/pricing/redis) · [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/).

**Market information only. Not investment advice.**
