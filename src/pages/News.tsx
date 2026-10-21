import { useState } from 'react';
import { ArrowDown, BookOpen, Search } from 'lucide-react';
import { useNews } from '../lib/api';
import { Empty, ErrorState, Loading, SearchField } from '../components/ui';
import { NewsCard } from '../components/NewsCard';
export function News() {
  const query = useNews();
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('All stories');
  const [limit, setLimit] = useState(6);
  const articles = (query.data?.data ?? []).filter(
    (a) =>
      (topic === 'All stories' || a.topic === topic) &&
      a.title.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="overline">
            <span className="mint-dash" />
            CONTEXT BEYOND THE CHARTS
          </div>
          <h1>
            Stay ahead of the story<span className="mint">.</span>
          </h1>
          <p>Explore the ideas shaping the digital asset ecosystem.</p>
        </div>
        <span className="subtle-badge">
          <BookOpen size={14} />
          The reading room
        </span>
      </div>
      <div className="news-disclosure">
        <span className="demo-pill">Demo editorial</span>
        <p>
          Illustrative headlines, linked to original educational resources. A licensed news feed is
          not connected. These are not current news reports.
        </p>
      </div>
      <div className="news-toolbar">
        <div className="filter-tabs">
          {['All stories', 'Bitcoin', 'Ethereum', 'Markets', 'Technology'].map((t) => (
            <button
              className={t === topic ? 'active' : ''}
              aria-pressed={t === topic}
              onClick={() => {
                setTopic(t);
                setLimit(6);
              }}
              key={t}
            >
              {t}
            </button>
          ))}
        </div>
        <SearchField
          value={search}
          onChange={(v) => {
            setSearch(v);
            setLimit(6);
          }}
          label="Search headlines"
          placeholder="Search headlines…"
        />
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorState retry={() => void query.refetch()} />
      ) : articles.length ? (
        <>
          <div className="news-featured">
            <NewsCard article={articles[0]} lead />
            {articles[1] ? <NewsCard article={articles[1]} /> : null}
          </div>
          <div className="section-title">
            <h2>Latest stories</h2>
            <span className="muted small">{articles.length} demo articles</span>
          </div>
          <div className="news-grid">
            {articles.slice(2, limit).map((a) => (
              <NewsCard article={a} key={a.id} />
            ))}
          </div>
          {articles.length > limit ? (
            <div className="load-more">
              <button className="button secondary" onClick={() => setLimit((n) => n + 6)}>
                Load more stories <ArrowDown size={15} />
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <Empty icon={<Search />} title="No stories found">
          Try another headline or explore a different topic.
          <button
            className="button secondary"
            onClick={() => {
              setSearch('');
              setTopic('All stories');
            }}
          >
            Clear filters
          </button>
        </Empty>
      )}
    </>
  );
}
