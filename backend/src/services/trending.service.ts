import Article from "../models/Article";
import { decodeTrendingCursor, encodeTrendingCursor } from "../utils/cursor";
import { serializeArticle, PublicArticle } from "../utils/serializeArticle";

interface TrendingParams {
  cursor?: string;
  limit: number;
}

interface TrendingResult {
  articles: PublicArticle[];
  next_cursor: string | null;
  has_more: boolean;
}

// Deliberately separate from feed.service.ts — no personalization, no interest boost.
// Ranking is purely trending_score (which already bakes in recency decay via the cron
// rollup formula in PRODUCT_DESIGN.md), tiebroken by published_at then _id.
export async function getTrending({ cursor, limit }: TrendingParams): Promise<TrendingResult> {
  const query: Record<string, unknown> = {};

  if (cursor) {
    const decoded = decodeTrendingCursor(cursor);
    if (decoded) {
      query.$or = [
        { trending_score: { $lt: decoded.score } },
        { trending_score: decoded.score, published_at: { $lt: decoded.publishedAt } },
        { trending_score: decoded.score, published_at: decoded.publishedAt, _id: { $lt: decoded.id } },
      ];
    }
  }

  const candidates = await Article.find(query)
    .sort({ trending_score: -1, published_at: -1, _id: -1 })
    .limit(limit + 1);

  const hasMore = candidates.length > limit;
  const page = candidates.slice(0, limit);

  const last = page[page.length - 1];
  const nextCursor = hasMore && last
    ? encodeTrendingCursor(last.trending_score, last.published_at, last._id)
    : null;

  return {
    articles: page.map(serializeArticle),
    next_cursor: nextCursor,
    has_more: hasMore,
  };
}
