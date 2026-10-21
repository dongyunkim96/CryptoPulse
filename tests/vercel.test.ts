// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET as marketsGET } from '../api/markets';
import { GET as globalGET } from '../api/global';
import { GET as chartGET } from '../api/chart';
import { GET as newsGET } from '../api/news';
import { handleVercelRequest } from '../server/vercel';
import type { Envelope } from '../src/domain';
import {
  COMMIT_SCRIPT,
  createRedisCommands,
  RedisGateway,
  RESERVE_SCRIPT,
} from '../server/redis-gateway';
import { luaRedis } from './lua-redis';
const request = (path: string) => new Request(`https://cryptopulse.example/api/${path}`);
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe('Vercel API routes', () => {
  it('serves all four endpoints as JSON without credentials', async () => {
    vi.stubEnv('DATA_MODE', 'demo');
    for (const [handler, path] of [
      [marketsGET, 'markets'],
      [globalGET, 'global'],
      [chartGET, 'chart?coin=bitcoin&days=7'],
      [newsGET, 'news'],
    ] as const) {
      const response = await handler(request(path));
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('application/json');
      expect(((await response.json()) as Envelope<unknown>).mode).toBe('demo');
    }
  });
  it('does not use an unlimited provider proxy when only an API key is configured', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    const response = await handleVercelRequest(request('markets'), {
      DATA_MODE: 'live',
      COINGECKO_DEMO_API_KEY: 'test-key',
    });
    expect(((await response.json()) as Envelope<unknown>).mode).toBe('demo');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects unsupported input before contacting Redis or CoinGecko', async () => {
    for (const path of [
      'chart?coin=bitcoin&days=2',
      'chart?coin=bitcoin&coin=ethereum&days=7',
      'markets?url=https://example.com',
    ])
      expect((await handleVercelRequest(request(path), {})).status).toBe(400);
    expect(
      (
        await handleVercelRequest(
          new Request('https://example.com/api/markets', { method: 'POST' }),
          {},
        )
      ).status,
    ).toBe(405);
  });
  it('sends the key only in the provider header and uses the durable gateway', async () => {
    const redis = luaRedis();
    const fetcher = vi.fn(async (url: URL | string, options: RequestInit) => {
      if (String(url).includes('upstash.io'))
        return Response.json({ result: await redis.command(JSON.parse(String(options.body))) });
      expect(String(url)).toBe('https://api.coingecko.com/api/v3/global');
      expect(new Headers(options.headers).get('x-cg-demo-api-key')).toBe('test-key');
      return Response.json({ data: { total_market_cap: { usd: 123 }, updated_at: 1700000000 } });
    });
    vi.stubGlobal('fetch', fetcher);
    const response = await handleVercelRequest(request('global'), {
      DATA_MODE: 'live',
      COINGECKO_DEMO_API_KEY: 'test-key',
      UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'test-redis-token',
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as Envelope<{ marketCap: number }>;
    expect(body.mode).toBe('cached');
    expect(body.data.marketCap).toBe(123);
    expect(JSON.stringify(body)).not.toContain('test-key');
  });
  it('fails closed on invalid storage credentials/endpoints', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(
      (
        await handleVercelRequest(request('markets'), {
          DATA_MODE: 'live',
          COINGECKO_DEMO_API_KEY: 'key',
          UPSTASH_REDIS_REST_URL: 'http://localhost',
          UPSTASH_REDIS_REST_TOKEN: 'token',
        })
      ).status,
    ).toBe(503);
    expect(() => createRedisCommands('https://example.com', 'token')).toThrow();
    vi.restoreAllMocks();
  });
});
describe('Redis gateway: production Lua executed in a local Lua VM', () => {
  it('deduplicates simultaneous cold misses across gateway instances', async () => {
    const redis = luaRedis();
    const upstream = vi.fn(async () => Response.json({ value: 42 }));
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        new RedisGateway(redis, upstream).get('markets', '/markets', 900000, (v) => v),
      ),
    );
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r.mode === 'cached')).toBe(true);
  });
  it('enforces concurrent rolling reservations and reserves chart headroom', async () => {
    const redis = luaRedis();
    const keys = ['cache', 'ledger', 'cooldown'];
    const reserve = (key: string, token: string, chart = false) =>
      redis.command([
        'EVAL',
        RESERVE_SCRIPT,
        4,
        ...keys,
        `lock:${key}`,
        key,
        token,
        5,
        25,
        chart ? 'chart' : 'regular',
      ]);
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => reserve(`coin:${i}`, `token:${i}`)),
    );
    expect(results.filter((r) => (r as string[])[0] === 'fetch')).toHaveLength(4);
    expect(((await reserve('chart', 'chart-token', true)) as string[])[0]).toBe('fetch');
    expect(((await reserve('another', 'more', true)) as string[])[0]).toBe('blocked');
    redis.advance(31 * 86400000 + 1);
    expect(((await reserve('after-window', 'new', true)) as string[])[0]).toBe('fetch');
  });
  it('enforces the sliding per-minute ceiling using Redis time', async () => {
    const redis = luaRedis();
    const reserve = (i: number) =>
      redis.command([
        'EVAL',
        RESERVE_SCRIPT,
        4,
        'cache',
        'ledger',
        'cooldown',
        `lock:${i}`,
        `${i}`,
        `${i}`,
        7500,
        2,
        'chart',
      ]);
    expect(((await reserve(1)) as string[])[0]).toBe('fetch');
    expect(((await reserve(2)) as string[])[0]).toBe('fetch');
    expect(((await reserve(3)) as string[])[0]).toBe('blocked');
    redis.advance(60001);
    expect(((await reserve(4)) as string[])[0]).toBe('fetch');
  });
  it('preserves stale data and shares Retry-After cooldown across instances', async () => {
    const redis = luaRedis();
    const upstream = vi.fn(async () => Response.json({ value: 42 }));
    await new RedisGateway(redis, upstream).get('markets', '/markets', 1000, (v) => v);
    redis.advance(1001);
    const failing = vi.fn(
      async () => new Response('', { status: 429, headers: { 'Retry-After': '120' } }),
    );
    expect(
      (await new RedisGateway(redis, failing).get('markets', '/markets', 1000, (v) => v)).mode,
    ).toBe('stale');
    await expect(
      new RedisGateway(redis, failing).get('global', '/global', 1000, (v) => v),
    ).rejects.toThrow();
    expect(failing).toHaveBeenCalledTimes(1);
    redis.advance(120001);
    await expect(
      new RedisGateway(redis, failing).get('global', '/global', 1000, (v) => v),
    ).rejects.toThrow();
    expect(failing).toHaveBeenCalledTimes(2);
  });
  it('rejects expired lock owners and bounds cache entries to 102', async () => {
    const redis = luaRedis();
    const reserve = (i: number) =>
      redis.command([
        'EVAL',
        RESERVE_SCRIPT,
        4,
        'cache',
        'ledger',
        'cooldown',
        `lock:${i}`,
        String(i),
        `token:${i}`,
        7500,
        25,
        'chart',
      ]);
    const commit = (i: number, token = `token:${i}`) =>
      redis.command([
        'EVAL',
        COMMIT_SCRIPT,
        3,
        'cache',
        'cache-index',
        `lock:${i}`,
        String(i),
        token,
        JSON.stringify({ data: { price: i }, fetchedAt: new Date().toISOString(), expiresAt: 0 }),
        1000,
      ]);
    await reserve(0);
    redis.advance(30001);
    expect(await commit(0)).toBe(0);
    for (let i = 1; i <= 105; i++) {
      await reserve(i);
      expect(await commit(i)).toBe(1);
      redis.advance(60001);
    }
    expect(await redis.command(['ZCARD', 'cache-index'])).toBe(102);
    expect(await redis.command(['HGET', 'cache', '1'])).toBeNull();
  });
});
