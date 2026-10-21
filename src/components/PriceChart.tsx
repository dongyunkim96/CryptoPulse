import { useEffect, useRef, useState } from 'react';
import type { IChartApi, UTCTimestamp } from 'lightweight-charts';
import { useChart } from '../lib/api';
import { money, timestamp } from '../lib/format';
import { ranges } from '../domain';
import type { Coin, Range } from '../domain';
import { Change, CoinIcon, ErrorState, Loading } from './ui';
export function PriceChart({
  coin,
  coins,
  onSelect,
  compact = false,
}: {
  coin: Coin;
  coins?: Coin[];
  onSelect?: (id: string) => void;
  compact?: boolean;
}) {
  const [range, setRange] = useState<Range>(7);
  const query = useChart(coin.id, range);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current || !query.data?.data.length) return;
    let disposed = false;
    let chart: IChartApi | undefined;
    void import('lightweight-charts').then(
      ({ AreaSeries, ColorType, createChart, CrosshairMode }) => {
        if (disposed || !container.current) return;
        chart = createChart(container.current, {
          autoSize: true,
          height: container.current.clientHeight,
          layout: {
            background: { type: ColorType.Solid, color: 'transparent' },
            textColor: '#727b83',
            fontFamily: 'Inter Variable, sans-serif',
            fontSize: 11,
            attributionLogo: true,
          },
          grid: { vertLines: { visible: false }, horzLines: { color: '#252a2e', style: 2 } },
          crosshair: {
            mode: CrosshairMode.Normal,
            vertLine: { color: '#7f998c', labelBackgroundColor: '#33473b' },
            horzLine: { color: '#7f998c', labelBackgroundColor: '#33473b' },
          },
          rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.12, bottom: 0.12 } },
          timeScale: { borderVisible: false, timeVisible: range === 1, secondsVisible: false },
          handleScroll: false,
          handleScale: false,
        });
        const series = chart.addSeries(AreaSeries, {
          lineColor: '#a4eeb3',
          topColor: 'rgba(164,238,179,0.17)',
          bottomColor: 'rgba(164,238,179,0)',
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerRadius: 4,
          priceFormat: {
            type: 'price',
            precision: (coin.price ?? 1) < 0.01 ? 8 : 2,
            minMove: (coin.price ?? 1) < 0.01 ? 0.00000001 : 0.01,
          },
        });
        series.setData(
          query.data!.data.map(([time, value]) => ({
            time: Math.floor(time / 1000) as UTCTimestamp,
            value,
          })),
        );
        chart.timeScale().fitContent();
      },
    );
    return () => {
      disposed = true;
      chart?.remove();
    };
  }, [query.data, range, compact, coin.price]);
  const values = query.data?.data.map((p) => p[1]);
  const low = values?.length ? Math.min(...values) : null,
    high = values?.length ? Math.max(...values) : null;
  return (
    <section
      className={`panel price-panel ${compact ? 'compact-chart' : ''}`}
      aria-label={`${coin.name} price history`}
    >
      <div className="chart-heading">
        <div className="chart-asset">
          <CoinIcon coin={coin} size={38} />
          <div>
            {coins && onSelect ? (
              <label className="asset-select">
                <span className="sr-only">Chart asset</span>
                <select value={coin.id} onChange={(e) => onSelect(e.target.value)}>
                  {coins.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.symbol})
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <h3>
                {coin.name} <span className="muted">{coin.symbol}</span>
              </h3>
            )}
            <span className="eyebrow-small">
              {query.data?.mode === 'demo' ? 'Illustrative price history' : 'CoinGecko aggregate'} ·
              USD
            </span>
          </div>
        </div>
        <span className="subtle-badge">
          {query.data?.mode === 'demo'
            ? 'Demo data'
            : query.data?.mode === 'stale'
              ? 'Stale data'
              : 'Cached data'}
        </span>
      </div>
      <div className="chart-price-row">
        <div>
          <span className="chart-price">{money(coin.price)}</span>
          <Change value={coin.change} />
          <span className="muted small">24h</span>
        </div>
        <div className="segmented ranges" aria-label="Chart time range">
          {ranges.map((r) => (
            <button
              key={r}
              aria-pressed={r === range}
              className={r === range ? 'selected' : ''}
              onClick={() => setRange(r)}
            >
              {r === 365 ? '1Y' : `${r}D`}
            </button>
          ))}
        </div>
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState retry={() => void query.refetch()} />
      ) : !values?.length ? (
        <div className="loading-state">Historical prices unavailable.</div>
      ) : (
        <div
          ref={container}
          className="chart-canvas"
          role="img"
          aria-label={`${coin.name}, ${range} day illustrative ${query.data?.mode === 'demo' ? 'demo' : 'aggregate'} price chart. Range ${money(low)} to ${money(high)}.`}
        />
      )}
      <div className="chart-bottom">
        <span>
          <span className="legend-dot" />
          {query.data?.mode === 'demo' ? 'Demo fixture' : 'CoinGecko'}{' '}
          <span className="hide-mobile">· {timestamp(query.data?.fetchedAt ?? null)}</span>
        </span>
        <span>
          Range low <b>{money(low)}</b>
          <span className="chart-high">
            Range high <b>{money(high)}</b>
          </span>
        </span>
      </div>
      {query.data?.note && query.data.mode === 'stale' ? (
        <p className="inline-note">{query.data.note}</p>
      ) : null}
    </section>
  );
}
