import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Article } from '@/api/types';
import { fetchFeed, fetchTrending } from '@/api/endpoints';
import { ArticleCard } from '@/components/ArticleCard';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type RegionFilter = 'all' | 'uganda' | 'international';
type IoniconName = keyof typeof Ionicons.glyphMap;

const REGION_FILTERS: { id: RegionFilter; label: string; icon: IoniconName }[] = [
  { id: 'all', label: 'Top', icon: 'flame-outline' },
  { id: 'uganda', label: 'Uganda', icon: 'flag-outline' },
  { id: 'international', label: 'International', icon: 'globe-outline' },
];

export default function HomeScreen() {
  const { colors } = useTheme();
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all');
  const [articles, setArticles] = useState<Article[]>([]);
  const [trending, setTrending] = useState<Article[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Guards against out-of-order responses: if the filter is tapped twice quickly, an older
  // request can resolve *after* a newer one and silently overwrite the screen with stale
  // data even though the newer filter's request was already correct — confirmed directly by
  // comparing the actual request log against the reported symptom (chip highlight and
  // content going out of sync). This ref always holds the *currently selected* filter, so a
  // response is only applied if it's still the one the user is looking at.
  const activeFilterRef = useRef(regionFilter);
  useEffect(() => {
    activeFilterRef.current = regionFilter;
  }, [regionFilter]);

  const loadInitial = useCallback(async (filter: RegionFilter) => {
    const region = filter === 'all' ? undefined : filter;
    const [feedPage, trendingPage] = await Promise.all([
      fetchFeed(undefined, undefined, region),
      fetchTrending(undefined, 10),
    ]);
    if (activeFilterRef.current !== filter) return; // a newer filter is active — discard
    setArticles(feedPage.articles);
    setCursor(feedPage.next_cursor);
    setHasMore(feedPage.has_more);
    setTrending(trendingPage.articles);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadInitial(regionFilter).finally(() => setLoading(false));
  }, [loadInitial, regionFilter]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadInitial(regionFilter);
    setRefreshing(false);
  }

  async function handleLoadMore() {
    if (!hasMore || loadingMore || !cursor) return;
    const filterAtRequestTime = regionFilter;
    setLoadingMore(true);
    const region = filterAtRequestTime === 'all' ? undefined : filterAtRequestTime;
    const page = await fetchFeed(cursor, undefined, region);
    if (activeFilterRef.current !== filterAtRequestTime) {
      setLoadingMore(false);
      return; // filter changed mid-request — this page belongs to the old filter, discard it
    }
    setArticles((prev) => [...prev, ...page.articles]);
    setCursor(page.next_cursor);
    setHasMore(page.has_more);
    setLoadingMore(false);
  }

  return (
    <View style={styles.screen}>
      <View style={styles.filterRow}>
        {REGION_FILTERS.map((filter) => (
          <Pressable
            key={filter.id}
            onPress={() => setRegionFilter(filter.id)}
            style={[
              styles.filterChip,
              { backgroundColor: colors.backgroundElement },
              regionFilter === filter.id && { backgroundColor: colors.text },
            ]}
          >
            <Ionicons
              name={filter.icon}
              size={15}
              color={regionFilter === filter.id ? colors.background : colors.text}
            />
            <Text
              style={[
                styles.filterChipText,
                { color: colors.text },
                regionFilter === filter.id && { color: colors.background },
              ]}
            >
              {filter.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={articles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ArticleCard article={item} />}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          onEndReachedThreshold={0.5}
          onEndReached={handleLoadMore}
          ListHeaderComponent={
            regionFilter !== 'international' && trending.length > 0 ? (
              <View style={styles.trendingSection}>
                <Text style={[styles.trendingTitle, { color: colors.textSecondary }]}>Trending in Uganda</Text>
                <FlatList
                  data={trending}
                  horizontal
                  keyExtractor={(item) => `trending-${item.id}`}
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <View style={styles.trendingCard}>
                      <ArticleCard article={item} />
                    </View>
                  )}
                />
              </View>
            ) : null
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoader} /> : null}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: 999,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    padding: Spacing.four,
  },
  trendingSection: {
    marginBottom: Spacing.five,
  },
  trendingTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: Spacing.three,
  },
  trendingCard: {
    width: 240,
    marginRight: Spacing.three,
  },
  footerLoader: {
    marginVertical: Spacing.four,
  },
});
