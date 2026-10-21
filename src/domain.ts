import { z } from 'zod';
const nullable = z.number().finite().nullable();
export const coinSchema = z.object({
  id: z.string(),
  name: z.string(),
  symbol: z.string(),
  image: z.string().nullable(),
  rank: nullable,
  price: nullable,
  change: nullable,
  marketCap: nullable,
  volume: nullable,
  high: nullable,
  low: nullable,
  supply: nullable,
  updatedAt: z.string().nullable(),
  sparkline: z.array(z.number().finite()),
});
export type Coin = z.infer<typeof coinSchema>;
export const globalSchema = z.object({
  marketCap: nullable,
  volume: nullable,
  dominance: nullable,
  change: nullable,
  updatedAt: z.string().nullable(),
});
export const chartSchema = z.array(
  z.tuple([z.number().finite(), z.number().finite().nonnegative()]),
);
export type ChartPoint = z.infer<typeof chartSchema>[number];
export const articleSchema = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string(),
  url: z.string().url(),
  publishedAt: z.string(),
  topic: z.string(),
  art: z.enum(['bitcoin', 'ethereum', 'network', 'markets']),
  demo: z.boolean(),
});
export type Article = z.infer<typeof articleSchema>;
export const envelope = <T extends z.ZodType>(schema: T) =>
  z.object({
    data: schema,
    mode: z.enum(['demo', 'cached', 'stale']),
    fetchedAt: z.string(),
    note: z.string().optional(),
  });
export type Envelope<T> = {
  data: T;
  mode: 'demo' | 'cached' | 'stale';
  fetchedAt: string;
  note?: string;
};
export const ranges = [1, 7, 30, 90, 365] as const;
export type Range = (typeof ranges)[number];
