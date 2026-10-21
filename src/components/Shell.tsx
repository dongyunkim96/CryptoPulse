import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import * as Dialog from '@radix-ui/react-dialog';
import {
  ArrowRight,
  Command,
  LayoutDashboard,
  Menu,
  Newspaper,
  Search,
  Star,
  TrendingUp,
  X,
  WifiOff,
} from 'lucide-react';
import { useMarkets } from '../lib/api';
import { useWatchlist, STORAGE_KEY } from '../state/watchlist';
import { Brand, Change, CoinIcon, SearchField, useOpenCoin } from './ui';
import { money } from '../lib/format';
const links = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/markets', label: 'Markets', icon: TrendingUp },
  { to: '/news', label: 'News', icon: Newspaper },
  { to: '/watchlist', label: 'Watchlist', icon: Star },
];
export function Shell({ children }: { children: ReactNode }) {
  const query = useMarkets();
  const ids = useWatchlist((s) => s.ids);
  const storageError = useWatchlist((s) => s.storageError);
  const [mobile, setMobile] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [offline, setOffline] = useState(!navigator.onLine);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const openCoin = useOpenCoin();
  const location = useLocation();
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) useWatchlist.getState().sync(e.newValue);
    };
    const online = () => setOffline(false),
      off = () => setOffline(true);
    const shortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((s) => !s);
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('online', online);
    window.addEventListener('offline', off);
    window.addEventListener('keydown', shortcut);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', off);
      window.removeEventListener('keydown', shortcut);
    };
  }, []);
  const mode = query.data?.mode;
  const results = (query.data?.data ?? [])
    .filter((c) => `${c.name} ${c.symbol}`.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 7);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="navigation">
          <Brand />
          <nav aria-label="Main navigation" className="desktop-nav">
            {links.map(({ to, label, icon: Icon }) => (
              <NavLink end={to === '/'} to={to} key={to}>
                <Icon size={16} />
                {label}
                {to === '/watchlist' && ids.length ? (
                  <span className="nav-count">{ids.length}</span>
                ) : null}
              </NavLink>
            ))}
          </nav>
          <div className="nav-actions">
            <button
              className="nav-search"
              ref={searchTrigger}
              onClick={() => {
                setSearch('');
                setSearchOpen(true);
              }}
              aria-label="Search coins"
            >
              <Search size={17} />
              <span>Search assets</span>
              <kbd>⌘ K</kbd>
            </button>
            <span
              className={`data-indicator ${mode === 'demo' ? 'demo' : ''}`}
              title={
                mode === 'demo'
                  ? 'Illustrative fixtures. No live prices.'
                  : mode === 'stale'
                    ? 'Cached data is stale'
                    : 'CoinGecko aggregate market data'
              }
            >
              <span />
              {offline
                ? 'Offline'
                : query.isError
                  ? 'Unavailable'
                  : mode === 'demo'
                    ? 'Demo data'
                    : mode === 'stale'
                      ? 'Stale data'
                      : mode === 'cached'
                        ? 'Cached data'
                        : 'Loading'}
            </span>
            <Dialog.Root open={mobile} onOpenChange={setMobile}>
              <Dialog.Trigger asChild>
                <button className="icon-button mobile-menu-button" aria-label="Open navigation">
                  <Menu size={22} />
                </button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="modal-overlay" />
                <Dialog.Content className="mobile-menu">
                  <div className="mobile-menu-heading">
                    <Dialog.Title>CryptoPulse</Dialog.Title>
                    <Dialog.Close asChild>
                      <button className="icon-button" aria-label="Close navigation">
                        <X />
                      </button>
                    </Dialog.Close>
                  </div>
                  <Dialog.Description className="sr-only">
                    Navigate between the four CryptoPulse pages.
                  </Dialog.Description>
                  <nav aria-label="Mobile navigation">
                    {links.map(({ to, label, icon: Icon }) => (
                      <NavLink to={to} key={to} end={to === '/'} onClick={() => setMobile(false)}>
                        <Icon size={20} />
                        {label}
                        {to === '/watchlist' ? (
                          <span className="count-tag">{ids.length}</span>
                        ) : null}
                      </NavLink>
                    ))}
                  </nav>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        </div>
      </header>
      <div className="ticker-bar">
        <div className="ticker-inner">
          <span className="ticker-label">
            MARKET PULSE <span />
          </span>
          {query.data?.data
            .filter((c) => ['BTC', 'ETH', 'SOL', 'BNB'].includes(c.symbol))
            .map((c) => (
              <button key={c.id} onClick={() => openCoin(c.id)}>
                <b>{c.symbol}</b>
                <span>{money(c.price)}</span>
                <Change value={c.change} />
              </button>
            ))}
          <Link to="/markets" className="ticker-all">
            All markets <ArrowRight size={13} />
          </Link>
        </div>
      </div>
      {offline ? (
        <div className="connection-banner" role="status">
          <WifiOff size={15} />
          You’re offline. Previously loaded data may be out of date.
        </div>
      ) : null}
      {storageError ? (
        <div className="connection-banner" role="status">
          Browser storage is unavailable. Favorites will last for this session only.
        </div>
      ) : null}
      {mode === 'stale' ? (
        <div className="connection-banner" role="status">
          Showing stale aggregate prices. {query.data?.note}
        </div>
      ) : null}
      <main id="main" tabIndex={-1} className="main-container" key={location.pathname}>
        {children}
      </main>
      <footer className="site-footer">
        <div className="footer-top">
          <div>
            <Brand />
            <p>A clearer perspective on the world of crypto.</p>
          </div>
          <nav aria-label="Footer navigation">
            {links.map((l) => (
              <Link to={l.to} key={l.to}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="provider-attribution">
            <span>
              {mode === 'demo' ? 'Market data: illustrative fixtures' : 'Powered by CoinGecko'}
            </span>
            <a href="https://www.coingecko.com/en/api" target="_blank" rel="noopener noreferrer">
              {mode === 'demo' ? 'Live integration: CoinGecko' : 'CoinGecko API'}
              <ArrowRight size={13} />
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} CryptoPulse</span>
          <span>Market information only. Not investment advice.</span>
          <a href="https://www.tradingview.com/" target="_blank" rel="noopener noreferrer">
            Charts by TradingView Lightweight Charts™
          </a>
        </div>
        <div className="chart-notice">
          TradingView Lightweight Charts™ · Copyright (с) 2025 TradingView, Inc. · Apache 2.0
        </div>
      </footer>
      <Dialog.Root open={searchOpen} onOpenChange={setSearchOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="modal-overlay" />
          <Dialog.Content
            className="search-dialog"
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              searchTrigger.current?.focus();
            }}
          >
            <div className="search-dialog-top">
              <Dialog.Title>Find your next asset</Dialog.Title>
              <Dialog.Close asChild>
                <button className="icon-button" aria-label="Close search">
                  <X size={20} />
                </button>
              </Dialog.Close>
            </div>
            <Dialog.Description>
              Search the {query.data?.data.length ?? 0} tracked assets by name or symbol.
            </Dialog.Description>
            <SearchField value={search} onChange={setSearch} />
            <div className="search-results">
              {results.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSearchOpen(false);
                    openCoin(c.id);
                  }}
                >
                  <CoinIcon coin={c} />
                  <span>
                    <b>{c.name}</b>
                    <small>{c.symbol}</small>
                  </span>
                  <span>{money(c.price)}</span>
                  <ArrowRight size={16} />
                </button>
              ))}
              {!results.length ? (
                <p className="search-no-results">No matching assets. Try another name or symbol.</p>
              ) : null}
            </div>
            <div className="search-dialog-foot">
              <Command size={13} /> K to search<span>ESC to close</span>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
