# Uganda News App

A CNN-style news app for a Ugandan audience. Content is aggregated from Ugandan
news outlets' RSS feeds (with scraping as a fallback), not authored in-house.

## Repo layout (monorepo)

- `/backend` — Node.js + Express API, TypeScript. Ingests RSS, stores/serves articles.
- `/mobile` — React Native app (Android-first). Will be scaffolded via the RN CLI, not by hand.
- `/docs` — architecture notes, RSS source list, etc.

## Tech stack

- **Frontend:** React Native (Android-first)
- **Backend:** Node.js + Express, TypeScript
- **Database:** MongoDB (Atlas)
- **Background jobs:** node-cron — runs RSS ingestion + processing on a schedule
- **Ingestion:** RSS feeds primarily; Cheerio for scraping when a source has no usable feed
- **Hosting:** Render / Railway / DigitalOcean (undecided which yet)
- **Notifications:** Firebase Cloud Messaging
- **Analytics:** Firebase Analytics
- **Optional AI:** OpenAI or Claude API (not committed to a provider yet)

**Architecture:** monolithic backend, REST API. The mobile client consumes the API.
Background workers handle RSS ingestion and article clustering separately from
request handling.

## Conventions

TODO — fill in once real code exists (folder naming inside `src/`, lint/test/build
commands, commit style, etc.). Run `/init` after the backend has real code to let
Claude Code scan it and refresh this section.

## Domain notes

- RSS source list: `backend/src/config/sources.ts`. Currently 3 Uganda outlets — Daily
  Monitor, NTV Uganda, Nile Post — plus, as of 2026-07-23, region-tagged regional/global
  sources added to fix the sports/tech/world coverage gap: Nation Africa (regional), and
  BBC World, Al Jazeera, Sky Sports, TechCrunch, The Verge (global). New Vision has no
  discoverable RSS feed (Nuxt.js SPA, no feed link anywhere) and needs a dedicated Cheerio
  scraper against their actual page markup — not yet built, tracked as a follow-up. Also
  rejected on 2026-07-23 after live verification: The Citizen/Tanzania (404), Reuters World
  (feeds.reuters.com no longer resolves), ESPN (connection reset even with the same browser
  User-Agent every other source accepts) — worth periodically re-checking for a working URL.
- **`Article.region` field** (`"uganda" | "regional" | "global"`, `constants/regions.ts`):
  set per-source in `sources.ts`, not derived from content — categorization still stays
  exclusively `categorize.ts`'s per-article keyword scan, deliberately not forked per source.
  `GET /api/feed` accepts an optional `?region=` filter; the unfiltered feed instead boosts
  Uganda content in `feed.service.ts`'s existing personalization-score step (uganda +50%,
  regional +20%, global +0%) to keep the "Top" feed Uganda-led without hard-quota'ing it.
- **Feed date-parsing gap (fixed 2026-07-23):** `ingestRss.ts` couldn't parse RFC-822 dates
  using a named timezone abbreviation instead of a numeric offset (Sky Sports emits e.g.
  "...21:30:00 BST") — neither JS's `Date` constructor nor rss-parser's own `isoDate`
  normalization handles it, producing `Invalid Date`, which Mongoose then silently rejected
  per-document inside the bulk write (no thrown error — it just showed up as a same-as-
  everything-else "skipped" count, easy to mistake for normal dedup). Now retried with the
  abbreviation swapped for a numeric offset before giving up. If a newly added source shows
  suspiciously 100% `skipped` on its very first ingest ever (no prior data to dedupe against),
  check this before assuming the source itself is bad.
- **Daily Monitor and NTV Uganda feeds have gone stale (as of 2026-07-23):** both feeds
  fetch and parse fine (no error), but their newest items are ~3-4 weeks old — everything
  gets filtered out by ingestRss.ts's 48h freshness cutoff, so only Nile Post is actually
  landing articles right now. Confirmed this is outlet-side, not a feed-URL or ingestion
  bug: NTV's own article page (`article:published_time` meta tag) shows the same ~4-week-old
  date as its feed, so the live site isn't ahead of the feed either. Building a Cheerio
  scraper for either outlet won't help until they resume publishing — there's no fresher
  content to scrape. Recheck monitor.co.ug / ntv.co.ug periodically for signs of life
  before investing more ingestion work here.
- Ingestion cadence: every 15 minutes, via `node-cron` in `backend/src/jobs/scheduler.ts`.
- Category assignment: deterministic keyword scan (`backend/src/services/categorize.ts`),
  no ML — matches title/summary/URL-path text against a fixed keyword list per category,
  capped at 2 categories, defaults to "politics" when nothing matches. Verified against real
  ingested data; skews toward politics (~57% of ingested articles), partly genuine Ugandan-
  news content skew and partly classifier limitation — worth revisiting with real usage data.
  **Matching is word-boundary (`\bkeyword\b`), not substring** (fixed 2026-07-23) — plain
  `.includes()` let short keywords match inside unrelated words (`"rain"` inside "t**rain**ed",
  "Uk**rain**e"; also would've affected `"cup"` inside e.g. "occu**p**y"-style words). Found via
  a live boxing article wrongly tagged "weather"; fixing it reclassified 16 of 21 articles that
  had "weather" in their `categories` at the time. Trade-off: exact-word matching means plain
  inflected forms (e.g. "storms", "MPs") no longer match "storm"/"mp" — no stemming is done,
  so recall on inflected forms is intentionally sacrificed for precision. Revisit if that
  turns out to matter in practice.
- Article clustering (grouping similar stories from multiple outlets, CNN-style): implemented
  in `backend/src/jobs/clusterArticles.ts` — Jaccard word-overlap similarity on title+summary
  (`services/clustering.ts`, no ML/embeddings dependency), writes `Article.cluster_id`,
  watermarked via `JobState` like the trending job, chained after each ingest run in
  `scheduler.ts` (`npm run cluster` for a manual one-off run). Not yet surfaced in the feed
  API or mobile UI. Cross-outlet matches will stay rare until Daily Monitor/NTV resume
  publishing (see the RSS staleness note above) — verified working correctly against live
  data, just starved of multi-source input right now.

## Things not to do

- Don't commit `.env` or any real API keys/secrets — use `.env.example` for names only.
- Don't add a new framework, database, or major dependency without discussing it first.
- Don't scaffold `/mobile` by hand — use the React Native CLI when that step comes.
