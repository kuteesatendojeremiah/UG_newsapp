import Article, { ArticleDocument } from "../models/Article";
import { Region } from "../constants/regions";
import { Category } from "../constants/categories";
import { decodeCursor, encodeCursor } from "../utils/cursor";
import { serializeArticle, PublicArticle } from "../utils/serializeArticle";

interface FeedParams {
  interests: string[];
  cursor?: string;
  limit: number;
  region?: Region | "international";
  category?: Category;
}

interface FeedResult {
  articles: PublicArticle[];
  next_cursor: string | null;
  has_more: boolean;
}

const BOOST_PER_OVERLAP = 0.2;

// Keeps the Ugandan audience's own news dominant in the unfiltered/"Top" feed even as
// regional and global sources are added — a flat multiplier here (not a hard quota) so it
// composes with the interest-overlap boost below and never breaks cursor pagination.
const REGION_BOOST: Record<Region, number> = { uganda: 0.5, regional: 0.2, global: 0 };

export async function getFeed({ interests, cursor, limit, region, category }: FeedParams): Promise<FeedResult> {
  const query: Record<string, unknown> = {};

  // "international" isn't a stored region value (Article.region stays uganda/regional/global
  // — a real per-article classification) — it's a UI-level convenience meaning "not Uganda",
  // added because users want a simple Uganda-vs-everything-else toggle, not a 3-way split.
  if (region === "international") {
    query.region = { $in: ["regional", "global"] };
  } else if (region) {
    query.region = region;
  }

  // Article.categories is an array (max 2) — Mongo's default equality match on an array
  // field already means "array contains this value", no $in/$elemMatch needed.
  if (category) {
    query.categories = category;
  }

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      query.$or = [
        { published_at: { $lt: decoded.publishedAt } },
        { published_at: decoded.publishedAt, _id: { $lt: decoded.id } },
      ];
    }
  }

  // Fetch exactly limit + 1 by recency — the "+1" only detects has_more. Every article this
  // query touches either appears on this page or is left for the next page's cursor to reach;
  // nothing is silently dropped, unlike an overfetch-then-slice approach.
  const candidates = await Article.find(query)
    .sort({ published_at: -1, _id: -1 })
    .limit(limit + 1);

  const hasMore = candidates.length > limit;
  const page = candidates.slice(0, limit);

  // Personalization boost re-orders *within this page only* — a light nudge, not a
  // re-ranking engine — and never changes which documents were fetched or the cursor.
  const ranked = [...page].sort((a, b) => finalScore(b, interests) - finalScore(a, interests));

  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.published_at, last._id) : null;

  return {
    articles: ranked.map(serializeArticle),
    next_cursor: nextCursor,
    has_more: hasMore,
  };
}

function finalScore(article: ArticleDocument, interests: string[]): number {
  const overlap = article.categories.filter((category) => interests.includes(category)).length;
  return article.trending_score * (1 + BOOST_PER_OVERLAP * overlap) * (1 + REGION_BOOST[article.region]);
}
