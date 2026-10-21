import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown, Search, Star } from 'lucide-react';
import type { Coin } from '../domain';
import { money } from '../lib/format';
import { Change, CoinIcon, Empty, Favorite, SearchField, Sparkline, useOpenCoin } from './ui';
import { useWatchlist } from '../state/watchlist';
type SortKey = 'rank' | 'name' | 'price' | 'change' | 'marketCap' | 'volume';
export function CoinTable({
  coins,
  compact = false,
  watchlist = false,
}: {
  coins: Coin[];
  compact?: boolean;
  watchlist?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All assets');
  const [sort, setSort] = useState<SortKey>('rank');
  const [asc, setAsc] = useState(true);
  const ids = useWatchlist((s) => s.ids);
  const open = useOpenCoin();
  const filtered = coins
    .filter(
      (c) =>
        (!watchlist || ids.includes(c.id)) &&
        `${c.name} ${c.symbol}`.toLowerCase().includes(search.toLowerCase()) &&
        (filter !== 'Gainers' || (c.change ?? 0) > 0) &&
        (filter !== 'Losers' || (c.change ?? 0) < 0) &&
        (filter !== 'Favorites' || ids.includes(c.id)),
    )
    .sort((a, b) => {
      const x = a[sort],
        y = b[sort];
      if (x === null) return 1;
      if (y === null) return -1;
      return (
        (typeof x === 'string' ? x.localeCompare(String(y)) : Number(x) - Number(y)) *
        (asc ? 1 : -1)
      );
    });
  const shown = compact ? filtered.slice(0, 5) : filtered;
  function header(key: SortKey, label: string, className = '') {
    return (
      <th
        className={className}
        aria-sort={sort === key ? (asc ? 'ascending' : 'descending') : 'none'}
      >
        <button
          onClick={() => {
            if (sort === key) setAsc(!asc);
            else {
              setSort(key);
              setAsc(key === 'rank' || key === 'name');
            }
          }}
        >
          {label}
          {sort === key ? (
            asc ? (
              <ArrowUp size={12} />
            ) : (
              <ArrowDown size={12} />
            )
          ) : (
            <ChevronsUpDown size={12} />
          )}
        </button>
      </th>
    );
  }
  return (
    <div className="market-workspace">
      {!compact ? (
        <div className="table-toolbar">
          <div className="filter-tabs" aria-label="Filter assets">
            {(watchlist
              ? ['All assets', 'Gainers', 'Losers']
              : ['All assets', 'Gainers', 'Losers', 'Favorites']
            ).map((f) => (
              <button
                key={f}
                className={filter === f ? 'active' : ''}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f === 'Favorites' ? <Star size={14} /> : null}
                {f}
              </button>
            ))}
          </div>
          <SearchField value={search} onChange={setSearch} />
        </div>
      ) : null}
      {shown.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="favorite-column">
                  <span className="sr-only">Favorite</span>
                </th>
                {header('rank', '#', 'rank-column')}
                {header('name', 'Asset', 'name-column')}
                {header('price', 'Price')}
                {header('change', '24h change')}
                {header('marketCap', 'Market cap', 'secondary-column')}
                {header('volume', 'Volume (24h)', 'volume-column')}
                <th className="spark-column">Last 7 days</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Favorite coin={c} />
                  </td>
                  <td className="muted rank-column">{c.rank ?? '—'}</td>
                  <td className="name-column">
                    <button
                      className="coin-name"
                      aria-label={`${c.name} ${c.symbol}`}
                      onClick={() => open(c.id)}
                    >
                      <CoinIcon coin={c} />
                      <span>
                        <b>{c.name}</b>
                        <span className="coin-symbol">{c.symbol}</span>
                      </span>
                    </button>
                  </td>
                  <td className="numeric">{money(c.price)}</td>
                  <td>
                    <Change value={c.change} />
                  </td>
                  <td className="secondary-column numeric">{money(c.marketCap, true)}</td>
                  <td className="volume-column numeric muted">{money(c.volume, true)}</td>
                  <td className="spark-column">
                    <Sparkline values={c.sparkline} negative={(c.change ?? 0) < 0} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty icon={<Search />} title={search ? 'No matching assets' : 'Nothing here just yet'}>
          {search
            ? `No assets match “${search}”. Try another name or symbol.`
            : 'Try another filter, or add assets using the star next to a coin.'}
          <button
            className="button secondary"
            onClick={() => {
              setSearch('');
              setFilter('All assets');
            }}
          >
            Reset filters
          </button>
        </Empty>
      )}
      <div className="table-foot">
        <span>
          Showing {shown.length} of {compact ? coins.length : filtered.length}{' '}
          {watchlist ? 'saved' : 'tracked'} assets
        </span>
        <span>
          Prices in USD <span className="legend-dot" />
        </span>
      </div>
    </div>
  );
}
