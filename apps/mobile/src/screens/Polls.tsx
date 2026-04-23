import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Api } from '../api/client';
import { useLocation } from '../hooks/useLocation';
import { theme } from '../theme';

export function PollsScreen() {
  const { coords } = useLocation();
  const nav = useNavigation<any>();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { polls } = await Api.polls(coords.lat, coords.lng);
      setRows(polls);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [coords.lat, coords.lng]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <FlatList
        data={rows}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={<Text style={styles.empty}>No polls yet. Start one — ask your neighbors.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => nav.navigate('PollDetail', { id: item.id })}>
            <Text style={styles.q}>📊 {item.question}</Text>
            <Text style={styles.meta}>
              {item.author?.name ?? 'Someone'} · {item._count?.votes ?? 0} votes
              {typeof item.distanceKm === 'number' ? ` · ${item.distanceKm.toFixed(1)} km` : ''}
            </Text>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.fab} onPress={() => nav.navigate('CreatePoll')}>
        <Text style={styles.fabPlus}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 64 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 14, marginBottom: 10 },
  q: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  meta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 6 },
  fab: { position: 'absolute', right: 20, bottom: 28, width: 58, height: 58, borderRadius: 29, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowOpacity: 0.2, shadowRadius: 4 },
  fabPlus: { color: '#fff', fontSize: 32, marginTop: -3 },
});
