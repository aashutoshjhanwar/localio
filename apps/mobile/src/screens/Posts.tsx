import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Api } from '../api/client';
import { useLocation } from '../hooks/useLocation';
import { theme } from '../theme';
import { TrustBadge } from '../components/TrustBadge';

const KINDS: Array<{ key?: string; label: string; icon: string }> = [
  { label: 'All', icon: '🏘️' },
  { key: 'question', label: 'Ask', icon: '❓' },
  { key: 'recommendation', label: 'Recs', icon: '⭐' },
  { key: 'lost_found', label: 'Lost/Found', icon: '🔎' },
  { key: 'announcement', label: 'Announce', icon: '📣' },
  { key: 'safety', label: 'Safety', icon: '⚠️' },
];

export function PostsScreen() {
  const { coords } = useLocation();
  const nav = useNavigation<any>();
  const [kind, setKind] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { posts } = await Api.posts(coords.lat, coords.lng, kind, 25);
      setRows(posts);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, [coords.lat, coords.lng, kind]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={styles.kindRow}>
        {KINDS.map((k) => (
          <TouchableOpacity
            key={k.label}
            style={[styles.kind, kind === k.key && styles.kindOn]}
            onPress={() => { setKind(k.key); setLoading(true); }}
          >
            <Text style={[styles.kindText, kind === k.key && { color: '#fff' }]}>{k.icon} {k.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList
        data={rows}
        keyExtractor={(p) => p.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={<Text style={styles.empty}>No posts nearby yet. Start the conversation.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={[styles.card, item.kind === 'safety' && styles.safetyCard]} onPress={() => nav.navigate('PostDetail', { id: item.id })}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.kindTag}>{kindLabel(item.kind)}</Text>
              <Text style={styles.meta}>  {relTime(item.createdAt)}{typeof item.distanceKm === 'number' ? ` · ${item.distanceKm.toFixed(1)} km` : ''}</Text>
            </View>
            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
            {Array.isArray(item.images) && item.images.length > 0 && (
              <Image source={{ uri: item.images[0] }} style={styles.postImg} />
            )}
            <View style={styles.footer}>
              {item.author?.avatarUrl ? <Image source={{ uri: item.author.avatarUrl }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarPh]}><Text style={{ fontSize: 12 }}>👤</Text></View>}
              <Text style={styles.author}>{item.author?.name ?? 'Someone'}</Text>
              {item.author?.trustScore ? (
                <View style={{ marginLeft: 6 }}>
                  <TrustBadge score={item.author.trustScore} />
                </View>
              ) : null}
              <View style={{ flex: 1 }} />
              <Text style={styles.meta}>💬 {item._count?.comments ?? 0}</Text>
              <Text style={[styles.meta, { marginLeft: 12 }]}>👍 {item.upvotes}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity style={styles.fab} onPress={() => nav.navigate('CreatePost')}>
        <Text style={styles.fabPlus}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function kindLabel(k: string) {
  switch (k) {
    case 'question': return '❓ Question';
    case 'recommendation': return '⭐ Rec';
    case 'lost_found': return '🔎 Lost / Found';
    case 'announcement': return '📣 Announce';
    case 'safety': return '⚠️ Safety';
    default: return k;
  }
}
function relTime(iso: string) {
  const mins = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.floor(mins)}m ago`;
  if (mins < 60 * 24) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 60 / 24)}d ago`;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 64 },
  kindRow: { flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10, gap: 8, flexWrap: 'wrap' },
  kind: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.colors.surface },
  kindOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  kindText: { color: theme.colors.text, fontWeight: '700', fontSize: 13 },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 14, marginBottom: 10 },
  safetyCard: { borderLeftWidth: 4, borderLeftColor: theme.colors.danger },
  kindTag: { fontWeight: '700', color: theme.colors.primary, fontSize: 12 },
  title: { fontSize: 16, fontWeight: '800', color: theme.colors.text, marginTop: 6 },
  body: { color: theme.colors.text, marginTop: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  avatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: theme.colors.border },
  avatarPh: { justifyContent: 'center', alignItems: 'center' },
  author: { color: theme.colors.text, marginLeft: 6, fontWeight: '600', fontSize: 12 },
  meta: { color: theme.colors.textMuted, fontSize: 12 },
  postImg: { width: '100%', height: 180, borderRadius: theme.radius.md, marginTop: 10, backgroundColor: theme.colors.border },
  fab: { position: 'absolute', right: 20, bottom: 28, width: 58, height: 58, borderRadius: 29, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowOpacity: 0.2, shadowRadius: 4 },
  fabPlus: { color: '#fff', fontSize: 32, marginTop: -3 },
});
