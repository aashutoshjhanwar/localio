import React, { useEffect, useLayoutEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Api } from '../api/client';
import { useLocation } from '../hooks/useLocation';
import { theme } from '../theme';
import type { RootStackParamList } from '../nav/RootNav';

type R = RouteProp<RootStackParamList, 'CategoryFeed'>;
type Nav = NativeStackNavigationProp<RootStackParamList>;

export function CategoryFeedScreen() {
  const { params } = useRoute<R>();
  const nav = useNavigation<Nav>();
  const { coords } = useLocation();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    nav.setOptions({ title: params.label });
  }, [nav, params.label]);

  useEffect(() => {
    const q = { lat: coords.lat, lng: coords.lng, radiusKm: 25, category: params.key };
    const p = params.tab === 'listings' ? Api.listings(q) : Api.services(q);
    p.then((r: any) => setItems(r.listings ?? r.services ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.tab, params.key, coords.lat, coords.lng]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      data={items}
      keyExtractor={(x) => x.id}
      contentContainerStyle={{ padding: 12 }}
      ListEmptyComponent={<Text style={styles.empty}>Nothing here yet.</Text>}
      renderItem={({ item }) => params.tab === 'listings' ? (
        <TouchableOpacity style={styles.row} onPress={() => nav.navigate('ListingDetail', { id: item.id })}>
          {item.images?.[0] ? <Image source={{ uri: item.images[0] }} style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbPh]}><Text>📦</Text></View>}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.price}>₹{(item.priceInPaise / 100).toLocaleString('en-IN')}</Text>
            {item.distanceKm !== undefined && <Text style={styles.meta}>{item.distanceKm.toFixed(1)} km</Text>}
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.row} onPress={() => nav.navigate('ServiceDetail', { id: item.id })}>
          <View style={[styles.thumb, styles.thumbPh]}><Text style={{ fontSize: 22 }}>🛠️</Text></View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.meta}>
              {item.ratingAvg ? `⭐ ${item.ratingAvg.toFixed(1)}` : 'New'}
              {item.distanceKm !== undefined ? ` · ${item.distanceKm.toFixed(1)} km` : ''}
            </Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 60 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 12, marginBottom: 10 },
  thumb: { width: 64, height: 64, borderRadius: theme.radius.md, backgroundColor: '#EEE' },
  thumbPh: { justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  price: { color: theme.colors.primary, fontWeight: '800', marginTop: 2 },
  meta: { color: theme.colors.textMuted, marginTop: 4, fontSize: 13 },
});
