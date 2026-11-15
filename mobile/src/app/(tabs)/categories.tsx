import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Category, Article } from '@/api/types';
import { getCategories } from '@/lib/categories';
import { getCategoryIcon } from '@/lib/categoryIcons';
import { fetchFeed } from '@/api/endpoints';
import { ArticleCard } from '@/components/ArticleCard';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type RegionSection = 'uganda' | 'international';
type IoniconName = keyof typeof Ionicons.glyphMap;

const REGION_SECTIONS: { id: RegionSection; label: string; icon: IoniconName }[] = [
  { id: 'uganda', label: 'Uganda', icon: 'flag-outline' },
  { id: 'international', label: 'International', icon: 'globe-outline' },
];

const PAGE_LIMIT = 20;

// Region and category are independent, orthogonal filters, both applied server-side via
// /feed (see feed.service.ts) — real cursor pagination, not the old "fetch a trending batch
// and filter client-side" approach, which capped out at one unpaginated page.
export default function CategoriesScreen() {
  const { colors } = useTheme();
  const [regionSection, setRegionSection] = useState<RegionSection>('uganda');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  // Guards against out-of-order responses when region/category are switched quickly — same
  // race condition class as the Home tab's region filter (see index.tsx for the full note).
  const activeKeyRef = useRef('');

  const load = useCallback(async (region: RegionSection, category: string | null) => {
    const key = `${region}|${category ?? ''}`;
    activeKeyRef.current = key;
    setLoading(true);
    const page = await fetchFeed(undefined, PAGE_LIMIT, region, category ?? undefined);
    if (activeKeyRef.current !== key) return; // a newer selection is active — discard
    setArticles(page.articles);
    setCursor(page.next_cursor);
    setHasMore(page.has_more);
    setLoading(false);
  }, []);

  useEffect(() => {
    load(regionSection, selectedCategory);
  }, [load, regionSection, selectedCategory]);

  async function handleLoadMore() {
    if (!hasMore || loadingMore || !cursor) return;
    const key = `${regionSection}|${selectedCategory ?? ''}`;
    setLoadingMore(true);
    const page = await fetchFeed(cursor, PAGE_LIMIT, regionSection, selectedCategory ?? undefined);
    if (activeKeyRef.current !== key) {
      setLoadingMore(false);
      return; // selection changed mid-request — this page belongs to the old selection
    }
    setArticles((prev) => [...prev, ...page.articles]);
    setCursor(page.next_cursor);
    setHasMore(page.has_more);
    setLoadingMore(false);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.regionRow}>
        {REGION_SECTIONS.map((section) => (
          <Pressable
            key={section.id}
            onPress={() => setRegionSection(section.id)}
            style={[
              styles.regionChip,
              { backgroundColor: colors.backgroundElement },
              regionSection === section.id && { backgroundColor: colors.text },
            ]}
          >
            <Ionicons
              name={section.icon}
              size={15}
              color={regionSection === section.id ? colors.background : colors.text}
            />
            <Text
              style={[
                styles.regionChipText,
                { color: colors.text },
                regionSection === section.id && { color: colors.background },
              ]}
            >
              {section.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={categories}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.iconRow}
        ListHeaderComponent={
          <Pressable
            onPress={() => setSelectedCategory(null)}
            style={[
              styles.iconChip,
              { backgroundColor: colors.backgroundElement },
              selectedCategory === null && { backgroundColor: colors.text },
            ]}
          >
            <Ionicons
              name="apps-outline"
              size={20}
              color={selectedCategory === null ? colors.background : colors.text}
            />
            <Text
              style={[
                styles.iconLabel,
                { color: colors.text },
                selectedCategory === null && { color: colors.background },
              ]}
              numberOfLines={1}
            >
              All
            </Text>
          </Pressable>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setSelectedCategory(item.id)}
            style={[
              styles.iconChip,
              { backgroundColor: colors.backgroundElement },
              selectedCategory === item.id && { backgroundColor: colors.text },
            ]}
          >
            <Ionicons
              name={getCategoryIcon(item.id)}
              size={20}
              color={selectedCategory === item.id ? colors.background : colors.text}
            />
            <Text
              style={[
                styles.iconLabel,
                { color: colors.text },
                selectedCategory === item.id && { color: colors.background },
              ]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </Pressable>
        )}
      />

      {loading ? (
        <ActivityIndicator style={styles.loader} />
      ) : (
        <FlatList
          data={articles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ArticleCard article={item} />}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.5}
          onEndReached={handleLoadMore}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textSecondary }]}>No recent articles found.</Text>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoader} /> : undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  regionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  regionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
  },
  regionChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  iconRow: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  iconChip: {
    width: 64,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  iconLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: Spacing.half,
  },
  list: {
    padding: Spacing.four,
  },
  loader: {
    marginTop: Spacing.five,
  },
  footerLoader: {
    marginVertical: Spacing.four,
  },
  empty: {
    textAlign: 'center',
    marginTop: Spacing.five,
  },
});
