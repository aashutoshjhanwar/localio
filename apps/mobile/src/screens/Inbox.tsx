import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Api } from '../api/client';
import { theme } from '../theme';
import type { RootStackParamList } from '../nav/RootNav';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function InboxScreen() {
  const nav = useNavigation<Nav>();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await Api.notifications();
      setItems(r.notifications);
    } catch { /* noop */ } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  async function markAll() {
    try { await Api.markAllNotificationsRead(); load(); } catch { /* noop */ }
  }

  function open(n: any) {
    Api.markNotificationRead(n.id).catch(() => {});
    const data = parseData(n.data) ?? {};
    const t = n.type as string;

    if (t === 'chat' && data.conversationId) {
      nav.navigate('ChatRoom', { conversationId: data.conversationId }); return;
    }
    if (t === 'booking_request' || t === 'booking_update') {
      nav.navigate('Tabs' as any, { screen: 'Bookings' } as any); return;
    }
    if (t === 'wanted_reply' && data.conversationId) {
      nav.navigate('ChatRoom', { conversationId: data.conversationId }); return;
    }
    if ((t === 'offer_new' || t === 'offer_accepted' || t === 'offer_declined' || t === 'offer_counter' ||
         t === 'price_drop' || t === 'follow_listing' || t === 'rate_prompt') && data.listingId) {
      nav.navigate('ListingDetail', { id: data.listingId }); return;
    }
    if (t === 'follow_service' && data.serviceId) {
      nav.navigate('ServiceDetail', { id: data.serviceId }); return;
    }
    if ((t === 'safety_alert' || t === 'follow_post' || t === 'post_comment') && data.postId) {
      nav.navigate('PostDetail', { id: data.postId }); return;
    }
    if (t === 'kyc_approved' || t === 'kyc_rejected') {
      nav.navigate('Kyc'); return;
    }
    if (t === 'wanted_match' && data.listingId) {
      nav.navigate('ListingDetail', { id: data.listingId }); return;
    }
    if (t === 'wanted_lead' && data.wantedId) {
      nav.navigate('WantedDetail', { id: data.wantedId }); return;
    }
    if (t === 'saved_search' && data.id) {
      if (data.kind === 'service') nav.navigate('ServiceDetail', { id: data.id });
      else nav.navigate('ListingDetail', { id: data.id });
      return;
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={styles.headerBar}>
        <Text style={styles.headerText}>{items.filter((i) => !i.readAt).length} unread</Text>
        <TouchableOpacity onPress={markAll}>
          <Text style={styles.markAll}>Mark all read</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={items}
        keyExtractor={(x) => x.id}
        contentContainerStyle={{ padding: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}
        ListEmptyComponent={<Text style={styles.empty}>You're all caught up.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.card, !item.readAt && styles.cardUnread]} onPress={() => open(item)}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={styles.icon}>{iconFor(item.type)}</Text>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
                <Text style={styles.meta}>{timeAgo(item.createdAt)}</Text>
              </View>
              {!item.readAt && <View style={styles.dot} />}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function iconFor(type: string): string {
  if (type === 'chat') return '💬';
  if (type === 'booking_request') return '📥';
  if (type === 'booking_update') return '📅';
  if (type === 'offer_new') return '💸';
  if (type === 'offer_accepted') return '✅';
  if (type === 'offer_declined') return '❌';
  if (type === 'offer_counter') return '↔️';
  if (type === 'price_drop') return '📉';
  if (type === 'follow_listing' || type === 'follow_service' || type === 'follow_post') return '⭐';
  if (type === 'rate_prompt') return '⭐';
  if (type === 'safety_alert') return '⚠️';
  if (type === 'post_comment') return '💭';
  if (type === 'wanted_reply') return '🙋';
  if (type === 'kyc_approved') return '🛡️';
  if (type === 'kyc_rejected') return '⚠️';
  if (type === 'saved_search') return '🔎';
  return '🔔';
}

function parseData(raw?: string | null): any {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function timeAgo(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBar: {
    flexDirection: 'row', justifyContent: 'space-between', padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border,
  },
  headerText: { color: theme.colors.textMuted, fontWeight: '700' },
  markAll: { color: theme.colors.primary, fontWeight: '700' },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 60 },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    padding: 12, marginBottom: 8,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: theme.colors.primary },
  icon: { fontSize: 24 },
  title: { fontWeight: '800', color: theme.colors.text, fontSize: 15 },
  body: { color: theme.colors.text, marginTop: 2 },
  meta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.colors.primary, marginLeft: 8, marginTop: 6 },
});
