# UI Structure: Screen-Level Wireframes

Four MVP screens, each broken into components and the exact data each one needs — validated
against `API_DESIGN.md` so there are no surprises once backend work starts.

## 1. Feed Screen (Home)

**Components:**
- `Header` — app name/logo, Profile icon (top right, routes to Settings/Edit Interests)
- Hero treatment for the first 1–3 items returned by `/feed` ("Top Stories" — a presentation
  choice, not a separate endpoint or data source)
- `ArticleCard` (repeated, infinite scroll via `next_cursor`)
- `TrendingRail` — horizontal scroll, separate call to `/trending`, no personalization applied
- Pull-to-refresh (resets to page 1). No auto-poll/auto-refresh — battery cost isn't worth it for MVP.

**`ArticleCard` data** (from `/feed` and `/trending` responses — no gaps):
```
id, title, image_url (fallback to placeholder if null), source, published_at, categories
```

**Local-only state** (no backend involvement):
- `read_articles: string[]` cached on-device — gray out cards already tapped into. Reuses the
  same signal as click-event dedup, just kept client-side for display purposes.
- `saved_articles: string[]` — see Save-lite, below.

## 2. Article Detail Screen

**Components:**
- `HeroImage`, `Title`, `SourceMeta` (source name + relative time + category badge), `Summary`
- `ReadFullStoryButton` (primary CTA) → opens an **in-app WebView** loading `article.url`
  - WebView needs: loading indicator, back navigation (returns to Article Detail, not the feed),
    basic error handling if the source page fails to load
  - Secondary action: "Open in browser" — escape hatch for users who want full browser
    features or a site that renders badly in WebView
- `SaveButton` (bookmark icon, toggles `is_saved` locally — see below)

**Data:** matches `/articles/:id` exactly — `id, title, summary, image_url, source, categories,
primary_category, published_at, url`. No `content` field (see `PRODUCT_DESIGN.md`).

## 3. Onboarding Screen

**Components:** `CategoryGrid` (from `/categories`, multi-select tiles), `ContinueButton`

**Selection rule (soft requirement):** 2–3 popular categories are preselected by default
(e.g. Politics, Sports, Technology) so `ContinueButton` is enabled immediately — no empty
state, no forced thinking before the user can proceed. The user can deselect/customize before
continuing. `POST /user/interests` validates strictly at the API boundary — an empty or
invalid array is rejected with `400 INVALID_INTERESTS`, not silently defaulted. Silently
substituting a default would mask a real client bug (e.g. onboarding failing to preselect);
rejecting makes that bug visible immediately instead of hiding it. The client-side preselect
above is what actually prevents a user from ever hitting this error in normal use.

## 4. Settings / Edit Interests Screen

**Components:** same `CategoryGrid` as onboarding, pre-populated from the locally cached
interests (not re-fetched from the backend — see `API_DESIGN.md`, `device_id` and interests
live in the same local storage, so there's no case where they'd disagree), `SaveButton` →
`POST /user/interests` → feed refetches.

## Save-lite (bookmarks, client-side only)

- `is_saved` boolean toggle on `ArticleCard` and Article Detail.
- Persisted locally (AsyncStorage), no backend endpoint, no sync, no dedicated Saved screen
  required for MVP (a simple local-list screen is a cheap optional fast-follow, not a blocker).
- Purpose: capture save-intent as a signal now, without committing to backend schema/API
  before there's a real use for it (ranking input, "continue reading" push notifications, etc. — all post-MVP).
- Upgradeable later to `POST/GET/DELETE /user/saved` without breaking this local-first version.

## Screen → endpoint map

| Screen | Endpoint(s) |
|---|---|
| Feed | `GET /feed`, `GET /trending` |
| Article Detail | `GET /articles/:id` (or reuse the object already in memory from the feed) |
| Onboarding | `GET /categories`, `POST /user/interests` |
| Settings / Edit Interests | `POST /user/interests` (read comes from local cache, not a GET) |
