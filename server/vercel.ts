import type { Coin } from '../src/domain.ts';
import { normalizeChart, normalizeGlobal, normalizeMarkets } from './normalize.ts';
import { demoResponse, json, parseRoute } from './routes.ts';
import { createRedisCommands, RedisGateway } from './redis-gateway.ts';

export interface VercelEnvironment {
  DATA_MODE?: string;
  COINGECKO_DEMO_API_KEY?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  CG_MONTHLY_BUDGET?: string;
  CG_MINUTE_BUDGET?: string;
}
const capped = (value: string | undefined, limit: number) =>
  Math.min(limit, Math.max(1, Math.floor(Number(value) || limit)));
export async function handleVercelRequest(
  request: Request,
  env: VercelEnvironment = process.env,
): Promise<Response> {
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
  const route = parseRoute(new URL(request.url));
  if (!route) return json({ error: 'Unsupported resource' }, 400);
  if (route.kind === 'news') return demoResponse(route);
  if (
    env.DATA_MODE !== 'live' ||
    !env.COINGECKO_DEMO_API_KEY ||
    !env.UPSTASH_REDIS_REST_URL ||
    !env.UPSTASH_REDIS_REST_TOKEN
  )
    return demoResponse(
      route,
      'Illustrative data. Live aggregate data requires a server API key and shared Redis quota storage.',
    );
  try {
    const gateway = new RedisGateway(
      createRedisCommands(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN),
      (path) =>
        fetch(`https://api.coingecko.com/api/v3${path}`, {
          headers: { 'x-cg-demo-api-key': env.COINGECKO_DEMO_API_KEY! },
          signal: AbortSignal.timeout(10000),
        }),
      capped(env.CG_MONTHLY_BUDGET, 7500),
      capped(env.CG_MINUTE_BUDGET, 25),
    );
    if (route.kind === 'global')
      return json(await gateway.get('global', '/global', 3600000, normalizeGlobal));
    const markets = () =>
      gateway.get(
        'markets',
        '/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=true',
        900000,
        normalizeMarkets,
      );
    if (route.kind === 'markets') return json(await markets());
    const universe = (await markets()).data as Coin[];
    if (!universe.some((c) => c.id === route.coin))
      return json({ error: 'Asset is outside the tracked universe' }, 400);
    return json(
      await gateway.get(
        `chart:${route.coin}:${route.days}`,
        `/coins/${route.coin}/market_chart?vs_currency=usd&days=${route.days}`,
        route.days >= 90 ? 21600000 : 1800000,
        normalizeChart,
        true,
      ),
    );
  } catch {
    // Never log request headers, environment values, or raw upstream bodies.
    console.error('cryptopulse_market_data_unavailable');
    return json(
      { error: 'Market data unavailable. Check server credentials and shared quota storage.' },
      503,
    );
  }
}
