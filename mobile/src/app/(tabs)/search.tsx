import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Article } from '@/api/types';
import { fetchSearch } from '@/api/endpoints';
import { ArticleCard } from '@/components/ArticleCard';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const RESULTS_LIMIT = 20;

export default function SearchScreen() {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search-on-submit, not search-as-you-type — one request per query instead of one per
  // keystroke, which matters on a metered/slow connection this app is built for.
  async function runSearch() {
    const trimmed = query.trim();
    if (!trimmed) return;

    setSubmittedQuery(trimmed);
    setLoading(true);
    setError(null);
    try {
      const page = await fetchSearch(trimmed, undefined, RESULTS_LIMIT);
      setArticles(page.articles);
      setCursor(page.next_cursor);
      setHasMore(page.has_more);
    } catch {
      setError('Search failed — check your connection and try again.');
      setArticles([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  async function handleLoadMore() {
    if (!hasMore || loadingMore || !cursor || !submittedQuery) return;
    setLoadingMore(true);
    try {
      const page = await fetchSearch(submittedQuery, cursor, RESULTS_LIMIT);
      setArticles((prev) => [...prev, ...page.articles]);
      setCursor(page.next_cursor);
      setHasMore(page.has_more);
    } catch {
      // best-effort — leave existing results in place rather than clearing them on a
      // failed "load more" tap
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.inputRow, { backgroundColor: colors.backgroundElement }]}>
        <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={runSearch}
          returnKeyType="search"
          placeholder="Search articles"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { color: colors.text }]}
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} />
      ) : error ? (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>{error}</Text>
      ) : submittedQuery ? (
        <FlatList
          data={articles}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ArticleCard article={item} />}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.5}
          onEndReached={handleLoadMore}
          ListEmptyComponent={
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              No articles found for “{submittedQuery}”.
            </Text>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoader} /> : undefined}
        />
      ) : (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Search recent Ugandan and international news.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.four,
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
  },
  input: {
    flex: 1,
    fontSize: 15,
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
  hint: {
    textAlign: 'center',
    marginTop: Spacing.five,
    paddingHorizontal: Spacing.four,
  },
});
