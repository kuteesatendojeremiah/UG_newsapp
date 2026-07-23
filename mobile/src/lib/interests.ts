import AsyncStorage from '@react-native-async-storage/async-storage';

const INTERESTS_KEY = 'user_interests_v1';

// Source of truth for "what are this device's current interests" is local storage, not a
// GET endpoint — the backend only exposes POST /user/interests (write-only). device_id and
// this cache live in the same local storage, so a reinstall wipes both together and there's
// never a case where they'd disagree. See API_DESIGN.md / UI_STRUCTURE.md for the reasoning.
export async function getLocalInterests(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(INTERESTS_KEY);
  return raw ? (JSON.parse(raw) as string[]) : [];
}

export async function setLocalInterests(interests: string[]): Promise<void> {
  await AsyncStorage.setItem(INTERESTS_KEY, JSON.stringify(interests));
}

export async function hasOnboarded(): Promise<boolean> {
  const interests = await getLocalInterests();
  return interests.length > 0;
}
