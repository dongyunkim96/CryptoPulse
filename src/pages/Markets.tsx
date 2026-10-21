import { ArrowUpRight, ArrowDownRight, Layers } from 'lucide-react';
import { useMarkets } from '../lib/api';
import { CoinTable } from '../components/CoinTable';
import { ErrorState, Loading } from '../components/ui';
export function Markets() {
  const query = useMarkets();
  const coins = query.data?.data ?? [];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="overline">
            <span className="mint-dash" />
            THE CRYPTO LANDSCAPE
          </div>
          <h1>
            Explore the markets<span className="mint">.</span>
          </h1>
          <p>Compare the majors. Find your next asset to follow.</p>
        </div>
        <span className="subtle-badge">
          <Layers size={14} />
          {coins.length} tracked assets
        </span>
      </div>
      <div className="market-summary">
        <span>
          <span className="summary-icon">
            <Layers size={17} />
          </span>
          <b>{coins.length}</b> assets tracked
        </span>
        <span>
          <ArrowUpRight size={16} className="positive" />
          <b>{coins.filter((c) => (c.change ?? 0) > 0).length}</b> gaining today
        </span>
        <span>
          <ArrowDownRight size={16} className="negative" />
          <b>{coins.filter((c) => (c.change ?? 0) < 0).length}</b> declining today
        </span>
        <span className="muted">Ranked by market capitalization</span>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState retry={() => void query.refetch()} />
      ) : (
        <div className="panel">
          <CoinTable coins={coins} />
        </div>
      )}
      <p className="data-footnote">
        {query.data?.mode === 'demo'
          ? 'Illustrative demo universe. Rankings and values are fixtures.'
          : 'The 20 assets returned by CoinGecko’s market-cap-ranked endpoint. Aggregated data is cached for 15 minutes.'}{' '}
        Select any asset to explore its details.
      </p>
    </>
  );
}
