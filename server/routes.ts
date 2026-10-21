import { z } from 'zod';
import { demoChart, demoCoins, demoEnvelope, demoGlobal, demoNews } from '../src/data/demo.ts';
import { ranges } from '../src/domain.ts';

export const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });

export function parseRoute(url: URL) {
  if ([...url.searchParams.keys()].some((key) => !['coin', 'days'].includes(key))) return null;
  if (['/api/markets', '/api/global', '/api/news'].includes(url.pathname))
    return url.search ? null : { kind: url.pathname.slice(5), coin: '', days: 7 };
  if (url.pathname !== '/api/chart') return null;
  // Reject ambiguous duplicate arguments as well as unsupported ranges.
  if (url.searchParams.getAll('coin').length !== 1 || url.searchParams.getAll('days').length !== 1)
    return null;
  const parsed = z
    .object({
      coin: z.string().regex(/^[a-z0-9-]{1,100}$/),
      days: z.coerce.number().refine((n) => (ranges as readonly number[]).includes(n)),
    })
    .safeParse(Object.fromEntries(url.searchParams));
  return parsed.success ? { kind: 'chart', ...parsed.data } : null;
}

export function demoResponse(route: NonNullable<ReturnType<typeof parseRoute>>, note?: string) {
  const wrap = <T>(data: T) => json({ ...demoEnvelope(data), ...(note ? { note } : {}) });
  if (route.kind === 'markets') return wrap(demoCoins);
  if (route.kind === 'global') return wrap(demoGlobal);
  if (route.kind === 'news') return wrap(demoNews);
  if (!demoCoins.some((coin) => coin.id === route.coin))
    return json({ error: 'Unsupported asset' }, 400);
  return wrap(demoChart(route.coin, route.days));
}
