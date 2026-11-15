import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Article } from '@/api/types';
import { trackImpression, trackClick } from '@/api/endpoints';
import { markArticleRead } from '@/lib/readArticles';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function ArticleCard({ article }: { article: Article }) {
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    // Fires on render, not true on-screen visibility (that would need FlatList's
    // onViewableItemsChanged) — a reasonable v1 approximation, noted as a known
    // simplification rather than silently treated as exact.
    trackImpression(article.id).catch(() => {
      // best-effort — a dropped impression has negligible ranking impact, not worth
      // surfacing an error to the user for
    });
  }, [article.id]);

  function handlePress() {
    trackClick(article.id).catch(() => {});
    markArticleRead(article.id).catch(() => {});
    router.push(`/article/${article.id}`);
  }

  return (
    <Pressable onPress={handlePress} style={styles.card}>
      {/* No image → no empty block. Cards without one just start at the text. */}
      {article.image_url ? (
        <Image
          source={{ uri: article.image_url }}
          style={[styles.image, { backgroundColor: colors.backgroundElement }]}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          recyclingKey={article.id}
        />
      ) : null}
      <View style={styles.body}>
        <View style={styles.badgeRow}>
          <Text style={[styles.badge, { color: colors.textSecondary }]}>
            {article.primary_category.toUpperCase()}
          </Text>
          {article.region !== 'uganda' ? (
            <Text style={[styles.badge, { color: colors.text }]}>INTERNATIONAL</Text>
          ) : null}
        </View>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={3}>
          {article.title}
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          {article.source} · {timeAgo(article.published_at)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.four,
  },
  image: {
    width: '100%',
    height: 180,
    borderRadius: Spacing.two,
  },
  body: {
    paddingTop: Spacing.two,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.half,
  },
  badge: {
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  meta: {
    fontSize: 12,
    marginTop: Spacing.half,
  },
});
