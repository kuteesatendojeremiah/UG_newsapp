import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Category } from '@/api/types';
import { getCategories } from '@/lib/categories';
import { setLocalInterests } from '@/lib/interests';
import { saveInterests } from '@/api/endpoints';
import { useOnboarding } from '@/lib/onboardingContext';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Preselecting popular categories keeps Continue enabled immediately — no empty state, no
// forced thinking before the user can proceed (see UI_STRUCTURE.md's onboarding rule).
const DEFAULT_PRESELECTED = ['politics', 'sports', 'technology'];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const { completeOnboarding } = useOnboarding();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(DEFAULT_PRESELECTED));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleContinue() {
    if (selected.size === 0 || saving) return;
    setSaving(true);
    const interests = Array.from(selected);
    try {
      await saveInterests(interests);
    } catch {
      // Backend validates too, but this call can fail on a flaky connection — the user's
      // selection is still saved locally below so onboarding never gets stuck on a network
      // blip; the next authenticated request will sync it via POST /user/interests again
      // implicitly whenever Settings is next saved.
    }
    await setLocalInterests(interests);
    setSaving(false);
    // Flips the shared guard state directly — Stack.Protected reacts to this and unlocks/
    // navigates to the tabs group on its own; there is no separate router.replace() to call,
    // since the guard (not an imperative navigation) is what was actually blocking access.
    completeOnboarding();
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>What interests you?</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Pick a few — you can change these anytime in Profile.
        </Text>
        <View style={styles.grid}>
          {categories.map((category) => {
            const isSelected = selected.has(category.id);
            return (
              <Pressable
                key={category.id}
                onPress={() => toggle(category.id)}
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
      </ScrollView>
      <Pressable
        onPress={handleContinue}
        disabled={selected.size === 0 || saving}
        style={[
          styles.continueButton,
          { backgroundColor: colors.text },
          selected.size === 0 && styles.continueButtonDisabled,
        ]}
      >
        <Text style={[styles.continueText, { color: colors.background }]}>
          {saving ? 'Saving…' : 'Continue'}
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: Spacing.two,
    marginBottom: Spacing.four,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
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
  continueButton: {
    margin: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    opacity: 0.4,
  },
  continueText: {
    fontWeight: '700',
    fontSize: 16,
  },
});
