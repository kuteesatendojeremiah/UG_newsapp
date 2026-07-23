import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchCategories } from '../api/endpoints';
import { Category } from '../api/types';

const CACHE_KEY = 'categories_cache_v1';

// Baked-in fallback so onboarding never breaks offline or on a failed API call — mirrors the
// backend's controlled vocabulary in backend/src/constants/categories.ts. This is a small,
// rarely-changing fixed list kept in sync manually (see API_DESIGN.md's categories decision).
const FALLBACK_CATEGORIES: Category[] = [
  { id: 'politics', label: 'Politics' },
  { id: 'business', label: 'Business' },
  { id: 'sports', label: 'Sports' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'technology', label: 'Technology' },
  { id: 'health', label: 'Health' },
  { id: 'crime', label: 'Crime' },
  { id: 'weather', label: 'Weather' },
];

export async function getCategories(): Promise<Category[]> {
  try {
    const result = await fetchCategories();
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(result.categories));
    return result.categories;
  } catch {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached) as Category[];
    return FALLBACK_CATEGORIES;
  }
}
