import { Region } from "../constants/regions";

export interface RssSource {
  name: string; // becomes Article.source
  feedUrl: string;
  region: Region;
}

// Verified working 2026-07-22 by fetching each URL directly (a browser User-Agent was
// required for ntv.co.ug and monitor.co.ug, both of which reject default/bot UAs).
//
// New Vision is deliberately absent: no RSS autodiscovery link, no working /feed or /rss
// path, nothing in robots.txt or sitemap.xml pointing to a feed — their site is a Nuxt.js
// SPA that doesn't appear to expose one. Ingesting them requires a source-specific Cheerio
// scraper against their actual page markup, which hasn't been built yet (see PRODUCT_DESIGN.md
// for the RSS + scraping-fallback strategy this is meant to cover).
//
// Regional/global sources verified working 2026-07-23. Also checked and rejected that day:
// The Citizen (Tanzania, 404), Reuters World (feeds.reuters.com no longer resolves — DNS
// dead), ESPN (connection reset even with the same browser UA every other source accepts).
// See CLAUDE.md for the full note.
export const RSS_SOURCES: RssSource[] = [
  { name: "Daily Monitor", feedUrl: "https://www.monitor.co.ug/rss.xml", region: "uganda" },
  { name: "NTV Uganda", feedUrl: "https://www.ntv.co.ug/rss", region: "uganda" },
  { name: "Nile Post", feedUrl: "https://nilepost.co.ug/feed/", region: "uganda" },

  { name: "Nation Africa", feedUrl: "https://nation.africa/kenya/rss.xml", region: "regional" },

  { name: "BBC World", feedUrl: "http://feeds.bbci.co.uk/news/world/rss.xml", region: "global" },
  { name: "Al Jazeera", feedUrl: "https://www.aljazeera.com/xml/rss/all.xml", region: "global" },
  { name: "Sky Sports", feedUrl: "https://www.skysports.com/rss/12040", region: "global" },
  { name: "TechCrunch", feedUrl: "https://techcrunch.com/feed/", region: "global" },
  { name: "The Verge", feedUrl: "https://www.theverge.com/rss/index.xml", region: "global" },
];
