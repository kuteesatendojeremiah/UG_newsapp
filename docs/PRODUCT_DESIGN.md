# Product Design: Uganda News App

## Product goal

Mobile-first Ugandan news app that:
- Aggregates trusted local news (New Vision, Daily Monitor, NTV, Nile Post, etc.)
- Feels modern, CNN-like
- Personalizes content based on selected interests, no ML in MVP
- Works well on low data / slower networks

## Target user

18–40, urban + semi-urban Uganda, mid-range Android, already on WhatsApp/Twitter/TikTok.
Doesn't visit multiple news sites directly. Wants fast, relevant updates, not more news.

**Value proposition:** "All Ugandan news in one place, personalized for you."

## MVP feature scope

1. **Onboarding** — user selects interests from a fixed category list. Drives personalization from day one.
2. **Home feed** — personalized articles (selected categories) + trending in Uganda, infinite scroll.
3. **Article view** — title, image, summary, source, "Read full article" → redirects out to the original source. No full-article hosting/republishing in MVP (avoids copyright/legal exposure, keeps source traffic/ad revenue with the outlet).
4. **Source aggregation** — backend pulls RSS from New Vision, Daily Monitor, NTV Uganda, Nile Post (+ Cheerio scraping fallback for sources without usable feeds).
5. **Search** (MVP+, optional) — keyword search over articles.
6. **Trending section** — "what's hot in Uganda right now," backend-ranked (see Trending below).
7. **Edit interests** — Profile screen, same category grid as onboarding, re-savable anytime. In MVP: personalization is the core value prop, so users must be able to fix a bad onboarding choice or shift interests over time.

## User flows

**First-time:** Open app → splash → onboarding ("select your interests") → home feed → scroll → tap article → read (redirect).

**Returning:** Open app → home feed loads instantly (already-known interests) → scroll → open articles.

**Edit interests:** Profile icon → "Your Interests" screen (same grid as onboarding) → toggle → Save → feed refetches immediately.

## UX structure

- **Home:** Top Stories (hero) → personalized feed → Trending in Uganda.
- **Bottom nav:** Home / Categories / Search / Profile.
- **Article screen:** large image, title, source + time, summary/content, "Read full story" (redirect).
- **Onboarding:** grid of categories, tap to select, Continue.
- **Profile:** "Your Interests" grid (edit + save) — the only Profile content in MVP, nothing else.

## Data models

```jsonc
// Article
{
  "id": "string",
  "title": "string",
  "summary": "string",
  "image_url": "string | null",   // RSS entries often lack an image — client falls back to a placeholder
  "source": "New Vision",
  "categories": ["politics", "sports"],   // controlled topic vocabulary, max 2 per article
  "primary_category": "politics",         // for UI grouping / tie-breaking
  "tags": ["local"],                      // context/relevance dimension, separate from topic — see below
  "published_at": "datetime",
  "url": "original article link",         // loaded in an in-app WebView, never scraped/stored — see "Content strategy"
  "clicks": 0,
  "impressions": 0,
  "trending_score": 0.0,
  "metrics_updated_at": "datetime"
}

// No `content` field, by design — MVP never stores or serves full article text
// (see "Content strategy" below). Full-text ingestion is a legal/licensing decision,
// not a technical one, and is explicitly out of scope until publisher agreements exist.

// Controlled topic vocabulary (fixed enum, do not let users/sources free-tag) — this is
// what onboarding/edit-interests select from, and what personalization matching uses.
["politics", "business", "sports", "entertainment", "technology", "health", "crime", "weather"]

// Tags: a separate, context/location dimension — not a topic, not user-selectable, not
// part of personalization matching in MVP. "local" is the only tag defined right now
// (assigned during ingestion normalization for Uganda-specific stories). Reserved for
// future use (e.g. a "local news" filter) without overloading the topic vocabulary.
["local"]

// User (anonymous — no auth/signup in MVP)
{
  "device_id": "uuid",          // generated on first launch, stored in SecureStore/AsyncStorage, sent with every request
  "interests": ["sports", "politics"],
  "created_at": "datetime",
  "last_seen": "datetime",      // touched on every request — activity/retention signal
  "updated_at": "datetime"      // touched only when interests/profile actually change
}

// ArticleEvent — rolling ledger that powers trending + click dedup, not a permanent log
{
  "article_id": "string",
  "device_id": "uuid",
  "type": "impression | click",
  "timestamp": "datetime"
  // TTL index on timestamp, expire ~48h. Article.clicks/impressions are the durable rollup.
}
```

## Personalization query logic

Personalized feed: `article.categories INTERSECT user.interests ≠ empty`.

Optional ranking boost for multi-interest matches:
```
match_score = number of overlapping categories between article and user
final_score = trending_score * (1 + 0.2 * match_score)
```

## Trending

Backend owns ranking; Firebase Analytics is for dashboards/insights only (DAU, retention,
funnels), never for ranking logic — it's too delayed and not query-friendly for per-article scoring.

- **MVP formula:** `score = clicks / (hours_since_publish + 2)`
- **Upgrade path (once impressions are solid):** `score = (clicks + 1) / (impressions + 10) * (1 / (hours_since_publish + 2))` — avoids divide-by-zero, favors engagement, boosts freshness, prevents old articles dominating forever.
- Recomputed periodically (cron, ~every 5 min) from `ArticleEvent`, rolled into `Article.clicks/impressions/trending_score`.
- **Dedup rule:** count at most 1 click per `device_id` + `article_id` per 24h. Impressions only counted when the article actually renders on screen, not just fetched.
- Trending is scored **per article, not per category** — categories are filters/boosts on top, never a second scoring axis (avoids double-counting).

## Identity strategy

Fully anonymous for MVP. `device_id` (UUID) generated on first launch, stored locally, sent
with every API call. No login, no password, no signup friction — critical for a market where
data cost and patience are both constrained.

**Upgrade path (not now):** add optional account linking only when a feature actually needs
it (cross-device sync, bookmarks, comments): `{ user_id, device_ids: ["uuid1", "uuid2"] }`,
layered on top without breaking the device_id-only model.

## Product decisions (guardrails)

- Categories: array, max 2 per article, drawn only from the fixed topic enum above. No user-defined tags, no unlimited tagging. `tags` (e.g. "local") is a separate field, not counted against the 2-category cap, not used in personalization matching for MVP.
- Content: summary + in-app WebView only — never scrape, store, or republish full source article text in MVP. This is a legal boundary (copyright exposure on named commercial outlets), not just a scope choice — revisit only if publisher licensing agreements are in place. WebView loads `article.url` directly, framing the source's own page rather than copying its content.
- Offline: cache last 20 articles (post-MVP).
- Monetization: Google AdMob + sponsored stories (post-MVP, not a launch concern).
- No ML-based personalization in MVP — interest-tag matching only.
