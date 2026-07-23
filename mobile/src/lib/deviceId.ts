import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'device_id';

// expo-secure-store has no web implementation (it wraps native Keychain/Keystore APIs) —
// this app targets Android first and SecureStore is right for a real device, but a browser
// preview during development should degrade to AsyncStorage rather than hard-crash.
const storage = Platform.OS === 'web'
  ? { getItem: AsyncStorage.getItem, setItem: AsyncStorage.setItem }
  : { getItem: SecureStore.getItemAsync, setItem: SecureStore.setItemAsync };

// Weak identity only — fine for personalization/tracking/dedup, never anything sensitive
// (see PRODUCT_DESIGN.md's identity strategy). A Math.random-based v4 is used deliberately
// instead of pulling in a crypto dependency, since cryptographic strength isn't required here.
function generateUuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

let cachedDeviceId: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cachedDeviceId) return cachedDeviceId;

  let id = await storage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = generateUuidV4();
    await storage.setItem(DEVICE_ID_KEY, id);
  }

  cachedDeviceId = id;
  return id;
}
