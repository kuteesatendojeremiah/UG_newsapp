import * as cheerio from "cheerio";

// Same browser UA as ingestRss.ts — several outlets reject curl/bot-style default UAs.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const PAGE_TIMEOUT_MS = 8000;
// <meta> tags live in <head>; no need to download/parse a whole article body.
const MAX_HTML_BYTES = 300_000;

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

// First <img src> found in an HTML fragment (e.g. an Atom/RSS <content> body).
export function firstImageInHtml(html?: string): string | null {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match && isHttpUrl(match[1]) ? match[1] : null;
}

// Fetches an article page and returns its og:image / twitter:image, or null on any
// failure. Never throws — a missing thumbnail must never block ingestion.
export async function fetchOgImage(pageUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);
  try {
    const res = await fetch(pageUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) return null;

    const html = (await res.text()).slice(0, MAX_HTML_BYTES);
    const $ = cheerio.load(html);
    const candidate =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      $('meta[property="twitter:image"]').attr("content");
    if (!candidate) return null;

    // Resolve protocol-relative / relative URLs against the page.
    const resolved = new URL(candidate, pageUrl).toString();
    return isHttpUrl(resolved) ? resolved : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Runs `worker` over `items` with at most `limit` in flight — keeps a 25-item feed from
// opening 25 simultaneous connections to one outlet.
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}
