import { apiRequest } from './client';
import { Article, Category } from './types';

export interface FeedPage {
  articles: Article[];
  next_cursor: string | null;
  has_more: boolean;
}

async function fetchArticlePage(
  path: string,
  cursor?: string,
  limit?: number,
  region?: string,
  category?: string
): Promise<FeedPage> {
  const { data, meta } = await apiRequest<{ articles: Article[] }>(path, {
    query: { cursor, limit, region, category },
  });
  return {
    articles: data.articles,
    next_cursor: (meta.next_cursor as string | null | undefined) ?? null,
    has_more: Boolean(meta.has_more),
  };
}

// region: 'uganda' | 'international' | undefined (all) — 'international' is a backend-side
// alias for regional+global combined, not a stored Article.region value; see feed.service.ts.
export function fetchFeed(
  cursor?: string,
  limit?: number,
  region?: string,
  category?: string
): Promise<FeedPage> {
  return fetchArticlePage('/feed', cursor, limit, region, category);
}

export function fetchTrending(cursor?: string, limit?: number): Promise<FeedPage> {
  return fetchArticlePage('/trending', cursor, limit);
}

export async function fetchSearch(q: string, cursor?: string, limit?: number): Promise<FeedPage> {
  const { data, meta } = await apiRequest<{ articles: Article[] }>('/search', {
    query: { q, cursor, limit },
  });
  return {
    articles: data.articles,
    next_cursor: (meta.next_cursor as string | null | undefined) ?? null,
    has_more: Boolean(meta.has_more),
  };
}

export async function fetchArticle(id: string): Promise<Article> {
  const { data } = await apiRequest<Article>(`/articles/${id}`);
  return data;
}

export async function fetchCategories(): Promise<{ categories: Category[]; tags: Category[] }> {
  const { data } = await apiRequest<{ categories: Category[]; tags: Category[] }>('/categories');
  return data;
}

export async function saveInterests(interests: string[]): Promise<string[]> {
  const { data } = await apiRequest<{ interests: string[] }>('/user/interests', {
    method: 'POST',
    body: { interests },
  });
  return data.interests;
}

export async function trackImpression(articleId: string): Promise<void> {
  await apiRequest('/events/impression', { method: 'POST', body: { article_id: articleId } });
}

export async function trackClick(articleId: string): Promise<void> {
  await apiRequest('/events/click', { method: 'POST', body: { article_id: articleId } });
}
