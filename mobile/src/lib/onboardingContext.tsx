import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { hasOnboarded as checkHasOnboarded } from './interests';

interface OnboardingContextValue {
  // null = not yet determined (native splash screen stays up)
  onboarded: boolean | null;
  completeOnboarding: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

// Stack.Protected's guard is read once from whatever state is passed to it — a child screen
// calling router.replace() cannot make a parent layout's guard flip on its own. This context
// is the shared state both the root layout (guard) and the onboarding screen (the thing that
// needs to flip it) read from, so completing onboarding actually unlocks the protected routes
// instead of just attempting a navigation the guard would otherwise block.
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    checkHasOnboarded().then(setOnboarded);
  }, []);

  function completeOnboarding() {
    setOnboarded(true);
  }

  return (
    <OnboardingContext.Provider value={{ onboarded, completeOnboarding }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
}
