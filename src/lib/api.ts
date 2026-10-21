import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { chartSchema, coinSchema, envelope, globalSchema, articleSchema } from '../domain';
import type { Range } from '../domain';
// Vite's demo middleware, Cloudflare Worker, and Vercel Functions share /api.
async function request<T extends z.ZodType>(
  path: string,
  schema: T,
  signal: AbortSignal,
): Promise<z.infer<T>> {
  const r = await fetch(path, { signal });
  if (!r.ok)
    throw new Error(
      r.status === 503
        ? 'Market data is temporarily unavailable. Please try again later.'
        : 'Unable to load data. Please retry.',
    );
  return schema.parse(await r.json());
}
export const useMarkets = () =>
  useQuery({
    queryKey: ['markets'],
    queryFn: ({ signal }) => request('/api/markets', envelope(z.array(coinSchema)), signal),
    staleTime: 900000,
  });
export const useGlobal = () =>
  useQuery({
    queryKey: ['global'],
    queryFn: ({ signal }) => request('/api/global', envelope(globalSchema), signal),
    staleTime: 3600000,
  });
export const useNews = () =>
  useQuery({
    queryKey: ['news'],
    queryFn: ({ signal }) => request('/api/news', envelope(z.array(articleSchema)), signal),
    staleTime: 1800000,
  });
export const useChart = (id: string, days: Range) =>
  useQuery({
    queryKey: ['chart', id, days],
    queryFn: ({ signal }) =>
      request(
        `/api/chart?coin=${encodeURIComponent(id)}&days=${days}`,
        envelope(chartSchema),
        signal,
      ),
    staleTime: 1800000,
  });
