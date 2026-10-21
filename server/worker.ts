import type { Coin } from '../src/domain.js';
import { Gateway, WINDOW } from './gateway.js';
import type { CacheEntry, GatewayStore } from './gateway.js';
import { normalizeChart, normalizeGlobal, normalizeMarkets } from './normalize.js';
import { demoResponse, json, parseRoute } from './routes.js';
interface Env {
  ASSETS: Fetcher;
  MARKET_GATEWAY?: DurableObjectNamespace;
  COINGECKO_DEMO_API_KEY?: string;
  DATA_MODE?: string;
  CG_MONTHLY_BUDGET?: string;
  CG_MINUTE_BUDGET?: string;
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
    const route = parseRoute(url);
    if (!route) return json({ error: 'Unsupported resource' }, 400);
    if (route.kind === 'news') return demoResponse(route);
    if (env.DATA_MODE !== 'live' || !env.COINGECKO_DEMO_API_KEY || !env.MARKET_GATEWAY) {
      return demoResponse(route);
    }
    try {
      return await env.MARKET_GATEWAY.get(env.MARKET_GATEWAY.idFromName('global-v1')).fetch(
        request,
      );
    } catch {
      return json({ error: 'Shared market storage is unavailable.' }, 503);
    }
  },
} satisfies ExportedHandler<Env>;

export class MarketGateway implements DurableObject {
  private gateway: Gateway;
  constructor(ctx: DurableObjectState, env: Env) {
    const sql = ctx.storage.sql;
    sql.exec('CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, body TEXT NOT NULL)');
    sql.exec(
      'CREATE TABLE IF NOT EXISTS reservations (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL)',
    );
    sql.exec('CREATE INDEX IF NOT EXISTS reservations_at ON reservations(at)');
    sql.exec('CREATE TABLE IF NOT EXISTS control (key TEXT PRIMARY KEY, value INTEGER NOT NULL)');
    const cap = (v: string | undefined, max: number) =>
      Math.min(max, Math.max(1, Math.floor(Number(v) || max)));
    const monthly = cap(env.CG_MONTHLY_BUDGET, 7500),
      minute = cap(env.CG_MINUTE_BUDGET, 25);
    const store: GatewayStore = {
      get: (key) => {
        const row = sql
          .exec<{ body: string }>('SELECT body FROM cache WHERE key = ?', key)
          .toArray()[0];
        return row ? (JSON.parse(row.body) as CacheEntry) : undefined;
      },
      put: (key, value) => {
        ctx.storage.transactionSync(() => {
          sql.exec('INSERT OR REPLACE INTO cache VALUES (?,?)', key, JSON.stringify(value));
          sql.exec(
            'DELETE FROM cache WHERE key IN (SELECT key FROM cache WHERE key LIKE ? ORDER BY rowid DESC LIMIT -1 OFFSET 100)',
            'chart:%',
          );
        });
      },
      reserve: (now, chart) =>
        ctx.storage.transactionSync(() => {
          sql.exec('DELETE FROM reservations WHERE at <= ?', now - WINDOW);
          const count = sql
            .exec<{ total: number; recent: number }>(
              'SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN at > ? THEN 1 ELSE 0 END),0) AS recent FROM reservations',
              now - 60000,
            )
            .one();
          if (
            count.total >= (chart ? monthly : Math.floor(monthly * 0.8)) ||
            count.recent >= minute
          )
            return false;
          sql.exec('INSERT INTO reservations (at) VALUES (?)', now);
          return true;
        }),
      cooldown: () =>
        sql
          .exec<{ value: number }>('SELECT value FROM control WHERE key = ?', 'cooldown')
          .toArray()[0]?.value ?? 0,
      setCooldown: (until) => {
        sql.exec('INSERT OR REPLACE INTO control VALUES (?,?)', 'cooldown', until);
      },
    };
    this.gateway = new Gateway(store, (path) =>
      fetch(`https://api.coingecko.com/api/v3${path}`, {
        headers: { 'x-cg-demo-api-key': env.COINGECKO_DEMO_API_KEY! },
        signal: AbortSignal.timeout(10000),
      }),
    );
  }
  async fetch(request: Request): Promise<Response> {
    const route = parseRoute(new URL(request.url));
    if (!route) return json({ error: 'Unsupported resource' }, 400);
    try {
      if (route.kind === 'global')
        return json(await this.gateway.get('global', '/global', 3600000, normalizeGlobal));
      const markets = () =>
        this.gateway.get(
          'markets',
          '/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=true',
          900000,
          normalizeMarkets,
        );
      if (route.kind === 'markets') return json(await markets());
      // The current server-ranked universe is the only accepted chart allowlist.
      const universe = (await markets()).data as Coin[];
      if (!universe.some((c) => c.id === route.coin))
        return json({ error: 'Asset is outside the tracked universe' }, 400);
      return json(
        await this.gateway.get(
          `chart:${route.coin}:${route.days}`,
          `/coins/${route.coin}/market_chart?vs_currency=usd&days=${route.days}`,
          route.days >= 90 ? 21600000 : 1800000,
          normalizeChart,
          true,
        ),
      );
    } catch {
      return json({ error: 'Market data unavailable; no cache exists.' }, 503);
    }
  }
}
