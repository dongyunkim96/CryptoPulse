import { useState } from 'react';
import { Link } from 'react-router';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowRight, Plus, Star, Trash2, X } from 'lucide-react';
import { useMarkets } from '../lib/api';
import { useWatchlist } from '../state/watchlist';
import { CoinTable } from '../components/CoinTable';
import { Empty, ErrorState, Loading } from '../components/ui';
export function Watchlist() {
  const query = useMarkets();
  const ids = useWatchlist((s) => s.ids);
  const clear = useWatchlist((s) => s.clear);
  const [confirm, setConfirm] = useState(false);
  const coins = query.data?.data ?? [];
  const saved = coins.filter((c) => ids.includes(c.id));
  const outdated = ids.filter((id) => !coins.some((c) => c.id === id));
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="overline">
            <span className="mint-dash" />
            YOUR PERSONAL MARKET VIEW
          </div>
          <h1>
            Keep your favorites close<span className="mint">.</span>
          </h1>
          <p>Your assets to follow. No account needed.</p>
        </div>
        <Link className="button" to="/markets">
          <Plus size={16} />
          Add assets
        </Link>
      </div>
      <div className="watchlist-title">
        <span>
          <Star size={18} className="mint" />
          <b>My watchlist</b>
          <span className="count-tag">{ids.length}</span>
        </span>
        {ids.length ? (
          <Dialog.Root open={confirm} onOpenChange={setConfirm}>
            <Dialog.Trigger asChild>
              <button className="muted-button">
                <Trash2 size={14} />
                Clear watchlist
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="modal-overlay" />
              <Dialog.Content className="confirm-dialog">
                <Dialog.Title>Clear your watchlist?</Dialog.Title>
                <Dialog.Description>
                  This removes all {ids.length} saved assets from this browser. You can add them
                  again at any time.
                </Dialog.Description>
                <div className="confirm-actions">
                  <Dialog.Close asChild>
                    <button className="button secondary">Keep my assets</button>
                  </Dialog.Close>
                  <button
                    className="button danger"
                    onClick={() => {
                      clear();
                      setConfirm(false);
                    }}
                  >
                    Clear watchlist
                  </button>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        ) : null}
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState retry={() => void query.refetch()} />
      ) : ids.length ? (
        <>
          <div className="panel">
            <CoinTable coins={coins} watchlist />
          </div>
          {outdated.length ? (
            <div className="outdated-assets">
              <p>{outdated.length} saved asset(s) are outside the current tracked universe.</p>
              {outdated.map((id) => (
                <button
                  className="button secondary"
                  key={id}
                  onClick={() => useWatchlist.getState().toggle(id)}
                >
                  Remove {id}
                  <X size={13} />
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : (
        <div className="panel watchlist-empty">
          <div className="empty-orbit" aria-hidden="true">
            <span>₿</span>
            <span>♦</span>
            <span>≋</span>
          </div>
          <Empty icon={<Star size={29} />} title="A space for your kind of crypto">
            The market moves fast. Keep the assets you care about in one place—just tap the star
            next to any coin.
            <Link className="button" to="/markets">
              Discover the markets <ArrowRight size={16} />
            </Link>
          </Empty>
        </div>
      )}
      {saved.length ? (
        <div className="watchlist-tip">
          <Star size={16} />
          <p>
            Your watchlist is saved on this device. Use the star on any asset to add or remove it.
          </p>
        </div>
      ) : null}
    </>
  );
}
