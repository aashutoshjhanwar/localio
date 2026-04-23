import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Api } from '../api/client';
import { useLocation } from '../hooks/useLocation';
import { theme } from '../theme';
import type { RootStackParamList } from '../nav/RootNav';

type N = NativeStackNavigationProp<RootStackParamList, any>;

const RADII = [5, 10, 25, 50] as const;

function formatAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  const days = Math.floor(d / 86400);
  return `${days}d ago`;
}

export function DealsScreen() {
  const nav = useNavigation<N>();
  const { coords } = useLocation();
  const [items, setItems] = useState<any[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [radius, setRadius] = useState<number>(15);

  const load = useCallback(async () => {
    try {
      const r = await Api.dealsNearby(coords.lat, coords.lng, radius, 50);
      setItems(r.listings);
    } catch { setItems([]); }
  }, [coords.lat, coords.lng, radius]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true); await load(); setRefreshing(false);
  };

  if (items === null) {
    return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={styles.chipRow}>
        {RADII.map((r) => (
          <TouchableOpacity
            key={r}
            onPress={() => setRadius(r)}
            style={[styles.chip, radius === r && styles.chipActive]}
          >
            <Text style={[styles.chipText, radius === r && styles.chipTextActive]}>{r} km</Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={items}
        keyExtractor={(l) => l.id}
        numColumns={2}
        columnWrapperStyle={{ paddingHorizontal: 10, gap: 10 }}
        contentContainerStyle={{ paddingBottom: 24, paddingTop: 4 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 44 }}>📉</Text>
            <Text style={styles.emptyTitle}>No deals within {radius} km</Text>
            <Text style={styles.emptyHint}>Try expanding the radius — or save a search to get pinged when prices drop.</Text>
          </View>
        }
        renderItem={({ item: l }) => {
          const img = l.images?.[0];
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => nav.navigate('ListingDetail', { id: l.id })}
            >
              <View>
                {img ? (
                  <Image source={{ uri: img }} style={styles.img} />
                ) : (
                  <View style={[styles.img, styles.imgPh]}><Text style={{ fontSize: 32 }}>📦</Text></View>
                )}
                <View style={styles.pctBadge}>
                  <Text style={styles.pctText}>↓ {l.percentOff}%</Text>
                </View>
              </View>
              <View style={{ padding: 8 }}>
                <View style={styles.priceRow}>
                  <Text style={styles.newPrice}>₹{(l.priceInPaise / 100).toLocaleString('en-IN')}</Text>
                  <Text style={styles.oldPrice}>₹{(l.previousPriceInPaise / 100).toLocaleString('en-IN')}</Text>
                </View>
                <Text style={styles.title} numberOfLines={2}>{l.title}</Text>
                <Text style={styles.meta}>
                  {l.distanceKm != null ? `${l.distanceKm.toFixed(1)} km` : ''}
                  {l.droppedAt ? ` · ${formatAgo(l.droppedAt)}` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  chipRow: {
    flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 6,
    backgroundColor: theme.colors.bg,
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
  },
  chipActive: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  chipText: { fontWeight: '700', color: theme.colors.textMuted, fontSize: 13 },
  chipTextActive: { color: theme.colors.primaryDark },
  card: {
    flex: 1, backgroundColor: theme.colors.card, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border, marginBottom: 10, overflow: 'hidden',
    shadowColor: '#1C1A17', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  img: { width: '100%', height: 140, backgroundColor: theme.colors.surface },
  imgPh: { justifyContent: 'center', alignItems: 'center' },
  pctBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: theme.colors.success ?? '#10b981',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999,
  },
  pctText: { color: '#fff', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  newPrice: { fontSize: 16, fontWeight: '900', color: theme.colors.primary },
  oldPrice: { fontSize: 12, fontWeight: '600', color: theme.colors.textMuted, textDecorationLine: 'line-through' },
  title: { fontSize: 13, fontWeight: '700', color: theme.colors.text, marginTop: 4 },
  meta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 4 },
  empty: { alignItems: 'center', padding: 48, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.text, marginTop: 4 },
  emptyHint: { color: theme.colors.textMuted, textAlign: 'center', fontSize: 13, lineHeight: 18 },
});
