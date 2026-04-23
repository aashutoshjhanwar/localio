import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Api } from '../api/client';
import { theme } from '../theme';
import { CounterOfferModal } from '../components/CounterOfferModal';
import type { RootStackParamList } from '../nav/RootNav';

type Tab = 'received' | 'sent';
type N = NativeStackNavigationProp<RootStackParamList, any>;

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Pending',    color: '#8a6500', bg: '#fff4d6' },
  countered: { label: 'Countered',  color: '#7a3e00', bg: '#ffe4c4' },
  accepted:  { label: 'Accepted',   color: '#0a6b3a', bg: '#d1fadf' },
  declined:  { label: 'Declined',   color: '#7a1f1f', bg: '#fde2e2' },
  withdrawn: { label: 'Withdrawn',  color: theme.colors.textMuted, bg: theme.colors.surface },
};

function formatAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  if (d < 7 * 86400) return `${Math.floor(d / 86400)}d`;
  return new Date(iso).toLocaleDateString('en-IN');
}

export function OffersInboxScreen() {
  const nav = useNavigation<N>();
  const [tab, setTab] = useState<Tab>('received');
  const [received, setReceived] = useState<any[] | null>(null);
  const [sent, setSent] = useState<any[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [counterFor, setCounterFor] = useState<any | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([Api.receivedOffers(), Api.myOffers()]);
      setReceived(r.offers);
      setSent(s.offers);
    } catch { /* noop */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  async function wrap(fn: () => Promise<any>) {
    try { await fn(); await load(); }
    catch (e: any) { Alert.alert('Error', e.message ?? 'try again'); }
  }

  const data = tab === 'received' ? received : sent;
  const pendingRecv = (received ?? []).filter((o) => o.status === 'pending').length;
  const actionableSent = (sent ?? []).filter((o) => o.status === 'countered').length;

  if (data === null) {
    return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={styles.tabs}>
        <TabBtn active={tab === 'received'} onPress={() => setTab('received')}
          label="Received" badge={pendingRecv} />
        <TabBtn active={tab === 'sent'} onPress={() => setTab('sent')}
          label="Sent" badge={actionableSent} />
      </View>

      <FlatList
        data={data}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ fontSize: 44 }}>💸</Text>
            <Text style={styles.emptyTitle}>
              {tab === 'received' ? 'No offers yet' : 'You haven\u2019t made any offers'}
            </Text>
            <Text style={styles.emptyHint}>
              {tab === 'received'
                ? 'When a neighbor bids on your listing, it shows up here.'
                : 'Tap "Make an offer" on a listing to negotiate.'}
            </Text>
          </View>
        }
        renderItem={({ item: o }) => {
          const meta = STATUS_META[o.status] ?? STATUS_META.pending;
          const isReceived = tab === 'received';
          const counterpart = isReceived ? o.buyer : null;
          const amt = `\u20B9${(o.amountInPaise / 100).toLocaleString('en-IN')}`;
          const counterAmt = o.counterAmountPaise != null
            ? `\u20B9${(o.counterAmountPaise / 100).toLocaleString('en-IN')}` : null;
          const img = o.listing?.images?.[0];
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => nav.navigate('ListingDetail', { id: o.listing?.id ?? o.listingId })}
            >
              <View style={styles.row}>
                {img ? (
                  <Image source={{ uri: img }} style={styles.thumb} />
                ) : (
                  <View style={[styles.thumb, { justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 22 }}>📦</Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text numberOfLines={1} style={styles.title}>{o.listing?.title ?? 'Listing'}</Text>
                  <Text style={styles.listPrice}>
                    {`asking ₹${((o.listing?.priceInPaise ?? 0) / 100).toLocaleString('en-IN')}`}
                  </Text>
                  {counterpart && (
                    <Text style={styles.from}>from {counterpart.name ?? 'Neighbor'}</Text>
                  )}
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.amount}>{amt}</Text>
                  <Text style={styles.time}>{formatAgo(o.createdAt)}</Text>
                </View>
              </View>

              <View style={styles.statusRow}>
                <Text style={[styles.statusPill, { color: meta.color, backgroundColor: meta.bg }]}>
                  {meta.label.toUpperCase()}
                </Text>
                {counterAmt && (
                  <Text style={styles.counterInline}>counter {counterAmt}</Text>
                )}
              </View>

              {o.message ? <Text style={styles.msg}>"{o.message}"</Text> : null}
              {o.counterMessage ? <Text style={styles.counterMsg}>seller: "{o.counterMessage}"</Text> : null}

              {isReceived && o.status === 'pending' && (
                <View style={styles.actions}>
                  <ActionBtn label="Accept" color={theme.colors.success}
                    onPress={() => wrap(() => Api.acceptOffer(o.id))} />
                  <ActionBtn label="Counter" color={theme.colors.primary}
                    onPress={() => setCounterFor(o)} />
                  <ActionBtn label="Decline" color={theme.colors.danger}
                    onPress={() => wrap(() => Api.declineOffer(o.id))} />
                </View>
              )}

              {!isReceived && o.status === 'countered' && (
                <View style={styles.actions}>
                  <ActionBtn label="Accept counter" color={theme.colors.success}
                    onPress={() => wrap(() => Api.acceptCounter(o.id))} />
                  <ActionBtn label="Walk away" color={theme.colors.danger}
                    onPress={() => wrap(() => Api.withdrawOffer(o.id))} />
                </View>
              )}

              {!isReceived && o.status === 'pending' && (
                <View style={styles.actions}>
                  <ActionBtn label="Withdraw" color={theme.colors.danger}
                    onPress={() => wrap(() => Api.withdrawOffer(o.id))} />
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      <CounterOfferModal
        visible={!!counterFor}
        onClose={() => setCounterFor(null)}
        offerId={counterFor?.id ?? null}
        buyerName={counterFor?.buyer?.name ?? 'Buyer'}
        buyerOfferPaise={counterFor?.amountInPaise ?? 0}
        askingPricePaise={counterFor?.listing?.priceInPaise ?? 0}
        onSent={() => { setCounterFor(null); load(); }}
      />
    </View>
  );
}

function TabBtn({ active, onPress, label, badge }: { active: boolean; onPress: () => void; label: string; badge: number }) {
  return (
    <TouchableOpacity style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      {badge > 0 && (
        <View style={styles.tabBadge}>
          <Text style={styles.tabBadgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function ActionBtn({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: color }]} onPress={onPress}>
      <Text style={styles.actionBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabs: {
    flexDirection: 'row', gap: 8, padding: 12, paddingBottom: 8,
    backgroundColor: theme.colors.bg,
  },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface, alignItems: 'center',
    borderWidth: 1, borderColor: theme.colors.border,
    flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  tabActive: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  tabText: { fontWeight: '700', color: theme.colors.textMuted },
  tabTextActive: { color: theme.colors.primaryDark },
  tabBadge: {
    backgroundColor: theme.colors.primary, borderRadius: 999,
    paddingHorizontal: 7, paddingVertical: 1, minWidth: 20, alignItems: 'center',
  },
  tabBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  card: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius.lg,
    borderWidth: 1, borderColor: theme.colors.border, padding: 12, marginBottom: 10,
    shadowColor: '#1C1A17', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 56, height: 56, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface },
  title: { fontSize: 15, fontWeight: '800', color: theme.colors.text },
  listPrice: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  from: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  amount: { fontSize: 18, fontWeight: '900', color: theme.colors.primary },
  time: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  statusPill: {
    fontSize: 10, fontWeight: '900', letterSpacing: 0.6,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden',
  },
  counterInline: { fontSize: 12, fontWeight: '700', color: '#8a6500' },
  msg: { marginTop: 6, color: theme.colors.text, fontStyle: 'italic', fontSize: 13 },
  counterMsg: { marginTop: 2, color: '#6a4f00', fontStyle: 'italic', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, paddingVertical: 9, borderRadius: theme.radius.md, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  empty: { alignItems: 'center', padding: 40, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.text, marginTop: 4 },
  emptyHint: { color: theme.colors.textMuted, textAlign: 'center', fontSize: 13, lineHeight: 18 },
});
