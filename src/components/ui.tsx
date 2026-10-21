import type { CSSProperties, ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, ArrowRight, Star, Search, RefreshCw } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { useWatchlist } from '../state/watchlist';
import { coinColors } from '../data/demo';
import type { Coin } from '../domain';
import { percent } from '../lib/format';
export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="CryptoPulse home">
      <span className="brand-icon">
        <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path
            d="M4 18h7l4-10 5 17 4-12h4"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      Crypto<span>Pulse</span>
      <span className="brand-dot">.</span>
    </Link>
  );
}
export function CoinIcon({ coin, size = 34 }: { coin: Coin; size?: number }) {
  const color = coinColors[coin.id] ?? '#8ba7a0';
  return (
    <span
      className={`coin-icon coin-${coin.symbol.toLowerCase()}`}
      style={{ '--coin': color, width: size, height: size } as CSSProperties}
    >
      {coin.image ? (
        <img
          src={coin.image}
          alt=""
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : null}
      <span aria-hidden="true">
        {coin.symbol === 'BTC'
          ? '₿'
          : coin.symbol === 'ETH'
            ? '♦'
            : coin.symbol === 'SOL'
              ? '≋'
              : coin.symbol === 'USDT'
                ? '₮'
                : coin.symbol === 'BNB'
                  ? '⬡'
                  : coin.symbol.slice(0, 1)}
      </span>
    </span>
  );
}
export function Change({ value, className = '' }: { value: number | null; className?: string }) {
  return (
    <span
      className={`${value === null ? 'muted' : value < 0 ? 'negative' : 'positive'} change ${className}`}
    >
      {value !== null ? (
        value < 0 ? (
          <ArrowDownRight size={14} />
        ) : (
          <ArrowUpRight size={14} />
        )
      ) : null}
      {percent(value)}
    </span>
  );
}
export function Favorite({ coin }: { coin: Coin }) {
  const saved = useWatchlist((s) => s.ids.includes(coin.id));
  const toggle = useWatchlist((s) => s.toggle);
  return (
    <button
      className={`icon-button favorite ${saved ? 'saved' : ''}`}
      aria-label={`${saved ? 'Remove' : 'Add'} ${coin.name} ${saved ? 'from' : 'to'} watchlist`}
      aria-pressed={saved}
      onClick={() => toggle(coin.id)}
    >
      <Star size={17} fill={saved ? 'currentColor' : 'none'} />
    </button>
  );
}
export function Sparkline({ values, negative = false }: { values: number[]; negative?: boolean }) {
  if (values.length < 2) return <span className="muted">—</span>;
  const min = Math.min(...values),
    max = Math.max(...values);
  const points = values
    .map((v, i) => `${(i / (values.length - 1)) * 100},${30 - ((v - min) / (max - min || 1)) * 25}`)
    .join(' ');
  return (
    <svg
      className={`sparkline ${negative ? 'down' : ''}`}
      viewBox="0 0 100 35"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
export function useOpenCoin() {
  const [params, setParams] = useSearchParams();
  return (id: string) => {
    const next = new URLSearchParams(params);
    next.set('coin', id);
    setParams(next, { preventScrollReset: true });
  };
}
export function SectionTitle({
  title,
  subtitle,
  link,
  to,
}: {
  title: string;
  subtitle?: string;
  link?: string;
  to?: string;
}) {
  return (
    <div className="section-title">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {to ? (
        <Link to={to} className="text-link">
          {link ?? 'View all'}
          <ArrowRight size={15} />
        </Link>
      ) : null}
    </div>
  );
}
export function Empty({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function SearchField({
  value,
  onChange,
  placeholder = 'Search by name or symbol…',
  label = 'Search cryptocurrencies',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
}) {
  return (
    <label className="search-field">
      <Search size={17} />
      <input
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value ? (
        <button onClick={() => onChange('')} aria-label="Clear search" type="button">
          ×
        </button>
      ) : null}
    </label>
  );
}
export function ErrorState({ retry }: { retry: () => void }) {
  return (
    <Empty icon={<RefreshCw />} title="A little interruption">
      We couldn’t load this data. Your saved watchlist is still here.
      <button className="button" onClick={retry}>
        Try again <RefreshCw size={15} />
      </button>
    </Empty>
  );
}
export function Loading() {
  return (
    <div className="loading-state" role="status">
      <span className="loading-dot" />
      Loading market data…
    </div>
  );
}
