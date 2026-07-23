import { Ionicons } from '@expo/vector-icons';

type IoniconName = keyof typeof Ionicons.glyphMap;

// Matches backend/src/constants/categories.ts's controlled vocabulary — falls back to a
// generic icon for anything unrecognized rather than crashing on a mismatch.
const CATEGORY_ICONS: Record<string, IoniconName> = {
  politics: 'megaphone-outline',
  business: 'briefcase-outline',
  sports: 'football-outline',
  entertainment: 'film-outline',
  technology: 'hardware-chip-outline',
  health: 'medkit-outline',
  crime: 'shield-outline',
  weather: 'partly-sunny-outline',
};

const DEFAULT_ICON: IoniconName = 'newspaper-outline';

export function getCategoryIcon(categoryId: string): IoniconName {
  return CATEGORY_ICONS[categoryId] ?? DEFAULT_ICON;
}
