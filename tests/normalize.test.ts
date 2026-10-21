import { describe, it, expect } from 'vitest';
import { normalizeChart, normalizeGlobal, normalizeMarkets, safeUrl } from '../server/normalize';
describe('Provider normalization', () => {
  it('keeps missing values null, sorts provider ranks, and normalizes symbols', () => {
    const coins = normalizeMarkets([
      { id: 'test', name: 'Test', symbol: 't', market_cap_rank: 2 },
      { id: 'first', name: 'First', symbol: 'f', market_cap_rank: 1, current_price: 0 },
    ]);
    expect(coins[0].id).toBe('first');
    expect(coins[0].price).toBe(0);
    expect(coins[1].price).toBeNull();
    expect(coins[1].symbol).toBe('T');
    expect(coins[1].sparkline).toEqual([]);
  });
  it('rejects malformed data and unsafe URLs', () => {
    expect(() => normalizeMarkets([{ id: '../../secret' }])).toThrow();
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('https://a:b@example.com')).toBeNull();
    expect(safeUrl('https://example.com/icon.png')).toBe('https://example.com/icon.png');
  });
  it('normalizes global timestamps without fabricated statistics', () => {
    const g = normalizeGlobal({ data: { updated_at: 1700000000, total_market_cap: { usd: 42 } } });
    expect(g.marketCap).toBe(42);
    expect(g.volume).toBeNull();
    expect(g.updatedAt).toBe(new Date(1700000000000).toISOString());
  });
  it('sorts and deduplicates chart timestamps at chart precision', () => {
    expect(
      normalizeChart({
        prices: [
          [2000, 2],
          [1000, 1],
          [2100, 3],
        ],
      }),
    ).toEqual([
      [1000, 1],
      [2100, 3],
    ]);
  });
});
