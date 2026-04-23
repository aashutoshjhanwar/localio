import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const webGet = (k: string) => {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(k) : null; } catch { return null; }
};
const webSet = (k: string, v: string) => {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(k, v); } catch {}
};
const webDel = (k: string) => {
  try { if (typeof localStorage !== 'undefined') localStorage.removeItem(k); } catch {}
};

export const secureStorage = {
  get: async (k: string): Promise<string | null> =>
    Platform.OS === 'web' ? webGet(k) : SecureStore.getItemAsync(k),
  set: async (k: string, v: string): Promise<void> => {
    if (Platform.OS === 'web') webSet(k, v);
    else await SecureStore.setItemAsync(k, v);
  },
  del: async (k: string): Promise<void> => {
    if (Platform.OS === 'web') webDel(k);
    else await SecureStore.deleteItemAsync(k);
  },
};
