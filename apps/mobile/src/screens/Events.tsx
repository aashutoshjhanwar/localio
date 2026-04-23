import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Api } from '../api/client';
import { useLocation } from '../hooks/useLocation';
import { theme } from '../theme';

export function EventsScreen() {
  const { coords } = useLocation();
  const nav = useNavigation<any>();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { events } = await Api.events(coords.lat, coords.lng, 20);
      setEvents(events);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [coords.lat, coords.lng]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={<Text style={styles.empty}>No upcoming events nearby. Be the first!</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => nav.navigate('EventDetail', { id: item.id })}>
            <View style={styles.dateBox}>
              <Text style={styles.dateMonth}>{new Date(item.startsAt).toLocaleString('en-IN', { month: 'short' }).toUpperCase()}</Text>
              <Text style={styles.dateDay}>{new Date(item.startsAt).getDate()}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.meta}>{new Date(item.startsAt).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', weekday: 'short' })}</Text>
              <Text style={styles.meta} numberOfLines={1}>📍 {item.locationText}</Text>
              <Text style={styles.meta}>👥 {item._count?.rsvps ?? 0} going{typeof item.distanceKm === 'number' ? ` · ${item.distanceKm.toFixed(1)} km` : ''}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.fab} onPress={() => nav.navigate('CreateEvent')}>
        <Text style={styles.fabPlus}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 64 },
  card: { flexDirection: 'row', backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 12, marginBottom: 10 },
  dateBox: { width: 60, backgroundColor: theme.colors.primary, borderRadius: theme.radius.md, padding: 8, alignItems: 'center' },
  dateMonth: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  dateDay: { color: '#fff', fontSize: 22, fontWeight: '900', marginTop: 2 },
  title: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  meta: { color: theme.colors.textMuted, marginTop: 3, fontSize: 13 },
  fab: { position: 'absolute', right: 20, bottom: 28, width: 58, height: 58, borderRadius: 29, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowOpacity: 0.2, shadowRadius: 4 },
  fabPlus: { color: '#fff', fontSize: 32, marginTop: -3 },
});
