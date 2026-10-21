import type { Article, ChartPoint, Coin, Envelope } from '../domain.ts';
export const DEMO_DATE = '2026-10-20T16:00:00.000Z';
// Hand-authored illustrative fixtures, not a historical market snapshot.
const rows: [string, string, string, number, number, number, number, string][] = [
  ['bitcoin', 'Bitcoin', 'BTC', 67432.8, 2.34, 1330e9, 28.4e9, '#f7931a'],
  ['ethereum', 'Ethereum', 'ETH', 3521.67, 1.87, 423e9, 15.2e9, '#8c9ef5'],
  ['tether', 'Tether', 'USDT', 1.0002, 0.01, 112e9, 49.1e9, '#26a17b'],
  ['binancecoin', 'BNB', 'BNB', 592.48, -0.64, 87.4e9, 1.8e9, '#f3ba2f'],
  ['solana', 'Solana', 'SOL', 172.56, 5.42, 79.8e9, 3.6e9, '#ad85ed'],
  ['usd-coin', 'USDC', 'USDC', 0.9999, -0.01, 32.4e9, 6.8e9, '#2775ca'],
  ['ripple', 'XRP', 'XRP', 0.6248, 0.92, 34.7e9, 1.3e9, '#8193a3'],
  ['dogecoin', 'Dogecoin', 'DOGE', 0.1632, 4.21, 23.5e9, 1.1e9, '#c4a650'],
  ['the-open-network', 'Toncoin', 'TON', 6.81, -1.28, 16.7e9, 295e6, '#0098ea'],
  ['cardano', 'Cardano', 'ADA', 0.4621, -2.15, 16.5e9, 380e6, '#2f79e2'],
  ['avalanche-2', 'Avalanche', 'AVAX', 38.42, 3.18, 15.1e9, 480e6, '#e84142'],
  ['shiba-inu', 'Shiba Inu', 'SHIB', 0.00002416, 1.56, 14.2e9, 350e6, '#e77c36'],
  ['chainlink', 'Chainlink', 'LINK', 17.82, 6.72, 10.8e9, 690e6, '#416fe8'],
  ['polkadot', 'Polkadot', 'DOT', 7.23, -3.46, 10.2e9, 190e6, '#e35194'],
  ['bitcoin-cash', 'Bitcoin Cash', 'BCH', 462.31, -1.92, 9.1e9, 240e6, '#4cca78'],
  ['tron', 'TRON', 'TRX', 0.1246, 0.48, 10.8e9, 280e6, '#f35058'],
  ['near', 'NEAR Protocol', 'NEAR', 7.68, 8.35, 8.3e9, 590e6, '#9edac6'],
  ['polygon-ecosystem-token', 'Polygon', 'POL', 0.7234, -0.86, 7.2e9, 250e6, '#9665e9'],
  ['litecoin', 'Litecoin', 'LTC', 84.62, 1.23, 6.3e9, 310e6, '#7298ce'],
  ['uniswap', 'Uniswap', 'UNI', 10.84, 4.68, 6.5e9, 210e6, '#f166a4'],
];
export const coinColors = Object.fromEntries(rows.map((r) => [r[0], r[7]]));
export const demoChart = (id: string, days: number): ChartPoint[] => {
  const row = rows.find((r) => r[0] === id) ?? rows[0];
  const seed = rows.findIndex((r) => r[0] === id) + 3;
  let value = 0;
  const path = Array.from({ length: 150 }, (_, i) => {
    value += Math.sin(i * 1.7 + seed) * 0.004 + Math.cos(i * 0.39 + seed) * 0.003 + 0.00065;
    return value;
  });
  return path.map((n, i) => [
    Date.parse(DEMO_DATE) - days * 864e5 + (i / 149) * days * 864e5,
    row[3] * (1 + n - path[149]),
  ]);
};
export const demoCoins: Coin[] = rows.map((r, i) => ({
  id: r[0],
  name: r[1],
  symbol: r[2],
  image: null,
  rank: i + 1,
  price: r[3],
  change: r[4],
  marketCap: r[5],
  volume: r[6],
  high: r[3] * 1.024,
  low: r[3] * 0.964,
  supply: r[5] / r[3],
  updatedAt: DEMO_DATE,
  sparkline: demoChart(r[0], 7).map((p) => p[1]),
}));
export const demoGlobal = {
  marketCap: 2.48e12,
  volume: 84.62e9,
  dominance: 53.6,
  change: 2.18,
  updatedAt: DEMO_DATE,
};
export const demoNews: Article[] = [
  {
    id: 'n1',
    title: 'Bitcoin and the next chapter of institutional adoption',
    topic: 'Bitcoin',
    source: 'CryptoPulse editorial demo',
    url: 'https://bitcoin.org/en/bitcoin-for-businesses',
    art: 'bitcoin',
    publishedAt: DEMO_DATE,
    demo: true,
  },
  {
    id: 'n2',
    title: 'Ethereum’s scaling ecosystem, explained',
    topic: 'Ethereum',
    source: 'CryptoPulse editorial demo',
    url: 'https://ethereum.org/en/roadmap/scaling/',
    art: 'ethereum',
    publishedAt: '2026-10-20T14:30:00Z',
    demo: true,
  },
  {
    id: 'n3',
    title: 'A closer look at the networks powering Web3',
    topic: 'Technology',
    source: 'CryptoPulse editorial demo',
    url: 'https://solana.com/learn',
    art: 'network',
    publishedAt: '2026-10-20T12:00:00Z',
    demo: true,
  },
  {
    id: 'n4',
    title: 'Beyond the price: making sense of market capitalization',
    topic: 'Markets',
    source: 'CryptoPulse editorial demo',
    url: 'https://www.coingecko.com/learn/what-is-market-cap-crypto',
    art: 'markets',
    publishedAt: '2026-10-20T10:00:00Z',
    demo: true,
  },
  {
    id: 'n5',
    title: 'How proof of stake helps secure Ethereum',
    topic: 'Ethereum',
    source: 'CryptoPulse editorial demo',
    url: 'https://ethereum.org/en/developers/docs/consensus-mechanisms/pos/',
    art: 'ethereum',
    publishedAt: '2026-10-19T15:00:00Z',
    demo: true,
  },
  {
    id: 'n6',
    title: 'Your guide to Bitcoin’s fixed supply',
    topic: 'Bitcoin',
    source: 'CryptoPulse editorial demo',
    url: 'https://bitcoin.org/en/faq',
    art: 'bitcoin',
    publishedAt: '2026-10-19T12:00:00Z',
    demo: true,
  },
  {
    id: 'n7',
    title: 'What makes a blockchain decentralized?',
    topic: 'Technology',
    source: 'CryptoPulse editorial demo',
    url: 'https://ethereum.org/en/developers/docs/intro-to-ethereum/',
    art: 'network',
    publishedAt: '2026-10-18T15:00:00Z',
    demo: true,
  },
  {
    id: 'n8',
    title: 'Understanding liquidity and trading volume',
    topic: 'Markets',
    source: 'CryptoPulse editorial demo',
    url: 'https://www.coingecko.com/learn',
    art: 'markets',
    publishedAt: '2026-10-18T10:00:00Z',
    demo: true,
  },
];
export function demoEnvelope<T>(data: T): Envelope<T> {
  return {
    data,
    mode: 'demo',
    fetchedAt: DEMO_DATE,
    note: 'Illustrative fixtures. Not current market data.',
  };
}
