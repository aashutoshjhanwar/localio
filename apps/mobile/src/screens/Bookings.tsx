import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Api } from '../api/client';
import { useAuth } from '../state/auth';
import { RateModal } from '../components/RateModal';
import { theme } from '../theme';

type Role = 'customer' | 'provider';

export function BookingsScreen() {
  const [role, setRole] = useState<Role>('customer');
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rateFor, setRateFor] = useState<any | null>(null);
  const me = useAuth((s) => s.user);

  const load = useCallback(async () => {
    try {
      const { bookings: b } = await Api.bookings(role);
      setBookings(b);
    } catch { /* noop */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [role]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  async function setStatus(id: string, status: string) {
    try {
      await Api.setBookingStatus(id, status);
      load();
    } catch (e: any) { Alert.alert('Could not update', e.message ?? 'try again'); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={styles.tabs}>
        {(['customer', 'provider'] as Role[]).map((r) => (
          <TouchableOpacity key={r} style={[styles.tab, role === r && styles.tabActive]} onPress={() => setRole(r)}>
            <Text style={[styles.tabText, role === r && { color: '#fff' }]}>
              {r === 'customer' ? 'My requests' : 'Incoming'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}
          ListEmptyComponent={<Text style={styles.empty}>No bookings yet.</Text>}
          renderItem={({ item }) => {
            const other = role === 'customer' ? item.provider : item.customer;
            const isProvider = item.providerId === me?.id;
            return (
              <View style={styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.name}>{other?.name ?? 'User'}</Text>
                  <Text style={[styles.status, statusColor(item.status)]}>{item.status}</Text>
                </View>
                {item.notes && <Text style={styles.notes}>"{item.notes}"</Text>}
                {item.priceInPaise && <Text style={styles.price}>₹{(item.priceInPaise / 100).toLocaleString('en-IN')}</Text>}
                <Text style={styles.meta}>{new Date(item.createdAt).toLocaleString()}</Text>
                <View style={styles.actions}>
                  {isProvider && item.status === 'requested' && (
                    <>
                      <ActionBtn label="Accept" onPress={() => setStatus(item.id, 'accepted')} />
                      <ActionBtn label="Reject" onPress={() => setStatus(item.id, 'rejected')} variant="danger" />
                    </>
                  )}
                  {isProvider && item.status === 'accepted' && (
                    <ActionBtn label="Mark completed" onPress={() => setStatus(item.id, 'completed')} />
                  )}
                  {!isProvider && (item.status === 'requested' || item.status === 'accepted') && (
                    <ActionBtn label="Cancel" onPress={() => setStatus(item.id, 'cancelled')} variant="danger" />
                  )}
                  {!isProvider && item.status === 'completed' && (
                    <ActionBtn label="⭐ Rate" onPress={() => setRateFor(item)} />
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
      {rateFor && (
        <RateModal
          visible={!!rateFor}
          onClose={() => setRateFor(null)}
          toId={rateFor.providerId}
          context="service"
          contextId={rateFor.serviceId}
          title={`Rate ${rateFor.provider?.name ?? 'the provider'}`}
          onDone={load}
        />
      )}
    </View>
  );
}

function ActionBtn({ label, onPress, variant }: { label: string; onPress: () => void; variant?: 'danger' }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.actBtn, variant === 'danger' && { backgroundColor: theme.colors.danger }]}
    >
      <Text style={styles.actText}>{label}</Text>
    </TouchableOpacity>
  );
}

function statusColor(s: string) {
  switch (s) {
    case 'accepted': return { color: theme.colors.success };
    case 'rejected':
    case 'cancelled': return { color: theme.colors.danger };
    case 'completed': return { color: theme.colors.accent };
    default: return { color: theme.colors.textMuted };
  }
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', padding: 12, gap: 8 },
  tab: {
    flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 999,
    paddingVertical: 10, alignItems: 'center', backgroundColor: theme.colors.surface,
  },
  tabActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabText: { color: theme.colors.text, fontWeight: '700' },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 60 },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    padding: 14, marginBottom: 10,
  },
  name: { fontWeight: '800', color: theme.colors.text, fontSize: 16 },
  status: { fontWeight: '700', textTransform: 'uppercase', fontSize: 12 },
  notes: { color: theme.colors.text, marginTop: 6, fontStyle: 'italic' },
  price: { color: theme.colors.primary, fontWeight: '700', marginTop: 6 },
  meta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 4 },
  actions: { flexDirection: 'row', marginTop: 10, gap: 8 },
  actBtn: {
    backgroundColor: theme.colors.primary, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: theme.radius.md,
  },
  actText: { color: '#fff', fontWeight: '700' },
});
