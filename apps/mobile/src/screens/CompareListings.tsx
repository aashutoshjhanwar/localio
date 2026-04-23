import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Image, ActivityIndicator, TouchableOpacity } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Api } from '../api/client';
import { theme } from '../theme';
import type { RootStackParamList } from '../nav/RootNav';

type R = RouteProp<RootStackParamList, 'CompareListings'>;

export function CompareListingsScreen() {
  const { params } = useRoute<R>();
  const nav = useNavigation<any>();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    Promise.all(params.ids.map((id) => Api.listing(id).then((r) => r.listing).catch(() => null)))
      .then((rs) => { if (live) { setItems(rs.filter(Boolean)); setLoading(false); } });
    return () => { live = false; };
  }, [params.ids]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  if (items.length < 2) return (
    <View style={styles.center}>
      <Text style={styles.empty}>Pick at least 2 listings to compare.</Text>
    </View>
  );

  const allAttrKeys = Array.from(new Set(items.flatMap((l) => Object.keys(l.attributes ?? {}))));
  const specs: Array<{ label: string; get: (l: any) => string }> = [
    { label: 'Price', get: (l) => `₹${(l.priceInPaise / 100).toLocaleString('en-IN')}` },
    { label: 'Category', get: (l) => l.category ?? '—' },
    { label: 'Seller', get: (l) => l.seller?.name ?? '—' },
    { label: 'Distance', get: (l) => l.distanceKm != null ? `${l.distanceKm.toFixed(1)} km` : '—' },
    { label: 'Posted', get: (l) => l.createdAt ? new Date(l.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—' },
    ...allAttrKeys.map((k) => ({
      label: k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()),
      get: (l: any) => {
        const v = l.attributes?.[k];
        return v === undefined || v === null || v === '' ? '—' : String(v);
      },
    })),
  ];

  return (
    <ScrollView horizontal style={{ backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: 12 }}>
      <View>
        <View style={styles.headerRow}>
          <View style={[styles.cell, styles.labelCell, { borderColor: 'transparent' }]} />
          {items.map((l) => (
            <TouchableOpacity key={l.id} style={styles.cell} onPress={() => nav.navigate('ListingDetail', { id: l.id })}>
              {l.images?.[0] ? (
                <Image source={{ uri: l.images[0] }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ fontSize: 28 }}>📦</Text>
                </View>
              )}
              <Text style={styles.titleText} numberOfLines={2}>{l.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {specs.map((s, idx) => (
          <View key={s.label} style={[styles.row, idx % 2 === 0 && styles.rowAlt]}>
            <View style={[styles.cell, styles.labelCell]}>
              <Text style={styles.label}>{s.label}</Text>
            </View>
            {items.map((l) => (
              <View key={l.id + s.label} style={styles.cell}>
                <Text style={styles.value} numberOfLines={2}>{s.get(l)}</Text>
              </View>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const CELL_WIDTH = 180;
const LABEL_WIDTH = 120;

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: theme.colors.bg },
  empty: { color: theme.colors.textMuted, textAlign: 'center', fontSize: 14 },
  headerRow: { flexDirection: 'row', marginBottom: 6 },
  row: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.border,
  },
  rowAlt: { backgroundColor: theme.colors.surface },
  cell: {
    width: CELL_WIDTH, padding: 12, justifyContent: 'center',
    borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.colors.border,
  },
  labelCell: { width: LABEL_WIDTH, backgroundColor: theme.colors.primarySoft, borderLeftWidth: 0 },
  thumb: { width: CELL_WIDTH - 24, height: 120, borderRadius: theme.radius.md, backgroundColor: '#EEE' },
  titleText: { marginTop: 8, fontWeight: '800', color: theme.colors.text, fontSize: 14 },
  label: { fontWeight: '800', color: theme.colors.primaryDark, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { color: theme.colors.text, fontSize: 14 },
});
