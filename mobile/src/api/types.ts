// Mirrors backend/src/utils/serializeArticle.ts exactly — no `content` field by design
// (see PRODUCT_DESIGN.md: summary + in-app WebView only, never full article text).
export interface Article {
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

export interface Category {
  id: string;
  label: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
}
