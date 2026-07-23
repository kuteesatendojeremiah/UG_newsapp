// Controlled topic vocabulary — the only values Article.categories/primary_category and
// User.interests may contain. See docs/PRODUCT_DESIGN.md for the "no free-tagging" guardrail.
export const CATEGORIES = [
  "politics",
  "business",
  "sports",
  "entertainment",
  "technology",
  "health",
  "crime",
  "weather",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  politics: "Politics",
  business: "Business",
  sports: "Sports",
  entertainment: "Entertainment",
  technology: "Technology",
  health: "Health",
  crime: "Crime",
  weather: "Weather",
};

// Tags are a separate context/relevance dimension (not a topic, not user-selectable).
// "local" is the only one defined for MVP — see docs/PRODUCT_DESIGN.md.
export const TAGS = ["local"] as const;

export type Tag = (typeof TAGS)[number];

export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}
