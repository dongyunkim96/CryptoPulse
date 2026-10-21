import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from '../src/App';
import { demoChart, demoCoins, demoEnvelope, demoGlobal, demoNews } from '../src/data/demo';
import { useWatchlist } from '../src/state/watchlist';
vi.mock('lightweight-charts', () => ({
  AreaSeries: 'area',
  ColorType: { Solid: 'solid' },
  CrosshairMode: { Normal: 0 },
  createChart: () => ({
    addSeries: () => ({ setData: vi.fn() }),
    timeScale: () => ({ fitContent: vi.fn() }),
    remove: vi.fn(),
  }),
}));
beforeEach(() => {
  window.scrollTo = vi.fn();
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    })),
  });
});
afterEach(() => {
  cleanup();
  useWatchlist.getState().clear();
});
function mount(path = '/') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(['markets'], demoEnvelope(demoCoins));
  client.setQueryData(['global'], demoEnvelope(demoGlobal));
  client.setQueryData(['news'], demoEnvelope(demoNews));
  for (const coin of demoCoins)
    for (const r of [1, 7, 30, 90, 365])
      client.setQueryData(['chart', coin.id, r], demoEnvelope(demoChart(coin.id, r)));
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
describe('Core application flows (DOM, chart library mocked)', () => {
  it.each([
    ['/', 'The market, in focus.'],
    ['/markets', 'Explore the markets.'],
    ['/news', 'Stay ahead of the story.'],
    ['/watchlist', 'Keep your favorites close.'],
  ])('loads the %s route', async (path, title) => {
    mount(path);
    expect(screen.getByRole('heading', { level: 1, name: title })).toBeTruthy();
    expect(screen.getByText('Demo data', { selector: '.data-indicator' })).toBeTruthy();
  });
  it('opens shareable details, switches chart ranges, and dismisses with Escape', async () => {
    const user = userEvent.setup();
    mount('/markets');
    const trigger = screen.getByRole('button', { name: 'Bitcoin BTC' });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Bitcoin details' });
    expect(within(dialog).getByText('Rank #1')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: '30D' }));
    expect(within(dialog).getByRole('button', { name: '30D' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
  it('loads a coin directly from its query parameter', async () => {
    mount('/watchlist?coin=ethereum');
    expect(await screen.findByRole('dialog', { name: 'Ethereum details' })).toBeTruthy();
  });
  it('searches from the global dialog and opens the selected coin', async () => {
    const user = userEvent.setup();
    mount('/');
    await user.click(screen.getByRole('button', { name: 'Search coins' }));
    const dialog = await screen.findByRole('dialog', { name: 'Find your next asset' });
    await user.type(
      within(dialog).getByRole('textbox', { name: 'Search cryptocurrencies' }),
      'solana',
    );
    await user.click(within(dialog).getByRole('button', { name: /Solana/ }));
    expect(await screen.findByRole('dialog', { name: 'Solana details' })).toBeTruthy();
  });
  it('supports navigation from the mobile menu', async () => {
    const user = userEvent.setup();
    mount('/');
    await user.click(screen.getByRole('button', { name: 'Open navigation' }));
    const menu = screen.getByRole('dialog', { name: 'CryptoPulse' });
    await user.click(within(menu).getByRole('link', { name: 'News' }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Stay ahead of the story.' }),
    ).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('requires confirmation before clearing saved assets', async () => {
    const user = userEvent.setup();
    act(() => useWatchlist.getState().toggle('bitcoin'));
    mount('/watchlist');
    await user.click(screen.getByRole('button', { name: 'Clear watchlist' }));
    const dialog = screen.getByRole('dialog', { name: 'Clear your watchlist?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep my assets' }));
    expect(useWatchlist.getState().ids).toEqual(['bitcoin']);
    await user.click(screen.getByRole('button', { name: 'Clear watchlist' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Clear watchlist' }),
    );
    expect(screen.getByRole('heading', { name: 'A space for your kind of crypto' })).toBeTruthy();
  });
  it('filters news, shows an empty search state, and keeps external links safe', async () => {
    const user = userEvent.setup();
    mount('/news');
    await user.click(screen.getByRole('button', { name: 'Ethereum' }));
    expect(
      screen.getAllByRole('link').some((l) => l.getAttribute('href')?.includes('ethereum.org')),
    ).toBe(true);
    await user.type(screen.getByRole('textbox', { name: 'Search headlines' }), 'nothing-matches');
    expect(screen.getByRole('heading', { name: 'No stories found' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    for (const l of document.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]'))
      expect(l.rel).toContain('noopener');
  });
});
