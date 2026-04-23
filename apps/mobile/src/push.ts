import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { createNavigationContainerRef } from '@react-navigation/native';
import { Api } from './api/client';
import type { RootStackParamList } from './nav/RootNav';

export const navRef = createNavigationContainerRef<RootStackParamList>();

type PushData = {
  type?: string;
  postId?: string;
  listingId?: string;
  serviceId?: string;
  eventId?: string;
  conversationId?: string;
};

export function handlePushData(data: PushData | undefined) {
  if (!data || !navRef.isReady()) return;
  if (data.postId) return navRef.navigate('PostDetail', { id: data.postId });
  if (data.listingId) return navRef.navigate('ListingDetail', { id: data.listingId });
  if (data.serviceId) return navRef.navigate('ServiceDetail', { id: data.serviceId });
  if (data.eventId) return navRef.navigate('EventDetail', { id: data.eventId });
  if (data.conversationId) return navRef.navigate('ChatRoom', { conversationId: data.conversationId });
  navRef.navigate('Inbox' as any);
}

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function registerPushToken(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      const r = await Notifications.requestPermissionsAsync();
      status = r.status;
    }
    if (status !== 'granted') return;

    const projectId =
      (Constants.expoConfig as any)?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    const tokenRes = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();

    await Api.registerDevice(tokenRes.data, Platform.OS as any);
  } catch {
    // best-effort; ignore in dev
  }
}

let listenersAttached = false;
export function attachPushListeners() {
  if (listenersAttached || Platform.OS === 'web') return;
  listenersAttached = true;
  Notifications.addNotificationResponseReceivedListener((res) => {
    const data = res?.notification?.request?.content?.data as PushData | undefined;
    handlePushData(data);
  });
  Notifications.getLastNotificationResponseAsync().then((res) => {
    if (!res) return;
    const data = res.notification.request.content.data as PushData | undefined;
    setTimeout(() => handlePushData(data), 500);
  }).catch(() => {});
}
