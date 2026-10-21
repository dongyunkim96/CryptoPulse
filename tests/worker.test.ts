// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, { MarketGateway } from '../server/worker';
import { demoCoins } from '../src/data/demo';
const databases: DatabaseSync[] = [];
function state() {
  const db = new DatabaseSync(':memory:');
  databases.push(db);
  const sql = {
    exec: (query: string, ...params: (string | number)[]) => {
      const statement = db.prepare(query);
      const rows = statement.columns().length
        ? statement.all(...params)
        : (statement.run(...params), []);
      return {
        toArray: () => rows,
        one: () => {
          if (rows.length !== 1) throw Error('Expected one row');
          return rows[0];
        },
      };
    },
  };
  const ctx = {
    storage: {
      sql,
      transactionSync: <T>(fn: () => T): T => {
        db.exec('BEGIN');
        try {
          const result = fn();
          db.exec('COMMIT');
          return result;
        } catch (e) {
          db.exec('ROLLBACK');
          throw e;
        }
      },
    },
  } as unknown as DurableObjectState;
  return { ctx, db };
}
const rawMarkets = demoCoins.map((c) => ({
  id: c.id,
  name: c.name,
  symbol: c.symbol,
  market_cap_rank: c.rank,
  current_price: c.price,
  market_cap: c.marketCap,
  total_volume: c.volume,
  price_change_percentage_24h: c.change,
}));
const request = (path: string) => new Request(`https://cryptopulse.example${path}`);
afterEach(() => {
  vi.unstubAllGlobals();
  for (const db of databases.splice(0)) db.close();
});
describe('Production API and SQLite ledger', () => {
  it('fails closed to labeled demo data without complete live credentials/storage', async () => {
    const response = await worker.fetch(request('/api/markets'), {
      ASSETS: {} as Fetcher,
      DATA_MODE: 'live',
      COINGECKO_DEMO_API_KEY: 'test',
    });
    expect(response.status).toBe(200);
    expect(((await response.json()) as { mode: string }).mode).toBe('demo');
  });
  it('rejects unsupported ranges, proxy targets, assets, and methods', async () => {
    const env = { ASSETS: {} as Fetcher };
    for (const path of [
      '/api/chart?coin=bitcoin&days=2',
      '/api/markets?url=https://example.com',
      '/api/chart?coin=unknown&days=7',
      '/api/anything',
    ])
      expect((await worker.fetch(request(path), env)).status).toBe(400);
    expect(
      (await worker.fetch(new Request('https://example.com/api/markets', { method: 'POST' }), env))
        .status,
    ).toBe(405);
  });
  it('atomically caps actual SQLite reservations under concurrent chart requests, persists across instances', async () => {
    const { ctx, db } = state();
    const env = {
      ASSETS: {} as Fetcher,
      COINGECKO_DEMO_API_KEY: 'server-secret',
      CG_MONTHLY_BUDGET: '5',
    };
    const fetcher = vi.fn(async (input: string, options: RequestInit) => {
      expect(new Headers(options.headers).get('x-cg-demo-api-key')).toBe('server-secret');
      return Response.json(
        input.includes('/coins/markets')
          ? rawMarkets
          : {
              prices: [
                [1000, 42],
                [2000, 43],
              ],
            },
      );
    });
    vi.stubGlobal('fetch', fetcher);
    const first = new MarketGateway(ctx, env);
    await first.fetch(request('/api/markets'));
    const paths = ['bitcoin', 'ethereum'].flatMap((id) =>
      [1, 7, 30, 90, 365].map((days) => `/api/chart?coin=${id}&days=${days}`),
    );
    const responses = await Promise.all(paths.map((path) => first.fetch(request(path))));
    expect(responses.filter((r) => r.status === 200)).toHaveLength(4);
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(db.prepare('SELECT COUNT(*) AS n FROM reservations').get()?.n).toBe(5);
    const second = new MarketGateway(ctx, env);
    expect((await second.fetch(request('/api/chart?coin=solana&days=7'))).status).toBe(503);
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect((await second.fetch(request('/api/markets'))).status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
  it('preserves cached data after a provider failure across object recreation', async () => {
    const { ctx, db } = state();
    const env = { ASSETS: {} as Fetcher, COINGECKO_DEMO_API_KEY: 'test' };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(rawMarkets)),
    );
    await new MarketGateway(ctx, env).fetch(request('/api/markets'));
    const row = db.prepare("SELECT body FROM cache WHERE key='markets'").get() as { body: string };
    const body = JSON.parse(row.body);
    body.expiresAt = 0;
    db.prepare("UPDATE cache SET body=? WHERE key='markets'").run(JSON.stringify(body));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('', { status: 503, headers: { 'Retry-After': '3600' } })),
    );
    const response = await new MarketGateway(ctx, env).fetch(request('/api/markets'));
    expect(((await response.json()) as { mode: string }).mode).toBe('stale');
    expect(
      db.prepare("SELECT value FROM control WHERE key='cooldown'").get()?.value,
    ).toBeGreaterThan(Date.now());
  });
});
