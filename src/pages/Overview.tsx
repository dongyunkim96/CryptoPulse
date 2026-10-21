import { useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  Globe2,
  Layers,
  Star,
} from 'lucide-react';
import { useGlobal, useMarkets, useNews } from '../lib/api';
import { Change, CoinIcon, ErrorState, Loading, SectionTitle, useOpenCoin } from '../components/ui';
import { PriceChart } from '../components/PriceChart';
import { CoinTable } from '../components/CoinTable';
import { NewsCard } from '../components/NewsCard';
import { money } from '../lib/format';
import { useWatchlist } from '../state/watchlist';
export function Overview() {
  const markets = useMarkets(),
    global = useGlobal(),
    news = useNews();
  const [asset, setAsset] = useState('bitcoin');
  const [movers, setMovers] = useState<'Gainers' | 'Losers'>('Gainers');
  const open = useOpenCoin();
  const ids = useWatchlist((s) => s.ids);
  const coins = markets.data?.data ?? [];
  const coin = coins.find((c) => c.id === asset) ?? coins[0];
  const metrics = global.data?.data;
  const movement = [...coins]
    .filter((c) => c.change !== null && (movers === 'Gainers' ? c.change! > 0 : c.change! < 0))
    .sort((a, b) => (movers === 'Gainers' ? b.change! - a.change! : a.change! - b.change!))
    .slice(0, 4);
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="overline">
            <span className="mint-dash" />
            YOUR MARKET AT A GLANCE
          </div>
          <h1>
            The market, in focus<span className="mint">.</span>
          </h1>
          <p>A clearer perspective on crypto. All in one place.</p>
        </div>
        <div className="heading-date">
          <Globe2 size={15} />
          <span>
            Global market <span className="muted">/ USD</span>
          </span>
        </div>
      </div>
      <div className="metrics-grid">
        {[
          {
            title: 'Total market cap',
            value: money(metrics?.marketCap ?? null, true),
            icon: Globe2,
            detail: <Change value={metrics?.change ?? null} />,
            caption: 'vs. 24 hours ago',
          },
          {
            title: 'Trading volume',
            value: money(metrics?.volume ?? null, true),
            icon: ChartNoAxesCombined,
            detail: <span className="muted">Across the crypto market</span>,
            caption: '24-hour aggregate',
          },
          {
            title: 'Bitcoin dominance',
            value:
              metrics?.dominance !== null && metrics?.dominance !== undefined
                ? `${metrics.dominance.toFixed(1)}%`
                : 'Unavailable',
            icon: Layers,
            detail: (
              <div className="dominance-bar">
                <i style={{ width: `${metrics?.dominance ?? 0}%` }} />
              </div>
            ),
            caption: 'Share of total market cap',
          },
          {
            title: 'Market cap change',
            value:
              metrics?.change !== null && metrics?.change !== undefined
                ? `${metrics.change > 0 ? '+' : ''}${metrics.change.toFixed(2)}%`
                : 'Unavailable',
            icon: ArrowUpRight,
            detail: <span className="muted">Global market · 24 hours</span>,
            caption: 'Aggregate market movement',
          },
        ].map((m, i) => (
          <div className="metric-card" key={m.title}>
            <div className="metric-label">
              {m.title}
              <m.icon size={16} />
            </div>
            <div
              className={`metric-value ${i === 3 && metrics?.change !== null && metrics?.change !== undefined ? (metrics.change < 0 ? 'negative' : 'positive') : ''}`}
            >
              {global.isPending ? '—' : m.value}
            </div>
            <div className="metric-detail">{m.detail}</div>
            <span className="metric-caption">{m.caption}</span>
          </div>
        ))}
      </div>
      {global.isError ? (
        <p className="inline-note">
          Global metrics are unavailable.{' '}
          <button onClick={() => void global.refetch()}>Retry metrics</button>
        </p>
      ) : null}
      <div className="analytics-grid">
        <div>
          {markets.isPending ? (
            <Loading />
          ) : markets.isError ? (
            <ErrorState retry={() => void markets.refetch()} />
          ) : coin ? (
            <PriceChart coin={coin} coins={coins} onSelect={setAsset} />
          ) : null}
        </div>
        <div className="panel movers-panel">
          <SectionTitle title="Market movers" />
          <div className="segmented mover-tabs">
            {(['Gainers', 'Losers'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setMovers(tab)}
                aria-pressed={movers === tab}
                className={movers === tab ? 'selected' : ''}
              >
                {tab === 'Gainers' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}Top{' '}
                {tab.toLowerCase()}
              </button>
            ))}
          </div>
          <p className="movers-note">24h change · within {coins.length} tracked assets</p>
          <div className="mover-list">
            {movement.length ? (
              movement.map((c) => (
                <button className="mover-row" onClick={() => open(c.id)} key={c.id}>
                  <CoinIcon coin={c} size={32} />
                  <span className="mover-name">
                    <b>{c.name}</b>
                    <span>{c.symbol}</span>
                  </span>
                  <span className="mover-values">
                    <Change value={c.change} />
                    <span>{money(c.price)}</span>
                  </span>
                </button>
              ))
            ) : (
              <p className="muted">No {movers.toLowerCase()} in this list.</p>
            )}
          </div>
          <Link className="movers-link" to="/markets">
            Explore all markets <ArrowRight size={14} />
          </Link>
        </div>
      </div>
      <div className="watchlist-callout">
        <div className="callout-icon">
          <Star size={21} />
        </div>
        <div>
          <h3>Your favorites. A little closer.</h3>
          <p>
            {ids.length
              ? `${ids.length} assets saved. Pick up where you left off.`
              : 'Build a watchlist and keep an eye on what matters to you.'}
          </p>
        </div>
        <Link className="button secondary" to={ids.length ? '/watchlist' : '/markets'}>
          {ids.length ? 'Open watchlist' : 'Build your watchlist'}
          <ArrowRight size={15} />
        </Link>
      </div>
      <section className="table-section">
        <SectionTitle
          title="Major cryptocurrencies"
          subtitle="The big picture, one asset at a time."
          to="/markets"
          link="View all markets"
        />
        {markets.isPending ? (
          <Loading />
        ) : markets.isError ? (
          <ErrorState retry={() => void markets.refetch()} />
        ) : (
          <div className="panel">
            <CoinTable coins={coins} compact />
          </div>
        )}
      </section>
      <section className="news-preview">
        <SectionTitle
          title="Latest news"
          subtitle="Ideas and developments from across the ecosystem."
          to="/news"
          link="Explore news"
        />
        <div className="news-demo-caption">
          Demo editorial · illustrative headlines linking to educational resources
        </div>
        <div className="news-grid">
          {news.data?.data.slice(0, 3).map((a) => (
            <NewsCard article={a} key={a.id} />
          ))}
        </div>
      </section>
      <div className="overview-bottom">
        <span>
          <span className="legend-dot" />
          {markets.data?.mode === 'demo'
            ? 'Demo market snapshot · October 20, 2026'
            : markets.data?.mode === 'stale'
              ? 'Stale aggregate market data'
              : 'Cached aggregate market data'}
        </span>
        <span>Thoughtfully built for a clearer perspective.</span>
      </div>
    </>
  );
}
