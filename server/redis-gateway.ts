import { z } from 'zod';
import type { Envelope } from '../src/domain.js';
import type { CacheEntry } from './gateway.js';

// All decisions run on the Redis primary in one atomic Lua script. A module
// variable is never used as the shared cache, quota counter, or distributed lock.
export const RESERVE_SCRIPT = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000.0 + math.floor(tonumber(time[2]) / 1000)
local cached = redis.call('HGET', KEYS[1], ARGV[1])
if cached and tonumber(cjson.decode(cached).expiresAt) > now then
  return {'cached', cached}
end
if tonumber(redis.call('GET', KEYS[3]) or '0') > now then
  return {'blocked', cached or ''}
end
if redis.call('EXISTS', KEYS[4]) == 1 then
  return {'busy', cached or ''}
end
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now - 2678400000)
local budget = tonumber(ARGV[3])
if ARGV[5] ~= 'chart' then budget = math.floor(budget * 0.8) end
if redis.call('ZCARD', KEYS[2]) >= budget or
   redis.call('ZCOUNT', KEYS[2], '(' .. (now - 60000), '+inf') >= tonumber(ARGV[4]) then
  return {'blocked', cached or ''}
end
redis.call('ZADD', KEYS[2], now, ARGV[2])
redis.call('EXPIRE', KEYS[2], 2764800)
redis.call('SET', KEYS[4], ARGV[2], 'PX', 30000)
return {'fetch', cached or ''}
`;

// Fencing prevents a timed-out owner from deleting another owner's lock or
// overwriting newer data. Cache cardinality is bounded even if the top 20 change.
export const COMMIT_SCRIPT = `
if redis.call('GET', KEYS[3]) ~= ARGV[2] then return 0 end
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000.0 + math.floor(tonumber(time[2]) / 1000)
local entry = cjson.decode(ARGV[3])
entry.expiresAt = now + tonumber(ARGV[4])
redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(entry))
redis.call('ZADD', KEYS[2], now, ARGV[1])
local count = redis.call('ZCARD', KEYS[2])
if count > 102 then
  local old = redis.call('ZRANGE', KEYS[2], 0, count - 103)
  for _, key in ipairs(old) do
    redis.call('HDEL', KEYS[1], key)
    redis.call('ZREM', KEYS[2], key)
  end
end
redis.call('DEL', KEYS[3])
return 1
`;

export const RELEASE_SCRIPT = `
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('DEL', KEYS[1])
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000.0 + math.floor(tonumber(time[2]) / 1000)
local untilTime = math.max(now + tonumber(ARGV[2]), tonumber(redis.call('GET', KEYS[2]) or '0'))
redis.call('SET', KEYS[2], untilTime, 'PX', math.max(1, untilTime - now))
return 1
`;

export interface RedisCommands {
  command: (args: (string | number)[]) => Promise<unknown>;
}

export function createRedisCommands(url: string, token: string): RedisCommands {
  const endpoint = new URL(url);
  if (
    endpoint.protocol !== 'https:' ||
    !endpoint.hostname.endsWith('.upstash.io') ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== '/'
  )
    throw new Error('Invalid Upstash REST endpoint');
  return {
    async command(args) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error('Shared data storage unavailable');
      const body = z
        .object({ result: z.unknown().optional(), error: z.string().optional() })
        .parse(await response.json());
      if (body.error || !('result' in body)) throw new Error('Shared data storage unavailable');
      return body.result;
    },
  };
}

const cacheEntry = z.object({
  data: z.unknown(),
  fetchedAt: z.string().datetime(),
  expiresAt: z.number(),
});
const PREFIX = 'cryptopulse:v1:';
export class RedisGateway {
  constructor(
    private redis: RedisCommands,
    private upstream: (path: string) => Promise<Response>,
    private monthly = 7500,
    private minute = 25,
  ) {}

  private eval(script: string, keys: string[], args: (string | number)[]) {
    return this.redis.command(['EVAL', script, keys.length, ...keys, ...args]);
  }

  async get(
    key: string,
    path: string,
    ttl: number,
    normalize: (input: unknown) => unknown,
    chart = false,
  ): Promise<Envelope<unknown>> {
    const token = crypto.randomUUID();
    const lock = `${PREFIX}lock:${key}`;
    const cache = `${PREFIX}cache`;
    const cooldown = `${PREFIX}cooldown`;
    const decision = z
      .tuple([z.enum(['cached', 'blocked', 'busy', 'fetch']), z.string()])
      .parse(
        await this.eval(
          RESERVE_SCRIPT,
          [cache, `${PREFIX}ledger`, cooldown, lock],
          [key, token, this.monthly, this.minute, chart ? 'chart' : 'regular'],
        ),
      );
    let cached: CacheEntry | undefined = decision[1]
      ? cacheEntry.parse(JSON.parse(decision[1]))
      : undefined;
    if (decision[0] === 'cached')
      return { data: cached!.data, mode: 'cached', fetchedAt: cached!.fetchedAt };
    if (decision[0] === 'busy' && !cached) {
      // Bounded storage-only waiting; never retries the upstream provider.
      for (let attempt = 0; attempt < 6; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        const raw = await this.redis.command(['HGET', cache, key]);
        if (typeof raw === 'string') {
          cached = cacheEntry.parse(JSON.parse(raw));
          if (cached.expiresAt > Date.now())
            return { data: cached.data, mode: 'cached', fetchedAt: cached.fetchedAt };
        }
      }
    }
    const stale = (): Envelope<unknown> => {
      if (!cached) throw new Error('No cached market data available');
      return {
        data: cached.data,
        mode: 'stale',
        fetchedAt: cached.fetchedAt,
        note: 'Last shared cache. Provider refresh is paused or another refresh is in progress.',
      };
    };
    if (decision[0] !== 'fetch') return stale();
    let retryAfter = 60000;
    try {
      const response = await this.upstream(path);
      const raw = response.headers.get('Retry-After');
      if (raw) {
        const parsed = /^\d+$/.test(raw) ? Number(raw) * 1000 : Date.parse(raw) - Date.now();
        if (Number.isFinite(parsed)) retryAfter = Math.max(60000, parsed);
      }
      if (!response.ok) throw new Error('Provider unavailable');
      const data = normalize(await response.json());
      const fetchedAt = new Date().toISOString();
      const committed = await this.eval(
        COMMIT_SCRIPT,
        [cache, `${PREFIX}cache-index`, lock],
        [key, token, JSON.stringify({ data, fetchedAt, expiresAt: 0 }), ttl],
      );
      if (committed !== 1) throw new Error('Refresh lease expired');
      return { data, mode: 'cached', fetchedAt };
    } catch {
      // Best-effort release; an expired lock is safe. Storage failure must never
      // trigger an unmetered provider request or replace actual data with fixtures.
      try {
        await this.eval(RELEASE_SCRIPT, [lock, cooldown], [token, retryAfter]);
      } catch {
        /* lease expires automatically */
      }
      return stale();
    }
  }
}
