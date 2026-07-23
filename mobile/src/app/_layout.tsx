import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { OnboardingProvider, useOnboarding } from '@/lib/onboardingContext';
import { AppThemeProvider, useTheme } from '@/hooks/use-theme';

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { onboarded } = useOnboarding();

  useEffect(() => {
    if (onboarded !== null) {
      SplashScreen.hideAsync();
    }
  }, [onboarded]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={onboarded === true}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="article/[id]" options={{ headerShown: true, title: '' }} />
      </Stack.Protected>
      <Stack.Protected guard={onboarded === false}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
    </Stack>
  );
}

// Reads the *resolved* theme (system, or the user's manual override — see hooks/use-theme.ts)
// rather than the raw system color scheme directly, so a manual override also applies to
// React Navigation's own chrome (headers, tab bar), not just this app's own screen content.
function ThemedNavigator() {
  const { colorScheme } = useTheme();

  return (
    <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <OnboardingProvider>
        <RootNavigator />
      </OnboardingProvider>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <ThemedNavigator />
    </AppThemeProvider>
  );
}
