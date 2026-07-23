import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Article, Category } from '@/api/types';
import { getCategories } from '@/lib/categories';
import { getLocalInterests, setLocalInterests } from '@/lib/interests';
import { saveInterests, fetchArticle } from '@/api/endpoints';
import { getSavedArticleIds, toggleSavedArticle } from '@/lib/savedArticles';
import { getReadHistory, getReadCountTotal, clearReadHistory, ReadEntry } from '@/lib/readArticles';
import { ArticleCard } from '@/components/ArticleCard';
import { ThemePreference, useTheme } from '@/hooks/use-theme';
import { Colors, Spacing } from '@/constants/theme';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const THEME_OPTIONS: { id: ThemePreference; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

// Resolves locally-stored article IDs to full Article objects. Articles can vanish (7-day
// TTL on the backend) — a failed fetch means the save/read-entry is now dangling, so it's
// dropped from the returned list and the caller is told which IDs to prune from storage
// (rather than showing a broken card forever).
async function resolveArticles(ids: string[]): Promise<{ articles: Article[]; deadIds: string[] }> {
  const results = await Promise.all(
    ids.map(async (id) => {
      try {
        return { id, article: await fetchArticle(id) };
      } catch {
        return { id, article: null };
      }
    })
  );
  return {
    articles: results.filter((r) => r.article !== null).map((r) => r.article as Article),
    deadIds: results.filter((r) => r.article === null).map((r) => r.id),
  };
}

export default function ProfileScreen() {
  const { colors, preference, setPreference } = useTheme();

  // Your Interests (existing, unchanged behavior)
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(new Set());
  const [savingInterests, setSavingInterests] = useState(false);
  const [interestsSavedMessage, setInterestsSavedMessage] = useState(false);

  // Saved Articles
  const [savedArticles, setSavedArticles] = useState<Article[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);

  // Recently Viewed + derived insight + Activity
  const [recentArticles, setRecentArticles] = useState<Article[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [readTotal, setReadTotal] = useState(0);
  const [readThisWeek, setReadThisWeek] = useState(0);

  const loadSaved = useCallback(async () => {
    setSavedLoading(true);
    const ids = await getSavedArticleIds();
    const { articles, deadIds } = await resolveArticles(Array.from(ids));
    await Promise.all(deadIds.map((id) => toggleSavedArticle(id)));
    setSavedArticles(articles);
    setSavedLoading(false);
  }, []);

  const loadRecent = useCallback(async () => {
    setRecentLoading(true);
    const [history, total] = await Promise.all([getReadHistory(), getReadCountTotal()]);
    const { articles } = await resolveArticles(history.map((entry: ReadEntry) => entry.id));
    setRecentArticles(articles);
    setReadTotal(total);

    const weekAgo = Date.now() - WEEK_MS;
    setReadThisWeek(history.filter((entry: ReadEntry) => new Date(entry.readAt).getTime() >= weekAgo).length);
    setRecentLoading(false);
  }, []);

  useEffect(() => {
    Promise.all([getCategories(), getLocalInterests()]).then(([cats, interests]) => {
      setCategories(cats);
      setSelectedInterests(new Set(interests));
    });
    loadSaved();
    loadRecent();
  }, [loadSaved, loadRecent]);

  function toggleInterest(id: string) {
    setSelectedInterests((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setInterestsSavedMessage(false);
  }

  async function handleSaveInterests() {
    if (selectedInterests.size === 0 || savingInterests) return;
    setSavingInterests(true);
    const interests = Array.from(selectedInterests);
    await saveInterests(interests);
    await setLocalInterests(interests);
    setSavingInterests(false);
    setInterestsSavedMessage(true);
  }

  async function handleRemoveSaved(articleId: string) {
    await toggleSavedArticle(articleId);
    setSavedArticles((prev) => prev.filter((a) => a.id !== articleId));
  }

  async function handleClearHistory() {
    await clearReadHistory();
    setRecentArticles([]);
    setReadTotal(0);
    setReadThisWeek(0);
  }

  // Derived from the already-resolved Recently Viewed list — no extra network calls.
  // Read-only insight, distinct from the user's actual chosen interests above (which still
  // drive feed ranking); this is just "here's what your reading looks like."
  const topReadCategories = tallyTopCategories(recentArticles);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.header, { color: colors.text }]}>Your Feed</Text>
      <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
        Personalized to your reading — no account needed.
      </Text>

      <Section title="Saved Articles" colors={colors}>
        {savedLoading ? (
          <ActivityIndicator />
        ) : savedArticles.length === 0 ? (
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Articles you save for later will show up here.
          </Text>
        ) : (
          savedArticles.map((article) => (
            <View key={article.id} style={styles.listItem}>
              <ArticleCard article={article} />
              <Pressable onPress={() => handleRemoveSaved(article.id)} style={styles.removeButton}>
                <Text style={[styles.removeButtonText, { color: colors.textSecondary }]}>Remove</Text>
              </Pressable>
            </View>
          ))
        )}
      </Section>

      <Section title="Recently Viewed" colors={colors}>
        {recentLoading ? (
          <ActivityIndicator />
        ) : recentArticles.length === 0 ? (
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Articles you read will show up here.
          </Text>
        ) : (
          recentArticles.map((article) => (
            <View key={article.id} style={styles.listItem}>
              <ArticleCard article={article} />
            </View>
          ))
        )}
      </Section>

      <Section title="Your Interests" colors={colors}>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Changes apply to your Home feed immediately after saving.
        </Text>
        <View style={styles.grid}>
          {categories.map((category) => {
            const isSelected = selectedInterests.has(category.id);
            return (
              <Pressable
                key={category.id}
                onPress={() => toggleInterest(category.id)}
                style={[
                  styles.chip,
                  { backgroundColor: colors.backgroundElement },
                  isSelected && { backgroundColor: colors.text },
                ]}
              >
                <Text
                  style={[styles.chipText, { color: colors.text }, isSelected && { color: colors.background }]}
                >
                  {category.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={handleSaveInterests}
          disabled={selectedInterests.size === 0 || savingInterests}
          style={[
            styles.saveButton,
            { backgroundColor: colors.text },
            selectedInterests.size === 0 && styles.saveButtonDisabled,
          ]}
        >
          <Text style={[styles.saveButtonText, { color: colors.background }]}>
            {savingInterests ? 'Saving…' : 'Save'}
          </Text>
        </Pressable>
        {interestsSavedMessage ? (
          <Text style={[styles.savedMessage, { color: colors.textSecondary }]}>Saved.</Text>
        ) : null}
        {topReadCategories.length > 0 ? (
          <Text style={[styles.derivedInsight, { color: colors.textSecondary }]}>
            Based on your reading: {topReadCategories.join(', ')}
          </Text>
        ) : null}
      </Section>

      <Section title="Activity" colors={colors}>
        <Text style={[styles.hint, { color: colors.text }]}>
          Articles read: {readTotal} total ({readThisWeek} this week)
        </Text>
      </Section>

      <Section title="Appearance" colors={colors}>
        <View style={styles.grid}>
          {THEME_OPTIONS.map((option) => {
            const isSelected = preference === option.id;
            return (
              <Pressable
                key={option.id}
                onPress={() => setPreference(option.id)}
                style={[
                  styles.chip,
                  { backgroundColor: colors.backgroundElement },
                  isSelected && { backgroundColor: colors.text },
                ]}
              >
                <Text
                  style={[styles.chipText, { color: colors.text }, isSelected && { color: colors.background }]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title="Settings" colors={colors}>
        <Pressable onPress={handleClearHistory}>
          <Text style={[styles.destructiveAction, { color: colors.text }]}>Clear reading history</Text>
        </Pressable>
      </Section>

      <Section title="About" colors={colors}>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {Constants.expoConfig?.name ?? 'Uganda News'} v{Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </Section>
    </ScrollView>
  );
}

function tallyTopCategories(articles: Article[]): string[] {
  const counts = new Map<string, number>();
  for (const article of articles) {
    counts.set(article.primary_category, (counts.get(article.primary_category) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([category]) => category.charAt(0).toUpperCase() + category.slice(1));
}

function Section({
  title,
  colors,
  children,
}: {
  title: string;
  colors: Record<keyof typeof Colors.light, string>;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.four,
  },
  header: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: Spacing.one,
    marginBottom: Spacing.five,
  },
  section: {
    marginBottom: Spacing.five,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.three,
  },
  hint: {
    fontSize: 14,
  },
  listItem: {
    marginBottom: Spacing.two,
  },
  removeButton: {
    marginTop: -Spacing.two,
    marginBottom: Spacing.two,
  },
  removeButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  chip: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    marginTop: Spacing.five,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontWeight: '700',
    fontSize: 16,
  },
  savedMessage: {
    textAlign: 'center',
    marginTop: Spacing.three,
  },
  derivedInsight: {
    fontSize: 13,
    marginTop: Spacing.three,
  },
  destructiveAction: {
    fontSize: 14,
    fontWeight: '600',
  },
});
