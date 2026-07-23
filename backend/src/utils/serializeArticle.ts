import { ArticleDocument } from "../models/Article";

// Public shape only — never exposes clicks/impressions/trending_score (internal ranking
// inputs) or a `content` field (MVP never stores full article text, see PRODUCT_DESIGN.md).
export interface PublicArticle {
  id: string;
  title: string;
  summary: string;
  image_url: string | null;
  source: string;
  url: string;
  categories: string[];
  primary_category: string;
  tags: string[];
  region: string;
  published_at: string;
}

export function serializeArticle(article: ArticleDocument): PublicArticle {
  return {
    id: article._id.toString(),
    title: article.title,
    summary: article.summary,
    image_url: article.image_url ?? null,
    source: article.source,
    url: article.url,
    categories: article.categories,
    primary_category: article.primary_category,
    tags: article.tags,
    region: article.region,
    published_at: article.published_at.toISOString(),
  };
}
