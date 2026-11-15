import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { WebView } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams } from 'expo-router';
import { Article } from '@/api/types';
import { fetchArticle } from '@/api/endpoints';
import { toggleSavedArticle, getSavedArticleIds } from '@/lib/savedArticles';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function ArticleDetailScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [reading, setReading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [webViewError, setWebViewError] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchArticle(id).then(setArticle);
    getSavedArticleIds().then((ids) => setSaved(ids.has(id)));
  }, [id]);

  async function handleToggleSave() {
    if (!id) return;
    const nowSaved = await toggleSavedArticle(id);
    setSaved(nowSaved);
  }

  if (!article) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  // In-app WebView, never a scraped/stored full-text render — the content strategy
  // (PRODUCT_DESIGN.md) frames the source's own page rather than copying its content, to
  // stay clear of republishing copyrighted material from named commercial outlets.
  if (reading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.webViewToolbar, { borderBottomColor: colors.backgroundElement }]}>
          <Pressable onPress={() => setReading(false)}>
            <Text style={[styles.toolbarAction, { color: colors.text }]}>Back</Text>
          </Pressable>
          <Pressable onPress={() => WebBrowser.openBrowserAsync(article.url)}>
            <Text style={[styles.toolbarAction, { color: colors.text }]}>Open in browser</Text>
          </Pressable>
        </View>
        {webViewError ? (
          <View style={styles.center}>
            <Text style={{ color: colors.textSecondary }}>This page didn&apos;t load.</Text>
            <Pressable onPress={() => WebBrowser.openBrowserAsync(article.url)}>
              <Text style={[styles.toolbarAction, { color: colors.text }]}>Open in browser instead</Text>
            </Pressable>
          </View>
        ) : (
          <WebView
            source={{ uri: article.url }}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.center}>
                <ActivityIndicator />
              </View>
            )}
            onError={() => setWebViewError(true)}
          />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {article.image_url ? (
        <Image source={{ uri: article.image_url }} style={styles.hero} contentFit="cover" transition={150} cachePolicy="memory-disk" />
      ) : null}
      <View style={styles.body}>
        <Text style={[styles.badge, { color: colors.textSecondary }]}>
          {article.primary_category.toUpperCase()}
        </Text>
        <Text style={[styles.title, { color: colors.text }]}>{article.title}</Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          {article.source} · {new Date(article.published_at).toLocaleString()}
        </Text>
        <Text style={[styles.summary, { color: colors.text }]}>{article.summary}</Text>
        <Pressable style={[styles.readButton, { backgroundColor: colors.text }]} onPress={() => setReading(true)}>
          <Text style={[styles.readButtonText, { color: colors.background }]}>Read full story</Text>
        </Pressable>
        <Pressable style={styles.saveButton} onPress={handleToggleSave}>
          <Text style={[styles.saveButtonText, { color: colors.text }]}>
            {saved ? 'Saved ✓' : 'Save for later'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  hero: {
    width: '100%',
    height: 240,
  },
  body: {
    padding: Spacing.four,
  },
  badge: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: Spacing.two,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  meta: {
    fontSize: 13,
    marginTop: Spacing.two,
    marginBottom: Spacing.four,
  },
  summary: {
    fontSize: 16,
    lineHeight: 24,
  },
  readButton: {
    marginTop: Spacing.five,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  readButtonText: {
    fontWeight: '700',
    fontSize: 16,
  },
  saveButton: {
    marginTop: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  saveButtonText: {
    fontWeight: '600',
  },
  webViewToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbarAction: {
    fontWeight: '600',
  },
});
