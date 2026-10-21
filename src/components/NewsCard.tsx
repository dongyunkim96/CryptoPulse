import { ArrowUpRight } from 'lucide-react';
import type { Article } from '../domain';
export function ArticleArt({ type }: { type: Article['art'] }) {
  return (
    <div className={`article-art art-${type}`} aria-hidden="true">
      <div className="art-grid" />
      {type === 'bitcoin' ? (
        <>
          <div className="bitcoin-orbit orbit-one" />
          <div className="bitcoin-orbit orbit-two" />
          <span className="art-coin">₿</span>
          <span className="art-coordinate">21,000,000</span>
        </>
      ) : type === 'ethereum' ? (
        <>
          <span className="eth-diamond">♦</span>
          <span className="art-coordinate">THE NEXT LAYER</span>
        </>
      ) : type === 'network' ? (
        <>
          <div className="network-ring ring-one" />
          <div className="network-ring ring-two" />
          <div className="network-ring ring-three" />
          <span className="art-coordinate">CONNECTED BY DESIGN</span>
        </>
      ) : (
        <>
          <div className="art-bars">
            {[25, 40, 35, 58, 50, 70, 64, 85, 78, 96].map((n, i) => (
              <span key={i} style={{ height: `${n}%` }} />
            ))}
          </div>
          <span className="art-coordinate">A WIDER PERSPECTIVE</span>
        </>
      )}
    </div>
  );
}
export function NewsCard({
  article,
  lead = false,
  small = false,
}: {
  article: Article;
  lead?: boolean;
  small?: boolean;
}) {
  return (
    <a
      className={`news-card ${lead ? 'lead-story' : ''} ${small ? 'small-story' : ''}`}
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      <ArticleArt type={article.art} />
      <div className="story-body">
        <div className="story-meta">
          <span>{article.topic}</span>
          <span>Demo editorial</span>
        </div>
        <h3>
          {article.title}
          <ArrowUpRight size={18} />
        </h3>
        {lead ? (
          <p>
            An illustrative editorial layout. Explore the original educational resource for more
            context.
          </p>
        ) : null}
        <div className="story-source">
          <span>{article.source}</span>
          <time dateTime={article.publishedAt}>
            {new Date(article.publishedAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}
          </time>
        </div>
      </div>
    </a>
  );
}
