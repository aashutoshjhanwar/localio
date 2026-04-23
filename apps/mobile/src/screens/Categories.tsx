import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Api } from '../api/client';
import { theme } from '../theme';
import type { RootStackParamList } from '../nav/RootNav';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'listings' | 'services';

export function CategoriesScreen() {
  const nav = useNavigation<Nav>();
  const [tab, setTab] = useState<Tab>('listings');
  const [cats, setCats] = useState<{ listings: any[]; services: any[] }>({ listings: [], services: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Api.categories().then(setCats).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;

  const data = cats[tab] ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={styles.tabs}>
        {(['listings', 'services'] as Tab[]).map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && { color: '#fff' }]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={data}
        keyExtractor={(c) => c.key}
        numColumns={3}
        contentContainerStyle={{ padding: 12 }}
        columnWrapperStyle={{ gap: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.tile}
            onPress={() => nav.navigate('CategoryFeed', { tab, key: item.key, label: item.label })}
          >
            <Text style={styles.icon}>{item.icon}</Text>
            <Text style={styles.label}>{item.label}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabs: { flexDirection: 'row', padding: 12, gap: 8 },
  tab: {
    flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 999,
    paddingVertical: 10, alignItems: 'center', backgroundColor: theme.colors.surface,
  },
  tabActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabText: { color: theme.colors.text, fontWeight: '700', textTransform: 'capitalize' },
  tile: {
    flex: 1, aspectRatio: 1, backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    marginBottom: 8, justifyContent: 'center', alignItems: 'center', padding: 10,
  },
  icon: { fontSize: 32 },
  label: { marginTop: 6, color: theme.colors.text, fontWeight: '700', textAlign: 'center', fontSize: 13 },
});
