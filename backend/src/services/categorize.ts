import { CATEGORIES, Category } from "../constants/categories";

// Deterministic keyword scan — no ML, per the "no ML-based personalization in MVP" decision
// in PRODUCT_DESIGN.md. Feed-provided <category> tags vary wildly by source (or don't exist
// at all, e.g. Daily Monitor) and don't map cleanly onto our controlled vocabulary, so this
// scans title + summary + whatever category text the feed did provide, and picks the
// vocabulary terms with the most keyword hits.
const KEYWORDS: Record<Category, string[]> = {
  politics: [
    "politics", "parliament", "president", "museveni", "election", "minister",
    "government", "cabinet", "opposition", "nrm", "nup", "mp", "speaker",
  ],
  business: [
    "business", "shilling", "market", "economy", "bank", "trade", "investment",
    "tax", "stock", "export", "startup funding",
  ],
  sports: [
    "sport", "match", "goal", "football", "league", "cup", "cranes", "afcon",
    "world cup", "tournament", "player", "coach", "athlete",
  ],
  entertainment: [
    "entertainment", "movie", "music", "concert", "celebrity", "album", "artiste",
    "festival", "actor", "actress",
  ],
  technology: [
    "technology", "tech", "app", "smartphone", "internet", "software", "startup",
    "innovation", "digital",
  ],
  health: [
    "health", "hospital", "disease", "covid", "outbreak", "vaccine", "clinic",
    "doctor", "malaria", "ministry of health",
  ],
  crime: [
    "crime", "police", "arrest", "murder", "court", "robbery", "theft", "kidnap",
    "suspect", "jailed",
  ],
  weather: ["weather", "rain", "flood", "drought", "storm", "climate", "forecast"],
};

// No matches → default to politics, the most common bucket for uncategorized Ugandan
// hard news (parliament/national-affairs coverage dominates these feeds when nothing else
// matches). Article.categories requires at least 1 entry, so this can never return empty.
const DEFAULT_CATEGORY: Category = "politics";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Word-boundary matching, not plain substring — confirmed directly against real ingested
// data: a boxing article whose summary said "...trained together..." was misclassified as
// "weather" because a bare .includes("rain") matched inside "tRAINed". \b anchors stop short
// keywords (rain, cup, tax, app, mp, ...) from firing inside unrelated words. Precompiled
// once at module load rather than per categorize() call.
const KEYWORD_PATTERNS: Record<Category, RegExp[]> = Object.fromEntries(
  CATEGORIES.map((category) => [
    category,
    KEYWORDS[category].map((keyword) => new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i")),
  ])
) as Record<Category, RegExp[]>;

export function categorize(text: string): { categories: Category[]; primary: Category } {
  const scored = CATEGORIES
    .map((category) => ({
      category,
      score: KEYWORD_PATTERNS[category].filter((pattern) => pattern.test(text)).length,
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return { categories: [DEFAULT_CATEGORY], primary: DEFAULT_CATEGORY };
  }

  const top = scored.slice(0, 2).map((entry) => entry.category); // cap at 2, per the guardrail
  return { categories: top, primary: top[0] };
}
