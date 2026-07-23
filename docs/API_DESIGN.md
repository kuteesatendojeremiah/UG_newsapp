# API Design: Uganda News App

## Principles

- Stateless — identity travels on every request, server holds no session.
- Plain REST, no GraphQL for MVP.
- Fast, small responses — users are on low-data Android connections.
- Cursor-based pagination, not page numbers.
- One consistent response envelope across every endpoint.

## Identity: `x-device-id` header

Every request carries `x-device-id: <uuid>` as a header. No query param, no body
duplication — one transport, one code path.

- Frontend generates the UUID once on first launch, stores it in SecureStore/AsyncStorage,
  attaches it to every request.
- Backend enforces it via middleware:
  ```js
  app.use((req, res, next) => {
    const deviceId = req.headers["x-device-id"];
    if (!deviceId) return res.status(400).json({ data: null, meta: {}, error: { code: "MISSING_DEVICE_ID", message: "x-device-id header is required" } });
    req.deviceId = deviceId;
    next();
  });
  ```
- Treat `device_id` as weak identity — fine for personalization/tracking/dedup, not for
  anything sensitive. No auth in MVP (see `PRODUCT_DESIGN.md`).
- Optional future headers for debugging/analytics: `x-app-version`, `x-platform`.

## Response envelope (every endpoint, no exceptions)

```jsonc
// Success
{ "data": { /* payload */ }, "meta": { /* pagination, counts, etc */ }, "error": null }

// Failure
{ "data": null, "meta": {}, "error": { "code": "ARTICLE_NOT_FOUND", "message": "..." } }
```

Pair with real HTTP status codes — the envelope doesn't replace them:
200 success, 201 created, 400 bad request, 404 not found, 500 server error.
Frontend logic is always the same: `if (response.error) showError(); else render(response.data);`

## Endpoints

### `GET /categories`
Backend is the source of truth for the controlled vocabulary (lets categories evolve —
add "Health", rename "Tech" — without an app release).

This endpoint serves the topic vocabulary only (what onboarding/edit-interests let a user
pick). `tags` (currently just "local") is assigned during ingestion normalization, isn't
user-selectable, and has no endpoint of its own in MVP.

Response:
```jsonc
{ "data": { "categories": [
  { "id": "politics", "label": "Politics" },
  { "id": "business", "label": "Business" },
  { "id": "sports", "label": "Sports" },
  { "id": "entertainment", "label": "Entertainment" },
  { "id": "technology", "label": "Technology" },
  { "id": "health", "label": "Health" },
  { "id": "crime", "label": "Crime" },
  { "id": "weather", "label": "Weather" }
] }, "meta": {}, "error": null }
```
Frontend: fetch once on first launch, cache locally, revalidate ~daily. If the call fails,
fall back to a minimal baked-in list so onboarding never breaks offline.

### `POST /user/interests`
Used for both onboarding and editing interests later.

Request: `{ "interests": ["sports", "politics"] }` (device_id comes from the header, not the body)
Response: `{ "data": { "success": true }, "meta": {}, "error": null }`

### `GET /feed?limit=20&cursor=abc123`
Personalized home feed.

- Candidate set: articles where `categories INTERSECT user.interests ≠ empty`, **plus** some
  general/trending articles even for non-matches — never filter down to *only* interest
  matches, to avoid an echo-chamber feed.
- Ranking: `final_score = trending_score * (1 + 0.2 * overlap_count)`, where `overlap_count`
  is the number of categories shared between the article and the user's interests.
  Capped in practice around 1.4x (2-category overlap max, per the category cap in
  `PRODUCT_DESIGN.md`) — this is a light nudge, not a re-ranking engine.
- Trending score itself never depends on the user — personalization is a boost on top, not
  baked into trending.

Response:
```jsonc
{ "data": { "articles": [ { "id": "a1", "title": "...", "summary": "...", "image_url": "...",
  "source": "Daily Monitor", "categories": ["politics", "sports"], "primary_category": "politics",
  "published_at": "2026-07-22T10:00:00Z", "url": "https://..." } ] },
  "meta": { "next_cursor": "2026-07-22T09:45:00Z", "has_more": true }, "error": null }
```

**Pagination/ranking interaction (important):** the cursor is `published_at` of the last item
returned — stable and monotonic, safe to paginate on. `trending_score` changes every 5 minutes
(cron rollup) and the personalization boost is computed per-request, so neither can be the
cursor itself — a score-based cursor would skip or repeat articles as scores shift between
page loads. Instead: each page query fetches a bounded window of recent articles filtered by
`published_at < cursor`, then the boost (`final_score = trending_score * (1 + 0.2 *
overlap_count)`) is applied to **re-sort only that page**, not the full paginated sequence.
This keeps personalization a lightweight per-page nudge rather than a global re-ranking that
pagination would have to account for.

### `GET /trending?limit=10`
Purely trending, no personalization — same article shape as `/feed`, no interest filtering
or boosting applied.

### `GET /articles/:id`
Single article detail, same shape as a feed item (summary only — MVP doesn't host/serve
full article content, see "content strategy" in `PRODUCT_DESIGN.md`).

### `POST /events/impression`
Called when an article actually renders on screen (not just fetched into a list).
Request: `{ "article_id": "a1" }` → `{ "data": { "success": true }, "meta": {}, "error": null }`

### `POST /events/click`
Called when a user taps into an article. Backend dedups: at most one counted click per
`device_id` + `article_id` per 24h — repeat calls succeed but don't double-count.
Request: `{ "article_id": "a1" }` → `{ "data": { "success": true }, "meta": {}, "error": null }`

### `GET /search?q=uganda+football&limit=20&cursor=...` (MVP+, optional)
Same response shape as `/feed`, no ranking boost — plain relevance/recency.

## Indexes (Mongo)

- `Article.published_at` (desc) — feed pagination cursor
- `Article.trending_score` (desc) — trending endpoint
- `Article.categories` (multi-key) — personalized candidate filtering
- `User.device_id` (unique) — identity lookup on every request
- `ArticleEvent { device_id, article_id, timestamp }` (compound, TTL ~48h) — makes the
  click-dedup check and the cron rollup query cheap; the TTL is what keeps this collection
  from growing unbounded, since `Article.clicks/impressions` are the durable rollup, not this
  ledger.

## Backend responsibilities

- Merge and normalize RSS feeds (+ Cheerio scraping fallback).
- Assign 1–2 categories per article from the fixed topic vocabulary, set `primary_category`, and apply any applicable tags (currently just "local").
- Maintain `ArticleEvent` ledger, roll up into `Article.clicks/impressions/trending_score`
  on a cron cycle (see `PRODUCT_DESIGN.md` for the scoring formula).
- Enforce `x-device-id` on every request; envelope every response the same way.
- Serve `/categories` with a stable, cacheable payload.

## Frontend responsibilities

- Generate and persist `device_id` once; attach it as `x-device-id` on every request.
- Fetch/cache `/categories` with a hardcoded fallback list.
- Render feeds, fire `/events/impression` on actual render and `/events/click` on tap.
- Handle the envelope uniformly — never assume a payload shape without checking `error` first.
