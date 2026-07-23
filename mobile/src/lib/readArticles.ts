import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_KEY = 'read_articles_v1';
const TOTAL_COUNT_KEY = 'read_articles_total_v1';
const MAX_HISTORY_ENTRIES = 50;

export interface ReadEntry {
  id: string;
  readAt: string;
}

// Detailed history is capped (bounds storage growth — "recently viewed" is inherently a
// sliding window), but the lifetime total is a separate, uncapped counter so "Articles
// read: N" stays a genuine lifetime stat instead of maxing out at MAX_HISTORY_ENTRIES.
// Trade-off: the "this week" stat (see profile.tsx) is derived from the capped history, so
// a user reading more than MAX_HISTORY_ENTRIES articles in a single week would undercount —
// not worth uncapped storage just for that one bonus stat's precision.
export async function getReadHistory(): Promise<ReadEntry[]> {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  if (!raw) return [];

  const parsed = JSON.parse(raw) as unknown[];
  // Migrates the pre-existing plain-string-array format (no order/timestamp) — wrap as the
  // oldest possible entry rather than crash or silently drop it.
  return parsed.map((entry) =>
    typeof entry === 'string' ? { id: entry, readAt: new Date(0).toISOString() } : (entry as ReadEntry)
  );
}

export async function getReadCountTotal(): Promise<number> {
  const raw = await AsyncStorage.getItem(TOTAL_COUNT_KEY);
  return raw ? Number(raw) : 0;
}

export async function markArticleRead(articleId: string): Promise<void> {
  const history = await getReadHistory();
  const withoutThisArticle = history.filter((entry) => entry.id !== articleId);
  const next = [{ id: articleId, readAt: new Date().toISOString() }, ...withoutThisArticle].slice(
    0,
    MAX_HISTORY_ENTRIES
  );
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));

  const total = await getReadCountTotal();
  await AsyncStorage.setItem(TOTAL_COUNT_KEY, String(total + 1));
}

export async function clearReadHistory(): Promise<void> {
  await AsyncStorage.multiRemove([HISTORY_KEY, TOTAL_COUNT_KEY]);
}
