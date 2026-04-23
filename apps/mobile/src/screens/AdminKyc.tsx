import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Api } from '../api/client';
import { theme } from '../theme';

export function AdminKycScreen() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const r = await Api.pendingKyc();
      setRows(r.submissions);
    } catch (e: any) { setError(e.message ?? 'Not authorised.'); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const approve = async (id: string) => {
    try { await Api.approveKyc(id); load(); }
    catch (e: any) { Alert.alert('Error', e.message ?? 'try again'); }
  };
  const reject = (id: string) => {
    if (typeof Alert.prompt === 'function') {
      Alert.prompt('Reject KYC', 'Reason (optional)', async (reason) => {
        try { await Api.rejectKyc(id, reason || undefined); load(); }
        catch (e: any) { Alert.alert('Error', e.message ?? 'try again'); }
      });
    } else {
      (async () => {
        try { await Api.rejectKyc(id); load(); }
        catch (e: any) { Alert.alert('Error', e.message ?? 'try again'); }
      })();
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  if (error) return <View style={styles.center}><Text style={styles.err}>{error}</Text></View>;

  return (
    <FlatList
      data={rows}
      keyExtractor={(s) => s.id}
      contentContainerStyle={{ padding: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}
      ListEmptyComponent={<Text style={styles.empty}>No pending KYC submissions 🎉</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.who}>{item.user?.name ?? 'User'} · {item.user?.phone ?? ''}</Text>
          <Text style={styles.meta}>{item.docType.toUpperCase()} · {new Date(item.createdAt).toLocaleString('en-IN')}</Text>
          <View style={styles.photoRow}>
            <Image source={{ uri: item.docUrl }} style={styles.photo} />
            <Image source={{ uri: item.selfieUrl }} style={styles.photo} />
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actBtn, { backgroundColor: theme.colors.success }]} onPress={() => approve(item.id)}>
              <Text style={styles.actText}>Approve</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actBtn, { backgroundColor: theme.colors.danger }]} onPress={() => reject(item.id)}>
              <Text style={styles.actText}>Reject</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  err: { color: theme.colors.danger, textAlign: 'center' },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 60 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 14, marginBottom: 10 },
  who: { color: theme.colors.text, fontWeight: '800' },
  meta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  photoRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  photo: { flex: 1, height: 140, borderRadius: theme.radius.md, backgroundColor: theme.colors.border },
  actions: { flexDirection: 'row', marginTop: 12, gap: 8 },
  actBtn: { flex: 1, paddingVertical: 10, borderRadius: theme.radius.md, alignItems: 'center' },
  actText: { color: '#fff', fontWeight: '800' },
});
