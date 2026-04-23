import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Api } from '../api/client';
import { getSocket } from '../api/socket';
import { useAuth } from '../state/auth';
import { theme } from '../theme';

export function ChatListScreen() {
  const [convs, setConvs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<'inbox' | 'archived'>('inbox');
  const [typing, setTyping] = useState<Record<string, number>>({});
  const me = useAuth((s) => s.user);
  const nav = useNavigation<any>();
  const rowRefs = useRef(new Map<string, Swipeable | null>());

  const load = useCallback(async () => {
    try {
      const { conversations } = await Api.conversations(tab === 'archived');
      setConvs(conversations);
    } catch { /* noop */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [tab]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { setLoading(true); load(); }, [load]);

  useEffect(() => {
    const s = getSocket();
    const onTyping = (evt: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (evt.userId === me?.id) return;
      setTyping((prev) => {
        const next = { ...prev };
        if (evt.isTyping) next[evt.conversationId] = Date.now();
        else delete next[evt.conversationId];
        return next;
      });
    };
    const onNew = (msg: any) => {
      setTyping((prev) => {
        if (!prev[msg.conversationId]) return prev;
        const next = { ...prev }; delete next[msg.conversationId]; return next;
      });
      setConvs((prev) => prev.map((c) => c.id === msg.conversationId
        ? { ...c, messages: [msg], unread: msg.senderId === me?.id ? c.unread : (c.unread ?? 0) + 1 }
        : c));
    };
    s.on('typing', onTyping);
    s.on('message:new', onNew);
    const sweep = setInterval(() => {
      setTyping((prev) => {
        const now = Date.now();
        const next: Record<string, number> = {};
        let changed = false;
        for (const [k, v] of Object.entries(prev)) {
          if (now - v < 4000) next[k] = v; else changed = true;
        }
        return changed ? next : prev;
      });
    }, 1500);
    return () => { s.off('typing', onTyping); s.off('message:new', onNew); clearInterval(sweep); };
  }, [me?.id]);

  async function toggleArchive(convId: string, archived: boolean) {
    const previous = convs;
    setConvs((prev) => prev.filter((c) => c.id !== convId));
    rowRefs.current.get(convId)?.close();
    try {
      await Api.archiveConversation(convId, archived);
    } catch (e: any) {
      setConvs(previous);
      Alert.alert('Could not update', e.message ?? 'try again');
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'inbox' && styles.tabActive]}
          onPress={() => setTab('inbox')}
        >
          <Text style={[styles.tabText, tab === 'inbox' && styles.tabTextActive]}>Inbox</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'archived' && styles.tabActive]}
          onPress={() => setTab('archived')}
        >
          <Text style={[styles.tabText, tab === 'archived' && styles.tabTextActive]}>Archived</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={convs}
        keyExtractor={(c) => c.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {tab === 'archived' ? 'No archived chats.' : 'No chats yet. Start one from a listing.'}
          </Text>
        }
        renderItem={({ item }) => {
          const peer = item.type === 'direct'
            ? item.members.find((m: any) => m.userId !== me?.id)?.user
            : null;
          const title = item.type === 'group' ? item.group?.name ?? 'Group' : peer?.name ?? 'Chat';
          const last = item.messages?.[0];
          const isArchived = tab === 'archived';
          return (
            <Swipeable
              ref={(r) => { rowRefs.current.set(item.id, r); }}
              overshootRight={false}
              renderRightActions={() => (
                <TouchableOpacity
                  style={[styles.swipeAction, isArchived ? styles.swipeUnarchive : styles.swipeArchive]}
                  onPress={() => toggleArchive(item.id, !isArchived)}
                >
                  <Text style={styles.swipeIcon}>{isArchived ? '↩️' : '📥'}</Text>
                  <Text style={styles.swipeText}>{isArchived ? 'Unarchive' : 'Archive'}</Text>
                </TouchableOpacity>
              )}
            >
              <TouchableOpacity
                style={styles.row}
                onPress={() => nav.navigate('ChatRoom', { conversationId: item.id, title })}
              >
                <View style={styles.avatar}><Text style={{ fontSize: 22 }}>{item.type === 'group' ? '👥' : '👤'}</Text></View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.name, item.unread > 0 && { fontWeight: '900' }]} numberOfLines={1}>{title}</Text>
                    {item.muted && <Text style={styles.mutedIcon}>🔕</Text>}
                    {last?.createdAt && (
                      <Text style={styles.time}>{formatRelative(last.createdAt)}</Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Text
                      style={[
                        styles.preview,
                        item.unread > 0 && styles.previewUnread,
                        !!typing[item.id] && styles.previewTyping,
                      ]}
                      numberOfLines={1}
                    >
                      {typing[item.id] ? 'typing…' : previewText(last)}
                    </Text>
                    {item.unread > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.unread > 99 ? '99+' : item.unread}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            </Swipeable>
          );
        }}
      />
    </View>
  );
}

function previewText(last: any): string {
  if (!last) return 'No messages yet';
  if (last.deletedAt) return '🚫 Message deleted';
  if (last.type === 'image') return '📷 Photo';
  if (last.type === 'location') return '📍 Location';
  if (last.type === 'offer') return '💰 Offer';
  return last.body ?? '';
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = 60_000, hr = 60 * min, day = 24 * hr;
  if (diff < min) return 'now';
  if (diff < hr) return `${Math.floor(diff / min)}m`;
  if (diff < day) return `${Math.floor(diff / hr)}h`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d`;
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 64 },
  tabs: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
  },
  tab: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
  },
  tabActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabText: { fontWeight: '800', color: theme.colors.text, fontSize: 13 },
  tabTextActive: { color: '#fff' },
  row: {
    flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: theme.colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.surface, justifyContent: 'center', alignItems: 'center' },
  name: { fontWeight: '700', color: theme.colors.text, fontSize: 16, flex: 1 },
  time: { fontSize: 11, color: theme.colors.textMuted, marginLeft: 8, fontWeight: '600' },
  mutedIcon: { fontSize: 13, marginLeft: 6 },
  preview: { color: theme.colors.textMuted, flex: 1 },
  previewUnread: { color: theme.colors.text, fontWeight: '700' },
  previewTyping: { color: theme.colors.primary, fontStyle: 'italic', fontWeight: '700' },
  badge: {
    marginLeft: 8, minWidth: 22, height: 22, paddingHorizontal: 7, borderRadius: 11,
    backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  swipeAction: {
    width: 100, justifyContent: 'center', alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border,
  },
  swipeArchive: { backgroundColor: theme.colors.accent ?? '#FF7043' },
  swipeUnarchive: { backgroundColor: theme.colors.primary },
  swipeIcon: { fontSize: 22 },
  swipeText: { color: '#fff', fontWeight: '800', fontSize: 12, marginTop: 2 },
});
