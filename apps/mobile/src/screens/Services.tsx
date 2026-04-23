import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ScrollView, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Api } from '../api/client';
import { useLocation } from '../hooks/useLocation';
import { theme } from '../theme';
import { TrustBadge } from '../components/TrustBadge';
import { serviceIcon } from '../utils/serviceIcons';
import type { RootStackParamList } from '../nav/RootNav';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ServicesScreen() {
  const { coords } = useLocation();
  const nav = useNavigation<Nav>();
  const [cats, setCats] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | undefined>();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { Api.categories().then((r) => setCats(r.services)).catch(() => {}); }, []);

  const load = useCallback(async () => {
    try {
      const { services: s } = await Api.services({
        lat: coords.lat, lng: coords.lng, radiusKm: 15, category: selected,
      });
      setServices(s);
    } catch { /* noop */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [coords.lat, coords.lng, selected]);

  useEffect(() => { load(); }, [load]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tileRow}>
        <TouchableOpacity style={[styles.tile, !selected && styles.tileActive]} onPress={() => setSelected(undefined)}>
          <View style={[styles.tileIcon, { backgroundColor: theme.colors.primarySoft }]}>
            <Text style={styles.tileIconText}>✨</Text>
          </View>
          <Text style={[styles.tileLabel, !selected && styles.tileLabelActive]}>All</Text>
        </TouchableOpacity>
        {cats.map((c) => {
          const ic = serviceIcon(c.key);
          const active = selected === c.key;
          return (
            <TouchableOpacity
              key={c.key}
              style={[styles.tile, active && styles.tileActive]}
              onPress={() => setSelected(c.key)}
            >
              <View style={[styles.tileIcon, { backgroundColor: ic.bg }]}>
                <Text style={styles.tileIconText}>{ic.icon}</Text>
              </View>
              <Text style={[styles.tileLabel, active && styles.tileLabelActive]} numberOfLines={1}>{c.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={services}
          keyExtractor={(s) => s.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={styles.empty}>No providers in this radius yet.</Text>}
          renderItem={({ item }) => {
            const ic = serviceIcon(item.category);
            return (
            <TouchableOpacity style={styles.card} onPress={() => nav.navigate('ServiceDetail', { id: item.id })}>
              <View style={[styles.avatar, { backgroundColor: ic.bg }]}><Text style={{ fontSize: 28 }}>{ic.icon}</Text></View>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {item.ratingAvg ? `⭐ ${item.ratingAvg.toFixed(1)} (${item.ratingCount})` : 'New'}
                {item.distanceKm !== undefined ? ` · ${item.distanceKm.toFixed(1)}km` : ''}
              </Text>
              <Text style={styles.price} numberOfLines={1}>
                {item.priceFrom ? `From ₹${(item.priceFrom / 100).toLocaleString('en-IN')}` : 'Ask price'}
              </Text>
              {item.provider && (
                <View style={{ marginTop: 6 }}>
                  <TrustBadge score={item.provider.trustScore} kycVerified={item.provider.kycVerified} />
                </View>
              )}
            </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tileRow: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 8, gap: 6 },
  tile: {
    alignItems: 'center', width: 74, marginRight: 4, paddingVertical: 6, borderRadius: theme.radius.lg,
  },
  tileActive: { backgroundColor: theme.colors.primarySoft },
  tileIcon: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center',
    marginBottom: 6, ...theme.shadow.sm,
  },
  tileIconText: { fontSize: 26 },
  tileLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.text, textAlign: 'center' },
  tileLabelActive: { color: theme.colors.primaryDark },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 60 },
  card: {
    flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 12,
    ...theme.shadow.sm,
  },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#EEE', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 14, fontWeight: '700', color: theme.colors.text, textAlign: 'center' },
  meta: { color: theme.colors.textMuted, marginTop: 2, fontSize: 11, textAlign: 'center' },
  price: { color: theme.colors.primary, fontWeight: '700', marginTop: 4, fontSize: 12 },
});
