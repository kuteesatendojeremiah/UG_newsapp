# Uganda News App

A news app for a Ugandan audience. Content is aggregated from Ugandan, East
African, and global RSS feeds — not authored in-house — then categorized, ranked, and
clustered automatically. No user accounts; personalization is device-local.

## Download (Android)

**[Download the Android APK](https://expo.dev/artifacts/eas/Wdd2K-rIMBHyT0IN74SjVBgaJIwVa9q_zA9oc-KHhS4.apk)**
— a standalone build of the app (Expo SDK 58) that loads its feed from the live backend.
Open the link on an Android phone, allow installs from your browser when prompted, and
open **Uganda News**. No Expo Go or dev server needed.

> This is a preview build hosted by Expo (EAS); the link may expire after a while, and
> Android will warn that it's from an unknown source because it isn't on the Play Store.

## Repo layout

```
backend/   Node.js + Express API (TypeScript), MongoDB (Atlas), RSS ingestion + jobs
mobile/    React Native app (Expo Router, SDK 58)
docs/      Architecture notes, product design, RSS source list
```

## Features

- **Feed** — cursor-paginated, personalized by chosen interests, with a Uganda/regional/
  global region boost so Ugandan coverage stays dominant even as international sources
  are mixed in. Optional `region` filter (`uganda`, `international`, or the raw
  `uganda`/`regional`/`global` values) and `category` filter, both server-side.
- **Ingestion** — RSS across Daily Monitor, NTV Uganda, Nile Post (Uganda), Nation Africa
  (regional), and BBC World, Al Jazeera, Sky Sports, TechCrunch, The Verge (global). Runs
  every 15 minutes via `node-cron`. See `CLAUDE.md` for known-stale/dead sources.
- **Categorization** — deterministic keyword scan (no ML), word-boundary matched against
  title/summary/URL path.
- **Trending** — recency-decayed click/impression rollup, computed every 5 minutes.
- **Clustering** — groups same-story coverage across outlets (Jaccard title/summary
  similarity).
- **Search** — MongoDB `$text` index over title + summary.
- **Mobile** — Home (Top/Uganda/International filter), Categories (region + category),
  Search, and a device-local Profile (saved articles, reading history, derived interests,
  dark mode, no accounts).

## Backend setup

```
cd backend
npm install
cp .env.example .env   # fill in MONGODB_URI at minimum
npm run dev             # http://localhost:4000
```

Other scripts: `npm run ingest` / `trending` / `cluster` (one-off job runs),
`npm run sync-indexes` (reconcile index option changes after a model edit),
`npm run backfill-region` (one-off migration, only needed once historically).

### Environment variables (`backend/.env`)

| Variable | Required | Notes |
|---|---|---|
| `MONGODB_URI` | Yes | Atlas connection string |
| `PORT` | No | Defaults to `4000` if unset |
| `NODE_ENV` | No | |
| `FCM_SERVER_KEY` | No | Not yet used — notifications aren't implemented yet |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | No | Not yet used — no AI provider wired in |

### API (all under `/api`, requires `x-device-id` header except `/health`)

`GET /feed`, `GET /trending`, `GET /search`, `GET /articles/:id`, `GET /categories`,
`POST /user/interests`, `POST /events/impression`, `POST /events/click`.

## Mobile setup

```
cd mobile
npm install
cp .env.example .env   # set EXPO_PUBLIC_API_BASE_URL to this machine's LAN IP
npx expo start --port 8090
```

Requires the backend running and reachable at the LAN IP in `.env` — update it if DHCP
reassigns your machine's address. See `mobile/CLAUDE.md` for the Expo SDK version pin and
other device-specific notes.

## Docs

`docs/PRODUCT_DESIGN.md`, `docs/API_DESIGN.md`, `docs/UI_STRUCTURE.md` — original design
decisions and scoping. `CLAUDE.md` — living notes on domain quirks, known issues, and
conventions discovered while building.
