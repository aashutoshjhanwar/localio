import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from './src/state/auth';
import { RootNav } from './src/nav/RootNav';
import { theme } from './src/theme';
import { attachPushListeners, navRef, registerPushToken } from './src/push';
import { useI18n } from './src/i18n';
import type { RootStackParamList } from './src/nav/RootNav';

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['localio://', 'https://localio.app', 'https://www.localio.app'],
  config: {
    screens: {
      ListingDetail: 'listing/:id',
      ServiceDetail: 'service/:id',
      PostDetail: 'post/:id',
      PollDetail: 'poll/:id',
      EventDetail: 'event/:id',
      UserProfile: 'user/:id',
    },
  },
};

export default function App() {
  const { hydrate, hydrating, token } = useAuth();
  const hydrateI18n = useI18n((s) => s.hydrate);

  useEffect(() => { hydrate(); hydrateI18n(); }, [hydrate, hydrateI18n]);
  useEffect(() => {
    if (token) registerPushToken().catch(() => {});
  }, [token]);

  if (hydrating) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg }}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navRef} linking={linking} onReady={attachPushListeners}>
        <RootNav />
        <StatusBar style="dark" />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
