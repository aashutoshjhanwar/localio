import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Api } from '../api/client';
import { theme } from '../theme';
import type { RootStackParamList } from '../nav/RootNav';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'listings' | 'services';

export function MyItemsScreen() {
  const nav = useNavigation<Nav>();
  const [tab, setTab] = useState<Tab>('listings');
  const [data, setData] = useState<{ listings: any[]; services: any[] }>({ listings: [], services: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await Api.myItems();
      setData(r);
    } catch { /* noop */ } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  async function setListingStatus(id: string, status: 'active' | 'sold' | 'closed') {
    try { await Api.updateListing(id, { status }); load(); }
    catch (e: any) { Alert.alert('Could not update', e.message ?? 'try again'); }
  }
  async function toggleServiceAvail(id: string, current: boolean) {
    try { await Api.updateService(id, { available: !current }); load(); }
    catch (e: any) { Alert.alert('Could not update', e.message ?? 'try again'); }
  }
  async function renew(id: string) {
    try { await Api.renewListing(id); load(); }
    catch (e: any) { Alert.alert('Could not renew', e.message ?? 'try again'); }
  }
  async function confirmDelete(id: string) {
    Alert.alert('Close listing?', 'This hides it from others. You can re-open by editing status.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close it', style: 'destructive', onPress: () => setListingStatus(id, 'closed') },
    ]);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;

  const items = tab === 'listings' ? data.listings : data.services;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={styles.tabs}>
        {(['listings', 'services'] as Tab[]).map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && { color: '#fff' }]}>
              {t} ({(data as any)[t]?.length ?? 0})
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={items}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}
        ListEmptyComponent={<Text style={styles.empty}>
          {tab === 'listings' ? 'No listings yet. Tap + on Feed to sell.' : 'No services yet. Offer one from Profile.'}
        </Text>}
        renderItem={({ item }) => tab === 'listings' ? (() => {
          const ageDays = (Date.now() - new Date(item.createdAt).getTime()) / 86_400_000;
          const daysLeft = Math.max(0, Math.ceil(30 - ageDays));
          const expired = item.status === 'active' && ageDays >= 30;
          const expiringSoon = item.status === 'active' && !expired && daysLeft <= 7;
          return (
          <View style={styles.card}>
            {expired && (
              <View style={styles.expiredBanner}>
                <Text style={styles.expiredText}>⏰ Expired — not visible to buyers. Renew to re-publish.</Text>
              </View>
            )}
            {expiringSoon && (
              <View style={styles.expiringBanner}>
                <Text style={styles.expiringText}>⏰ Expires in {daysLeft}d</Text>
              </View>
            )}
            <TouchableOpacity style={styles.row} onPress={() => nav.navigate('ListingDetail', { id: item.id })}>
              {item.images?.[0] ? <Image source={{ uri: item.images[0] }} style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbPh]}><Text>📦</Text></View>}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.price}>₹{(item.priceInPaise / 100).toLocaleString('en-IN')}</Text>
                <Text style={[styles.status, statusColor(item.status)]}>{item.status} · {item.views} views</Text>
              </View>
            </TouchableOpacity>
            <View style={styles.actions}>
              <ActionBtn label="Edit" onPress={() => nav.navigate('EditListing', { id: item.id })} />
              {(expired || expiringSoon) && <ActionBtn label="🔄 Renew" onPress={() => renew(item.id)} />}
              {item.status !== 'sold' && <ActionBtn label="Mark sold" onPress={() => setListingStatus(item.id, 'sold')} />}
              {item.status !== 'active' && <ActionBtn label="Re-open" onPress={() => setListingStatus(item.id, 'active')} />}
              {item.status === 'active' && <ActionBtn label="Close" onPress={() => confirmDelete(item.id)} variant="danger" />}
            </View>
          </View>
          );
        })() : (
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={() => nav.navigate('ServiceDetail', { id: item.id })}>
              <View style={[styles.thumb, styles.thumbPh]}><Text style={{ fontSize: 22 }}>🛠️</Text></View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.meta}>
                  {item.ratingAvg ? `⭐ ${item.ratingAvg.toFixed(1)} (${item.ratingCount})` : 'No ratings yet'}
                </Text>
                <Text style={[styles.status, item.available ? { color: theme.colors.success } : { color: theme.colors.textMuted }]}>
                  {item.available ? 'accepting requests' : 'paused'}
                </Text>
              </View>
            </TouchableOpacity>
            <View style={styles.actions}>
              <ActionBtn
                label={item.available ? 'Pause' : 'Resume'}
                onPress={() => toggleServiceAvail(item.id, item.available)}
                variant={item.available ? 'danger' : undefined}
              />
            </View>
          </View>
        )}
      />
    </View>
  );
}

function ActionBtn({ label, onPress, variant }: { label: string; onPress: () => void; variant?: 'danger' }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.actBtn, variant === 'danger' && { backgroundColor: theme.colors.danger }]}>
      <Text style={styles.actText}>{label}</Text>
    </TouchableOpacity>
  );
}

function statusColor(s: string) {
  if (s === 'active') return { color: theme.colors.success };
  if (s === 'sold') return { color: theme.colors.accent };
  return { color: theme.colors.textMuted };
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabs: { flexDirection: 'row', padding: 12, gap: 8 },
  tab: {
    flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 999,
    paddingVertical: 10, alignItems: 'center', backgroundColor: theme.colors.surface,
  },
  tabActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabText: { color: theme.colors.text, fontWeight: '700', textTransform: 'capitalize' },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 60 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 12, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 64, height: 64, borderRadius: theme.radius.md, backgroundColor: '#EEE' },
  thumbPh: { justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  price: { color: theme.colors.primary, fontWeight: '800', marginTop: 2 },
  meta: { color: theme.colors.textMuted, marginTop: 4, fontSize: 13 },
  status: { fontSize: 12, fontWeight: '700', marginTop: 4, textTransform: 'uppercase' },
  actions: { flexDirection: 'row', marginTop: 10, gap: 8 },
  actBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.md },
  actText: { color: '#fff', fontWeight: '700' },
  expiredBanner: {
    backgroundColor: (theme.colors as any).dangerSoft ?? '#FDECEA',
    padding: 8, borderRadius: theme.radius.sm, marginBottom: 8,
    borderWidth: 1, borderColor: theme.colors.danger,
  },
  expiredText: { color: theme.colors.danger, fontWeight: '800', fontSize: 12 },
  expiringBanner: {
    backgroundColor: (theme.colors as any).warningSoft ?? '#FFF4E5',
    padding: 8, borderRadius: theme.radius.sm, marginBottom: 8,
    borderWidth: 1, borderColor: theme.colors.accent ?? '#F5A623',
  },
  expiringText: { color: theme.colors.accent ?? '#F5A623', fontWeight: '800', fontSize: 12 },
});
