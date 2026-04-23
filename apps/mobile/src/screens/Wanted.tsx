import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Api } from '../api/client';
import { useLocation } from '../hooks/useLocation';
import { theme } from '../theme';
import type { RootStackParamList } from '../nav/RootNav';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function WantedScreen() {
  const nav = useNavigation<Nav>();
  const { coords } = useLocation();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try { const r = await Api.wantedList(coords.lat, coords.lng, 25); setRows(r.wanted); }
    catch {} finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { load(); }, [coords.lat, coords.lng]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <FlatList
        data={rows}
        keyExtractor={(w) => w.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={<Text style={styles.empty}>No open requests nearby. Be the first to ask!</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => nav.navigate('WantedDetail', { id: item.id })}>
            <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
            <View style={styles.row}>
              <Text style={styles.cat}>{item.category}</Text>
              {item.maxBudgetPaise ? (
                <Text style={styles.budget}>up to ₹{(item.maxBudgetPaise / 100).toLocaleString('en-IN')}</Text>
              ) : <Text style={styles.budget}>Open budget</Text>}
              {typeof item.distanceKm === 'number' && <Text style={styles.meta}>· {item.distanceKm.toFixed(1)} km</Text>}
            </View>
            <Text style={styles.who}>{item.buyer?.name ?? 'Neighbor'}</Text>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.fab} onPress={() => nav.navigate('CreateWanted')}>
        <Text style={styles.fabPlus}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 64 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 14, marginBottom: 10 },
  title: { fontSize: 16, fontWeight: '800', color: theme.colors.text },
  desc: { color: theme.colors.text, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8, flexWrap: 'wrap' },
  cat: { color: theme.colors.primary, fontWeight: '700', fontSize: 12, textTransform: 'capitalize' },
  budget: { color: theme.colors.text, fontWeight: '700', fontSize: 12 },
  meta: { color: theme.colors.textMuted, fontSize: 12 },
  who: { color: theme.colors.textMuted, fontSize: 12, marginTop: 6 },
  fab: { position: 'absolute', right: 20, bottom: 28, width: 58, height: 58, borderRadius: 29, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowOpacity: 0.2, shadowRadius: 4 },
  fabPlus: { color: '#fff', fontSize: 32, marginTop: -3 },
});
