import type { Envelope } from '../src/domain.ts';
export type CacheEntry = { data: unknown; fetchedAt: string; expiresAt: number };
export interface GatewayStore {
  get: (key: string) => CacheEntry | undefined;
  put: (key: string, value: CacheEntry) => void;
  reserve: (now: number, chart: boolean) => boolean;
  cooldown: () => number;
  setCooldown: (until: number) => void;
}
export class Gateway {
  private pending = new Map<string, Promise<Envelope<unknown>>>();
  constructor(
    private store: GatewayStore,
    private upstream: (path: string) => Promise<Response>,
    private clock = Date.now,
  ) {}
  async get(
    key: string,
    path: string,
    ttl: number,
    normalize: (v: unknown) => unknown,
    chart = false,
  ): Promise<Envelope<unknown>> {
    const cached = this.store.get(key);
    const now = this.clock();
    if (cached && cached.expiresAt > now)
      return { data: cached.data, mode: 'cached', fetchedAt: cached.fetchedAt };
    const existing = this.pending.get(key);
    if (existing) return existing;
    const task = this.load(key, path, ttl, normalize, chart, cached);
    this.pending.set(key, task);
    try {
      return await task;
    } finally {
      this.pending.delete(key);
    }
  }
  private async load(
    key: string,
    path: string,
    ttl: number,
    normalize: (v: unknown) => unknown,
    chart: boolean,
    cached: CacheEntry | undefined,
  ): Promise<Envelope<unknown>> {
    try {
      const now = this.clock();
      if (this.store.cooldown() > now || !this.store.reserve(now, chart))
        throw new Error('Quota reserve or cooldown');
      // One attempt, counted before fetch; no automatic upstream retries.
      const response = await this.upstream(path);
      if (response.status === 429 || response.status === 503) {
        const raw = response.headers.get('Retry-After');
        const delay =
          raw && /^\d+$/.test(raw) ? Number(raw) * 1000 : raw ? Date.parse(raw) - now : 60000;
        this.store.setCooldown(now + Math.max(60000, Number.isFinite(delay) ? delay : 60000));
      }
      if (!response.ok) throw new Error('Provider unavailable');
      const data = normalize(await response.json());
      const fetchedAt = new Date(this.clock()).toISOString();
      this.store.put(key, { data, fetchedAt, expiresAt: this.clock() + ttl });
      return { data, mode: 'cached', fetchedAt };
    } catch {
      if (cached)
        return {
          data: cached.data,
          mode: 'stale',
          fetchedAt: cached.fetchedAt,
          note: 'Last cached data. Refresh paused by the provider, quota protection, or a network error.',
        };
      throw new Error('Data unavailable; no cached response exists.');
    }
  }
}
export const WINDOW = 31 * 86400000;
export function quotaAllowed(
  timestamps: number[],
  now: number,
  monthly: number,
  minute: number,
  chart: boolean,
) {
  const active = timestamps.filter((t) => t > now - WINDOW);
  return (
    active.length < (chart ? monthly : Math.floor(monthly * 0.8)) &&
    active.filter((t) => t > now - 60000).length < minute
  );
}
