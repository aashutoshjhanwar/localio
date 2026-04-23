import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Api } from '../api/client';
import { useAuth } from '../state/auth';
import { theme } from '../theme';
import type { RootStackParamList } from '../nav/RootNav';

type R = RouteProp<RootStackParamList, 'PollDetail'>;

export function PollDetailScreen() {
  const { params } = useRoute<R>();
  const nav = useNavigation<any>();
  const me = useAuth((s) => s.user);
  const [poll, setPoll] = useState<any>(null);
  const [myOptionId, setMyOptionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);

  const load = async () => {
    try {
      const r = await Api.poll(params.id);
      setPoll(r.poll); setMyOptionId(r.myOptionId);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [params.id]);

  const vote = async (optionId: string) => {
    if (voting) return;
    setVoting(true);
    try { await Api.votePoll(params.id, optionId); await load(); }
    catch (e: any) { Alert.alert('Error', e.message); }
    finally { setVoting(false); }
  };

  const del = async () => {
    Alert.alert('Delete poll?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await Api.deletePoll(params.id); nav.goBack(); } catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  if (!poll) return <View style={styles.center}><Text style={styles.meta}>Poll not found.</Text></View>;

  const total = poll._count?.votes ?? 0;
  const closed = poll.closesAt && new Date(poll.closesAt).getTime() < Date.now();
  const isAuthor = me?.id === poll.author.id;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.q}>📊 {poll.question}</Text>
      <Text style={styles.meta}>
        {poll.author.name ?? 'Someone'} · {total} votes{closed ? ' · closed' : ''}
      </Text>

      <View style={{ marginTop: 16 }}>
        {poll.options.map((o: any) => {
          const count = o._count?.votes ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const mine = myOptionId === o.id;
          return (
            <TouchableOpacity
              key={o.id}
              style={[styles.opt, mine && styles.optMine]}
              onPress={() => !closed && vote(o.id)}
              disabled={closed || voting}
            >
              <View style={[styles.optFill, { width: `${pct}%` }]} />
              <View style={styles.optRow}>
                <Text style={[styles.optLabel, mine && { color: theme.colors.primary, fontWeight: '800' }]}>
                  {mine ? '✓ ' : ''}{o.label}
                </Text>
                <Text style={styles.optPct}>{pct}% · {count}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {isAuthor && (
        <TouchableOpacity style={styles.delBtn} onPress={del}>
          <Text style={styles.delText}>Delete poll</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  q: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  meta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 6 },
  opt: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, marginBottom: 10, overflow: 'hidden', backgroundColor: theme.colors.surface },
  optMine: { borderColor: theme.colors.primary },
  optFill: { position: 'absolute', top: 0, bottom: 0, left: 0, backgroundColor: theme.colors.primary + '22' },
  optRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 14 },
  optLabel: { color: theme.colors.text, fontWeight: '600', flex: 1, paddingRight: 8 },
  optPct: { color: theme.colors.textMuted, fontWeight: '700', fontSize: 13 },
  delBtn: { borderWidth: 1, borderColor: theme.colors.danger, borderRadius: theme.radius.md, padding: 12, alignItems: 'center', marginTop: 20 },
  delText: { color: theme.colors.danger, fontWeight: '800' },
});
