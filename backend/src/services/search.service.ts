import Article from "../models/Article";
import { decodeCursor, encodeCursor } from "../utils/cursor";
import { serializeArticle, PublicArticle } from "../utils/serializeArticle";

interface SearchParams {
  q: string;
  cursor?: string;
  limit: number;
}

interface SearchResult {
  articles: PublicArticle[];
  next_cursor: string | null;
  has_more: boolean;
}

// Sorted by recency, not $text relevance score — keeps search on the exact same
// (published_at, _id) cursor scheme every other list endpoint uses (feed.service.ts,
// trending.service.ts), rather than introducing a second, incompatible pagination style
// just for this one endpoint.
export async function getSearchResults({ q, cursor, limit }: SearchParams): Promise<SearchResult> {
  const query: Record<string, unknown> = { $text: { $search: q } };

  if (cursor) {
    const decoded = decodeCursor(cursor);
    if (decoded) {
      query.$or = [
        { published_at: { $lt: decoded.publishedAt } },
        { published_at: decoded.publishedAt, _id: { $lt: decoded.id } },
      ];
    }
  }

  const candidates = await Article.find(query)
    .sort({ published_at: -1, _id: -1 })
    .limit(limit + 1);

  const hasMore = candidates.length > limit;
  const page = candidates.slice(0, limit);

  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.published_at, last._id) : null;

  return {
    articles: page.map(serializeArticle),
    next_cursor: nextCursor,
    has_more: hasMore,
  };
}
