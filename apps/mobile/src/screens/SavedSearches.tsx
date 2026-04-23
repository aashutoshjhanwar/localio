import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Api } from '../api/client';
import { theme } from '../theme';

export function SavedSearchesScreen() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Api.savedSearches().then((r) => setRows(r.savedSearches)).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const del = async (id: string) => {
    try { await Api.deleteSavedSearch(id); setRows((r) => r.filter((x) => x.id !== id)); }
    catch (e: any) { Alert.alert('Error', e.message ?? 'Try again'); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      data={rows}
      keyExtractor={(s) => s.id}
      ListHeaderComponent={
        <Text style={styles.intro}>
          You'll get a notification whenever a new {rows.length === 0 ? 'listing or service' : 'match'} is posted nearby.
        </Text>
      }
      ListEmptyComponent={<Text style={styles.empty}>No saved searches yet. Search something and hit 🔔 Save.</Text>}
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>🔔 {item.label}</Text>
            <Text style={styles.meta}>
              {item.kind === 'both' ? 'Listings + Services' : item.kind === 'listing' ? 'Listings' : 'Services'}
              {item.category ? ` · ${item.category}` : ''}
              {` · ${item.radiusKm}km`}
            </Text>
            {item.lastNotifiedAt && (
              <Text style={styles.meta}>Last alert: {new Date(item.lastNotifiedAt).toLocaleDateString()}</Text>
            )}
          </View>
          <TouchableOpacity style={styles.delBtn} onPress={() => del(item.id)}>
            <Text style={styles.delText}>Remove</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  intro: { color: theme.colors.textMuted, marginBottom: 12 },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 12, marginBottom: 8 },
  label: { fontWeight: '700', color: theme.colors.text, fontSize: 15 },
  meta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 3 },
  delBtn: { borderWidth: 1, borderColor: theme.colors.danger, borderRadius: theme.radius.md, paddingHorizontal: 12, paddingVertical: 6 },
  delText: { color: theme.colors.danger, fontWeight: '700', fontSize: 13 },
});
