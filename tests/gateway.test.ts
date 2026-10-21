import { describe, expect, it, vi } from 'vitest';
import { Gateway, quotaAllowed, WINDOW } from '../server/gateway';
import type { CacheEntry, GatewayStore } from '../server/gateway';
function fixture(limit = 7500) {
  let now = 100000000000;
  let cooldown = 0;
  const calls: number[] = [];
  const cache = new Map<string, CacheEntry>();
  const store: GatewayStore = {
    get: (k) => cache.get(k),
    put: (k, v) => {
      cache.set(k, v);
    },
    reserve: (time, chart) => {
      if (!quotaAllowed(calls, time, limit, 25, chart)) return false;
      calls.push(time);
      return true;
    },
    cooldown: () => cooldown,
    setCooldown: (until) => {
      cooldown = until;
    },
  };
  return {
    store,
    calls,
    cache,
    now: () => now,
    advance: (n: number) => {
      now += n;
    },
  };
}
describe('Shared gateway protections', () => {
  it('deduplicates simultaneous misses and reuses the cache', async () => {
    const f = fixture();
    const upstream = vi.fn(async () => new Response('{"value":42}'));
    const g = new Gateway(f.store, upstream, f.now);
    const results = await Promise.all(
      Array.from({ length: 30 }, () => g.get('markets', '/allowed', 900000, (v) => v)),
    );
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(f.calls).toHaveLength(1);
    expect(results.every((r) => r.mode === 'cached')).toBe(true);
    await g.get('markets', '/allowed', 900000, (v) => v);
    expect(upstream).toHaveBeenCalledTimes(1);
  });
  it('reserves before fetching and enforces concurrent reservations', async () => {
    const f = fixture(5);
    const upstream = vi.fn(async () => new Response('{}'));
    const g = new Gateway(f.store, upstream, f.now);
    const results = await Promise.allSettled(
      Array.from({ length: 15 }, (_, i) => g.get(`chart:${i}`, '/allowed', 1000, (v) => v, true)),
    );
    expect(f.calls).toHaveLength(5);
    expect(upstream).toHaveBeenCalledTimes(5);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(10);
  });
  it('reserves 20% for charts and manual headroom', () => {
    expect(quotaAllowed(Array(6000).fill(100), 200, 7500, 10000, false)).toBe(false);
    expect(quotaAllowed(Array(6000).fill(100), 200, 7500, 10000, true)).toBe(true);
  });
  it('enforces the rolling minute and 31-day window', () => {
    expect(quotaAllowed(Array(25).fill(100000), 100001, 7500, 25, true)).toBe(false);
    expect(quotaAllowed(Array(7500).fill(1), WINDOW + 2, 7500, 25, true)).toBe(true);
  });
  it('serves stale cache on failure without substituting fixtures', async () => {
    const f = fixture();
    f.cache.set('markets', {
      data: { real: true },
      fetchedAt: new Date(f.now() - 10000).toISOString(),
      expiresAt: 0,
    });
    const upstream = vi.fn(async () => {
      throw Error('network');
    });
    const g = new Gateway(f.store, upstream, f.now);
    const result = await g.get('markets', '/allowed', 1000, (v) => v);
    expect(result.mode).toBe('stale');
    expect(result.data).toEqual({ real: true });
    expect(f.calls).toHaveLength(1);
  });
  it('honors Retry-After across different resource keys and counts the failed call', async () => {
    const f = fixture();
    const upstream = vi.fn(
      async () => new Response('', { status: 429, headers: { 'Retry-After': '120' } }),
    );
    const g = new Gateway(f.store, upstream, f.now);
    await expect(g.get('one', '/one', 1000, (v) => v)).rejects.toThrow();
    await expect(g.get('two', '/two', 1000, (v) => v)).rejects.toThrow();
    expect(upstream).toHaveBeenCalledTimes(1);
    expect(f.calls).toHaveLength(1);
    f.advance(120001);
    await expect(g.get('two', '/two', 1000, (v) => v)).rejects.toThrow();
    expect(upstream).toHaveBeenCalledTimes(2);
  });
  it('serves stale data when the budget is exhausted', async () => {
    const f = fixture(1);
    f.calls.push(f.now());
    f.cache.set('markets', { data: [], fetchedAt: new Date(f.now()).toISOString(), expiresAt: 0 });
    const upstream = vi.fn();
    const g = new Gateway(f.store, upstream, f.now);
    expect((await g.get('markets', '/x', 1000, (v) => v)).mode).toBe('stale');
    expect(upstream).not.toHaveBeenCalled();
  });
});
