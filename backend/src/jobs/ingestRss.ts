import Parser from "rss-parser";
import Article from "../models/Article";
import { RSS_SOURCES, RssSource } from "../config/sources";
import { categorize } from "../services/categorize";
import { fetchOgImage, firstImageInHtml, mapWithConcurrency } from "../services/articleImage";

interface CustomItem {
  mediaContent?: { $: { url?: string } }[];
  mediaGroup?: { "media:content"?: { $: { url?: string } } };
  mediaThumb?: { $: { url?: string } }[];
  contentEncoded?: string;
}

// A browser User-Agent is required — monitor.co.ug (403) and ntv.co.ug (406) both reject
// curl/bot-style default UAs, confirmed when verifying these feeds directly.
const parser = new Parser<Record<string, unknown>, CustomItem>({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  },
  // rss-parser has no default timeout — a single hanging source would otherwise block
  // the whole ingestion run (and, on the cron schedule, every run after it) indefinitely.
  timeout: 15000,
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: true }],
      ["media:group", "mediaGroup"],
      ["media:thumbnail", "mediaThumb", { keepArray: true }], // BBC
      ["content:encoded", "contentEncoded"],
    ],
  },
});

// Some feeds (Sky Sports, confirmed directly) emit RFC-822 dates with a named timezone
// abbreviation ("...21:30:00 BST") that JS's Date constructor can't parse in this runtime —
// it comes back Invalid Date, and rss-parser's own isoDate normalization fails identically,
// so this can't be delegated upstream. Retrying with the abbreviation swapped for a numeric
// offset fixes the common cases; genuinely unparseable dates still return null.
const TZ_ABBREVIATION_OFFSETS: Record<string, string> = {
  UT: "+0000", GMT: "+0000", UTC: "+0000",
  BST: "+0100", CET: "+0100", CEST: "+0200",
  EST: "-0500", EDT: "-0400",
  CST: "-0600", CDT: "-0500",
  MST: "-0700", MDT: "-0600",
  PST: "-0800", PDT: "-0700",
};

function parseFeedDate(raw?: string): Date | null {
  if (!raw) return null;

  const direct = new Date(raw);
  if (!isNaN(direct.getTime())) return direct;

  const withOffset = raw.replace(
    /\s([A-Z]{2,5})$/,
    (match, abbr) => (TZ_ABBREVIATION_OFFSETS[abbr] ? ` ${TZ_ABBREVIATION_OFFSETS[abbr]}` : match)
  );
  const retried = new Date(withOffset);
  return isNaN(retried.getTime()) ? null : retried;
}

function extractImage(item: Parser.Item & CustomItem): string | null {
  if (item.enclosure?.url) return item.enclosure.url;

  if (Array.isArray(item.mediaContent) && item.mediaContent.length > 0) {
    const url = item.mediaContent[0]?.$?.url;
    if (url) return url;
  }

  // Daily Monitor nests its image one level deeper, under <media:group>.
  const groupUrl = item.mediaGroup?.["media:content"]?.$?.url;
  if (groupUrl) return groupUrl;

  // BBC puts its image in <media:thumbnail>.
  const thumbUrl = item.mediaThumb?.[0]?.$?.url;
  if (thumbUrl) return thumbUrl;

  // The Verge (Atom) only embeds the image as an <img> inside the entry body.
  return firstImageInHtml(item.contentEncoded) ?? firstImageInHtml(item.content);
}

// How many article pages to fetch at once when falling back to og:image.
const OG_FETCH_CONCURRENCY = 4;

interface IngestResult {
  source: string;
  inserted: number;
  skipped: number;
  failed: boolean;
}

// Guards against feeds that resurface old backfill items on a normal poll — this app only
// ever shows recent news, so there's no reason to write something that's already stale on
// arrival (it would just sit there until the Article TTL catches up).
const MAX_ARTICLE_AGE_MS = 1000 * 60 * 60 * 48; // 48 hours

async function ingestSource(source: RssSource): Promise<IngestResult> {
  let feed;
  try {
    feed = await parser.parseURL(source.feedUrl);
  } catch (err) {
    console.error(`[ingest] Failed to fetch ${source.name}:`, (err as Error).message);
    return { source: source.name, inserted: 0, skipped: 0, failed: true };
  }

  let skipped = 0;

  // Built as a single bulkWrite rather than one awaited updateOne per item — with a feed
  // like Nile Post's (~300 items), sequential round-trips to a remote Atlas cluster added
  // up to a real, measurable delay. One bulk request per source keeps this fast regardless
  // of feed size, and network latency to the cluster is no longer per-article.
  const operations = [];
  const imageless: { link: string; fields: Record<string, unknown> }[] = [];

  for (const item of feed.items) {
    if (!item.link || !item.title) {
      skipped++;
      continue;
    }

    const summary = (item.contentSnippet || item.content || item.title).trim().slice(0, 500);

    let publishedAt: Date;
    if (item.isoDate || item.pubDate) {
      const parsed = parseFeedDate(item.isoDate) ?? parseFeedDate(item.pubDate);
      if (!parsed) {
        // A date was provided but neither raw nor timezone-corrected parsing could make
        // sense of it — can't verify staleness, so this item is skipped rather than risk
        // either silently treating it as fresh or writing an Invalid Date into the DB.
        skipped++;
        continue;
      }
      publishedAt = parsed;
    } else {
      publishedAt = new Date();
    }

    if (Date.now() - publishedAt.getTime() > MAX_ARTICLE_AGE_MS) {
      skipped++;
      continue;
    }

    // Several sources (Daily Monitor especially) put a real category hint directly in the
    // URL path (e.g. /uganda/sports/world-cup/...) even when there's no <category> RSS tag
    // and the title/summary text itself has no matching keyword — this was confirmed
    // directly against real feed data, where title-only classification was missing sports
    // stories whose URL path said "sports" outright.
    let urlPath = "";
    try {
      urlPath = new URL(item.link).pathname.replace(/[-/]/g, " ");
    } catch {
      // malformed URL — fall back to title/summary only, handled below
    }

    const classifyText = [item.categories?.join(" "), urlPath, item.title, summary]
      .filter(Boolean)
      .join(" ");
    const { categories, primary } = categorize(classifyText);

    const feedImage = extractImage(item);

    // Upsert on `url` (unique index on Article) — repeated cron runs re-fetch the same
    // feed items, and $setOnInsert means an existing article is never overwritten/duplicated.
    const insertFields: Record<string, unknown> = {
      title: item.title,
      summary: summary || item.title,
      image_url: feedImage ?? undefined,
      source: source.name,
      url: item.link,
      published_at: publishedAt,
      categories,
      primary_category: primary,
      region: source.region,
      // "local" only makes sense for Uganda-sourced items — no other controlled tag
      // value exists yet for regional/global content (see constants/categories.ts).
      tags: source.region === "uganda" ? ["local"] : [],
      clicks: 0,
      impressions: 0,
      trending_score: 0,
      created_at: new Date(),
    };

    operations.push({
      updateOne: {
        filter: { url: item.link },
        update: { $setOnInsert: insertFields },
        upsert: true,
      },
    });

    if (!feedImage) imageless.push({ link: item.link, fields: insertFields });
  }

  if (operations.length === 0) {
    return { source: source.name, inserted: 0, skipped, failed: false };
  }

  // Feed carried no image (Al Jazeera, TechCrunch, NTV...) — fall back to the article
  // page's og:image. Only for URLs not already stored: ingest runs every 15 minutes, and
  // re-fetching every image-less page on every run would hammer the outlets for nothing.
  if (imageless.length > 0) {
    const existing = new Set(
      (await Article.find({ url: { $in: imageless.map((i) => i.link) } }, { url: 1 }).lean()).map(
        (a) => a.url
      )
    );
    const fresh = imageless.filter((i) => !existing.has(i.link));
    await mapWithConcurrency(fresh, OG_FETCH_CONCURRENCY, async (entry) => {
      const image = await fetchOgImage(entry.link);
      if (image) entry.fields.image_url = image;
    });
  }

  const result = await Article.bulkWrite(operations, { ordered: false });
  const inserted = result.upsertedCount;
  skipped += operations.length - inserted;

  return { source: source.name, inserted, skipped, failed: false };
}

export async function ingestAllSources(): Promise<IngestResult[]> {
  const results: IngestResult[] = [];

  for (const source of RSS_SOURCES) {
    const result = await ingestSource(source);
    console.log(
      `[ingest] ${result.source}: inserted=${result.inserted} skipped=${result.skipped} failed=${result.failed}`
    );
    results.push(result);
  }

  return results;
}
