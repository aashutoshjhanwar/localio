import Constants from 'expo-constants';
import { Platform } from 'react-native';

// On iOS sim & web, localhost works. On Android emulator, use 10.0.2.2.
// On a real device, set your Mac's LAN IP in app.json extra.apiUrl.
function resolveApiUrl(): string {
  const fromExtra = (Constants.expoConfig?.extra as any)?.apiUrl as string | undefined;
  if (fromExtra && fromExtra !== 'http://localhost:4000') return fromExtra;
  if (Platform.OS === 'android') return 'http://10.0.2.2:4000';
  return 'http://localhost:4000';
}

export const API_URL = resolveApiUrl();

// Public-facing base URL used for share links (WhatsApp / iMessage previews).
// Falls back to API_URL in dev so you can test the unfurl pipeline locally.
function resolvePublicUrl(): string {
  const fromExtra = (Constants.expoConfig?.extra as any)?.publicUrl as string | undefined;
  if (fromExtra) return fromExtra;
  return API_URL;
}
export const PUBLIC_URL = resolvePublicUrl();

