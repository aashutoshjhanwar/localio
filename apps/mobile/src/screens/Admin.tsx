import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Api } from '../api/client';
import { theme } from '../theme';

type Status = 'open' | 'resolved' | 'dismissed';

export function AdminScreen() {
  const nav = useNavigation<any>();
  const [status, setStatus] = useState<Status>('open');
  const [reports, setReports] = useState<any[]>([]);
  const [stats, setStats] = useState({ open: 0, resolved: 0, dismissed: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const r = await Api.adminReports(status);
      setReports(r.reports);
      setStats(r.stats);
    } catch (e: any) {
      setError(e.message ?? 'Not authorised. Set ADMIN_PHONES on the server.');
    } finally { setLoading(false); setRefreshing(false); }
  }, [status]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  async function act(id: string, action: 'dismiss' | 'resolve' | 'take_down') {
    try { await Api.adminResolveReport(id, action); load(); }
    catch (e: any) { Alert.alert('Action failed', e.message ?? 'try again'); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  if (error) return <View style={styles.center}><Text style={styles.err}>{error}</Text></View>;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <TouchableOpacity style={styles.kycLink} onPress={() => nav.navigate('AdminKyc')}>
        <Text style={styles.kycLinkText}>✅ Review KYC submissions</Text>
        <Text style={{ color: '#fff' }}>›</Text>
      </TouchableOpacity>
      <View style={styles.stats}>
        <Stat label="Open" value={stats.open} tint={theme.colors.danger} />
        <Stat label="Resolved" value={stats.resolved} tint={theme.colors.success} />
        <Stat label="Dismissed" value={stats.dismissed} tint={theme.colors.textMuted} />
      </View>
      <View style={styles.tabs}>
        {(['open', 'resolved', 'dismissed'] as Status[]).map((s) => (
          <TouchableOpacity key={s} style={[styles.tab, status === s && styles.tabActive]} onPress={() => setStatus(s)}>
            <Text style={[styles.tabText, status === s && { color: '#fff' }]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={reports}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}
        ListEmptyComponent={<Text style={styles.empty}>Nothing to review 🎉</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={styles.reason}>🚩 {item.reason.toUpperCase()}</Text>
              <Text style={styles.meta}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.target}>{item.targetType} · {item.targetId.slice(0, 8)}…</Text>
            {item.notes && <Text style={styles.notes}>"{item.notes}"</Text>}
            <Text style={styles.reporter}>
              — {item.reporter?.name ?? 'Anonymous'} ({item.reporter?.phone ?? 'n/a'})
            </Text>
            {status === 'open' && (
              <View style={styles.actions}>
                <ActBtn label="Dismiss" onPress={() => act(item.id, 'dismiss')} />
                <ActBtn label="Resolve" onPress={() => act(item.id, 'resolve')} variant="ok" />
                <ActBtn label="Take down" onPress={() => act(item.id, 'take_down')} variant="danger" />
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

function Stat({ label, value, tint }: { label: string; value: number; tint: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statVal, { color: tint }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActBtn({ label, onPress, variant }: { label: string; onPress: () => void; variant?: 'ok' | 'danger' }) {
  const bg = variant === 'danger' ? theme.colors.danger : variant === 'ok' ? theme.colors.success : theme.colors.textMuted;
  return (
    <TouchableOpacity onPress={onPress} style={[styles.actBtn, { backgroundColor: bg }]}>
      <Text style={styles.actText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  err: { color: theme.colors.danger, textAlign: 'center' },
  stats: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 12, gap: 8 },
  statCell: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 12, alignItems: 'center' },
  statVal: { fontSize: 24, fontWeight: '800' },
  statLabel: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  tabs: { flexDirection: 'row', padding: 12, gap: 8 },
  tab: {
    flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 999,
    paddingVertical: 8, alignItems: 'center', backgroundColor: theme.colors.surface,
  },
  tabActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabText: { color: theme.colors.text, fontWeight: '700', textTransform: 'capitalize' },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 60 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 14, marginBottom: 10 },
  reason: { color: theme.colors.danger, fontWeight: '800' },
  target: { color: theme.colors.text, marginTop: 6, fontWeight: '600' },
  notes: { color: theme.colors.text, marginTop: 6, fontStyle: 'italic' },
  reporter: { color: theme.colors.textMuted, fontSize: 12, marginTop: 6 },
  meta: { color: theme.colors.textMuted, fontSize: 12 },
  actions: { flexDirection: 'row', marginTop: 12, gap: 6 },
  actBtn: { flex: 1, paddingVertical: 8, borderRadius: theme.radius.md, alignItems: 'center' },
  actText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  kycLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', margin: 12, backgroundColor: theme.colors.primary, padding: 14, borderRadius: theme.radius.md },
  kycLinkText: { color: '#fff', fontWeight: '800' },
});
