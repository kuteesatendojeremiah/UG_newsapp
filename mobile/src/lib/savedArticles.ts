import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVED_KEY = 'saved_articles_v1';

// "Save-lite" — local-only bookmark, no backend/API, per UI_STRUCTURE.md. Captures
// save-intent as a signal now without committing to backend schema before there's a real
// use for it (ranking input, "continue reading" notifications, etc. — all post-MVP).
export async function getSavedArticleIds(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(SAVED_KEY);
  return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
}

export async function toggleSavedArticle(articleId: string): Promise<boolean> {
  const ids = await getSavedArticleIds();
  const willBeSaved = !ids.has(articleId);
  if (willBeSaved) {
    ids.add(articleId);
  } else {
    ids.delete(articleId);
  }
  await AsyncStorage.setItem(SAVED_KEY, JSON.stringify(Array.from(ids)));
  return willBeSaved;
}
