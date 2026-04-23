import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = (conversationId: string) => `localio.chat.${conversationId}`;
const MAX = 200; // keep last 200 messages per conversation

export async function loadCachedMessages(conversationId: string): Promise<any[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY(conversationId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export async function saveCachedMessages(conversationId: string, messages: any[]): Promise<void> {
  try {
    const trimmed = messages
      .filter((m) => !m.pending && !m.failed && m.id && !String(m.id).startsWith('c_'))
      .slice(-MAX);
    await AsyncStorage.setItem(KEY(conversationId), JSON.stringify(trimmed));
  } catch { /* noop */ }
}

export async function clearChatCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const chatKeys = keys.filter((k) => k.startsWith('localio.chat.'));
    await Promise.all(chatKeys.map((k) => AsyncStorage.removeItem(k)));
  } catch { /* noop */ }
}
