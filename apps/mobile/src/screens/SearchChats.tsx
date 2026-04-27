import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Api } from '../api/client';
import { theme } from '../theme';

function highlight(body: string, q: string): { before: string; match: string; after: string } {
  const idx = body.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return { before: body.slice(0, 80), match: '', after: '' };
  const start = Math.max(0, idx - 20);
  return {
    before: (start > 0 ? '…' : '') + body.slice(start, idx),
    match:  body.slice(idx, idx + q.length),
    after:  body.slice(idx + q.length, idx + q.length + 60),
  };
}

export function SearchChatsScreen() {
  const nav = useNavigation<any>();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    const h = setTimeout(() => {
      Api.searchAllChats(q.trim())
        .then((r) => { if (!cancelled) setResults(r.results); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(h); };
  }, [q]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TextInput
          style={styles.input}
          value={q}
          onChangeText={setQ}
          placeholder="Search every message, everywhere"
          placeholderTextColor={theme.colors.textMuted}
          autoFocus
          returnKeyType="search"
        />
      </View>

      {loading && q.length >= 2 ? (
        <View style={{ padding: 24 }}><ActivityIndicator color={theme.colors.primary} /></View>
      ) : null}

      {!loading && q.length >= 2 && results.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No matches</Text>
          <Text style={styles.emptyBody}>Try a different keyword, or a shorter one.</Text>
        </View>
      ) : null}

      {q.length < 2 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Search across all your chats</Text>
          <Text style={styles.emptyBody}>DMs, society channels, group announcements — everything.</Text>
        </View>
      ) : null}

      <FlatList
        data={results}
        keyExtractor={(r) => r.messageId}
        renderItem={({ item }) => {
          const h = highlight(item.body ?? '', q.trim());
          const where = item.channel
            ? `${item.channel.emoji ?? '#'} ${item.channel.name} · ${item.group?.name ?? 'Group'}`
            : item.group
            ? `🏘️ ${item.group.name}`
            : item.peer?.name
            ? `💬 ${item.peer.name}`
            : 'Chat';
          return (
            <TouchableOpacity
              style={styles.row}
              onPress={() => nav.navigate('ChatRoom', {
                conversationId: item.conversationId,
                title: where,
              })}
            >
              <Text style={styles.where} numberOfLines={1}>{where}</Text>
              <Text style={styles.snippet} numberOfLines={2}>
                <Text style={styles.sender}>{item.sender?.name ?? 'User'}: </Text>
                <Text>{h.before}</Text>
                <Text style={styles.match}>{h.match}</Text>
                <Text>{h.after}</Text>
              </Text>
              <Text style={styles.when}>{new Date(item.createdAt).toLocaleString()}</Text>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  header: { padding: theme.spacing(3), backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: theme.spacing(2), fontSize: 15, backgroundColor: theme.colors.bg, color: theme.colors.text },
  row: { padding: theme.spacing(3), borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.card },
  where: { fontWeight: '700', color: theme.colors.primary, fontSize: 12, marginBottom: 2 },
  sender: { fontWeight: '700', color: theme.colors.text },
  snippet: { color: theme.colors.text, fontSize: 14, lineHeight: 20 },
  match: { backgroundColor: '#FEF08A', fontWeight: '700' },
  when: { color: theme.colors.textMuted, fontSize: 11, marginTop: 4 },
  empty: { alignItems: 'center', padding: theme.spacing(6) },
  emptyTitle: { fontWeight: '700', color: theme.colors.text, fontSize: 16, marginBottom: 4 },
  emptyBody: { color: theme.colors.textMuted, textAlign: 'center' },
});
