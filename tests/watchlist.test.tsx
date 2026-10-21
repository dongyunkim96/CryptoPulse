import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { parseFavorites, STORAGE_KEY, useWatchlist } from '../src/state/watchlist';
import { demoCoins } from '../src/data/demo';
import { CoinTable } from '../src/components/CoinTable';
afterEach(() => {
  cleanup();
  useWatchlist.getState().clear();
});
describe('Watchlist', () => {
  it('recovers from malformed and outdated localStorage values', () => {
    expect(parseFavorites('{broken')).toEqual([]);
    expect(parseFavorites('{"v":1}')).toEqual([]);
    expect(parseFavorites('["bitcoin","bitcoin",null,5,"../bad","old-asset"]')).toEqual([
      'bitcoin',
      'old-asset',
    ]);
  });
  it('adds and removes assets and writes persistent data', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CoinTable coins={demoCoins.slice(0, 2)} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Add Bitcoin to watchlist' }));
    expect(useWatchlist.getState().ids).toEqual(['bitcoin']);
    expect(parseFavorites(localStorage.getItem(STORAGE_KEY))).toEqual(['bitcoin']);
    await user.click(screen.getByRole('button', { name: 'Remove Bitcoin from watchlist' }));
    expect(useWatchlist.getState().ids).toEqual([]);
  });
  it('searches, filters, and sorts the tracked assets', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CoinTable coins={demoCoins} />
      </MemoryRouter>,
    );
    await user.type(screen.getByRole('textbox', { name: 'Search cryptocurrencies' }), 'sol');
    expect(screen.getByRole('button', { name: 'Solana SOL' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Bitcoin BTC' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    await user.click(screen.getByRole('button', { name: 'Losers' }));
    expect(screen.queryByRole('button', { name: 'Bitcoin BTC' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Price' }));
    expect(screen.getByRole('columnheader', { name: 'Price' }).getAttribute('aria-sort')).toBe(
      'descending',
    );
  });
});
