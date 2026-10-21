import { z } from 'zod';
import type { Coin } from '../src/domain.js';
const value = z.number().finite().nullable().optional();
const rawCoin = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,100}$/),
  name: z.string(),
  symbol: z.string(),
  image: z.string().optional(),
  market_cap_rank: value,
  current_price: value,
  price_change_percentage_24h: value,
  market_cap: value,
  total_volume: value,
  high_24h: value,
  low_24h: value,
  circulating_supply: value,
  last_updated: z.string().datetime().nullable().optional(),
  sparkline_in_7d: z.object({ price: z.array(z.number().finite()) }).optional(),
});
export function normalizeMarkets(data: unknown): Coin[] {
  return z
    .array(rawCoin)
    .max(100)
    .parse(data)
    .map((c) => ({
      id: c.id,
      name: c.name,
      symbol: c.symbol.toUpperCase(),
      image: safeUrl(c.image),
      rank: c.market_cap_rank ?? null,
      price: c.current_price ?? null,
      change: c.price_change_percentage_24h ?? null,
      marketCap: c.market_cap ?? null,
      volume: c.total_volume ?? null,
      high: c.high_24h ?? null,
      low: c.low_24h ?? null,
      supply: c.circulating_supply ?? null,
      updatedAt: c.last_updated ?? null,
      sparkline: c.sparkline_in_7d?.price ?? [],
    }))
    .filter((c) => c.rank !== null)
    .sort((a, b) => a.rank! - b.rank!)
    .slice(0, 20);
}
export function safeUrl(input: string | undefined) {
  try {
    const u = new URL(input ?? '');
    return u.protocol === 'https:' && !u.username && !u.password ? u.href : null;
  } catch {
    return null;
  }
}
export function normalizeGlobal(input: unknown) {
  const c = z
    .object({
      data: z.object({
        total_market_cap: z.record(z.string(), z.number()).optional(),
        total_volume: z.record(z.string(), z.number()).optional(),
        market_cap_percentage: z.record(z.string(), z.number()).optional(),
        market_cap_change_percentage_24h_usd: value,
        updated_at: value,
      }),
    })
    .parse(input).data;
  return {
    marketCap: c.total_market_cap?.usd ?? null,
    volume: c.total_volume?.usd ?? null,
    dominance: c.market_cap_percentage?.btc ?? null,
    change: c.market_cap_change_percentage_24h_usd ?? null,
    updatedAt: c.updated_at ? new Date(c.updated_at * 1000).toISOString() : null,
  };
}
export function normalizeChart(input: unknown) {
  const { prices } = z
    .object({
      prices: z.array(z.tuple([z.number().finite(), z.number().finite().nonnegative()])).max(20000),
    })
    .parse(input);
  return [...new Map(prices.map((p) => [Math.floor(p[0] / 1000), p])).values()].sort(
    (a, b) => a[0] - b[0],
  );
}
