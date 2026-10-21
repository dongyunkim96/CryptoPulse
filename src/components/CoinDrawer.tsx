import { useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useSearchParams } from 'react-router';
import { ArrowUpRight, Star, X } from 'lucide-react';
import { useMarkets, useNews } from '../lib/api';
import { money, number, timestamp } from '../lib/format';
import { useWatchlist } from '../state/watchlist';
import { CoinIcon, Empty, ErrorState, Loading } from './ui';
import { PriceChart } from './PriceChart';
export function CoinDrawer() {
  const [params, setParams] = useSearchParams();
  const selected = params.get('coin');
  const query = useMarkets();
  const news = useNews();
  const coin = query.data?.data.find((c) => c.id === selected);
  const ids = useWatchlist((s) => s.ids),
    toggle = useWatchlist((s) => s.toggle);
  const restore = useRef<HTMLElement | null>(null);
  const close = () => {
    const next = new URLSearchParams(params);
    next.delete('coin');
    setParams(next, { preventScrollReset: true });
  };
  return (
    <Dialog.Root
      open={!!selected}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="drawer-overlay" />
        <Dialog.Content
          className="coin-drawer"
          onOpenAutoFocus={() => {
            restore.current = document.activeElement as HTMLElement;
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (restore.current?.isConnected) restore.current.focus();
            else document.querySelector<HTMLElement>('.brand')?.focus();
          }}
        >
          <div className="drawer-top">
            <span className="overline">ASSET OVERVIEW</span>
            <Dialog.Close asChild>
              <button className="icon-button" aria-label="Close coin details">
                <X size={22} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Title className="sr-only">
            {coin ? `${coin.name} details` : 'Coin details'}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            Market statistics, historical prices, and related reading. All prices in US dollars.
          </Dialog.Description>
          {query.isPending ? (
            <Loading />
          ) : query.isError ? (
            <ErrorState retry={() => void query.refetch()} />
          ) : coin ? (
            <>
              <div className="drawer-identity">
                <CoinIcon coin={coin} size={52} />
                <div>
                  <h2>{coin.name}</h2>
                  <span className="muted">
                    {coin.symbol} <span className="rank-badge">Rank #{coin.rank ?? '—'}</span>
                  </span>
                </div>
                <button
                  className={`button ${ids.includes(coin.id) ? 'secondary' : ''}`}
                  onClick={() => toggle(coin.id)}
                >
                  <Star size={16} fill={ids.includes(coin.id) ? 'currentColor' : 'none'} />
                  {ids.includes(coin.id) ? 'Saved' : 'Watch'}
                </button>
              </div>
              <PriceChart coin={coin} compact />
              <div className="drawer-section">
                <h3>Market statistics</h3>
                <dl className="stats-grid">
                  {[
                    ['Market capitalization', money(coin.marketCap, true)],
                    ['24h volume', money(coin.volume, true)],
                    ['24h high', money(coin.high)],
                    ['24h low', money(coin.low)],
                    ['Circulating supply', `${number(coin.supply)} ${coin.symbol}`],
                    ['Market rank', coin.rank ? `#${coin.rank}` : 'Unavailable'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="drawer-section">
                <h3>
                  Related reading <span className="subtle-badge">Demo editorial</span>
                </h3>
                <p className="small muted">
                  Matched by asset name/topic. Educational resources, not live news.
                </p>
                {news.data?.data
                  .filter(
                    (a) =>
                      a.topic === coin.name ||
                      a.title.toLowerCase().includes(coin.name.toLowerCase()),
                  )
                  .slice(0, 3)
                  .map((a) => (
                    <a
                      href={a.url}
                      key={a.id}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="related-story"
                    >
                      <span>
                        {a.title}
                        <small>{a.source}</small>
                      </span>
                      <ArrowUpRight size={17} />
                    </a>
                  ))}
                {!news.data?.data.some(
                  (a) =>
                    a.topic === coin.name ||
                    a.title.toLowerCase().includes(coin.name.toLowerCase()),
                ) ? (
                  <p className="inline-note">
                    No related stories for this asset in the current demo collection.
                  </p>
                ) : null}
              </div>
              <div className="drawer-data-note">
                <b>
                  {query.data?.mode === 'demo'
                    ? 'Demo fixture · not current data'
                    : query.data?.mode === 'stale'
                      ? 'Stale CoinGecko aggregate'
                      : 'Cached CoinGecko aggregate'}
                </b>
                <span>Asset timestamp: {timestamp(coin.updatedAt)}</span>
                <span>Fetched/fixture timestamp: {timestamp(query.data?.fetchedAt ?? null)}</span>
                <span>Exchange streaming is not connected.</span>
              </div>
            </>
          ) : (
            <Empty icon={<Star />} title="Asset unavailable">
              This asset is outside the current tracked universe.
              <button className="button secondary" onClick={close}>
                Back to the dashboard
              </button>
            </Empty>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
