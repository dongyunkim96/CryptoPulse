// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Deployment configuration', () => {
  it('keeps real credentials out of the tracked environment template', () => {
    const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
    for (const name of [
      'COINGECKO_DEMO_API_KEY',
      'UPSTASH_REDIS_REST_URL',
      'UPSTASH_REDIS_REST_TOKEN',
    ]) {
      expect(example.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1].trim()).toBe('');
    }
  });
  it('rewrites the three deep links without swallowing API or asset paths', () => {
    const configuration = JSON.parse(
      readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'),
    );
    expect(configuration.rewrites.map((route: { source: string }) => route.source)).toEqual([
      '/markets',
      '/news',
      '/watchlist',
    ]);
    expect(configuration.framework).toBe('vite');
  });
});
