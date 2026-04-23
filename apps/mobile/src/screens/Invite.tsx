import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Share, ScrollView, Image, Platform, Alert } from 'react-native';
import { Api } from '../api/client';
import { theme } from '../theme';

const SHARE_BASE = 'https://localio.app/i/';

type Scope = 'all' | 'month' | 'society';

export function InviteScreen() {
  const [data, setData] = useState<{ code: string; count: number; referrals: any[]; referredBy: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<any>(null);
  const [scope, setScope] = useState<Scope>('all');
  const [board, setBoard] = useState<{
    leaderboard: Array<{ rank: number; userId: string; count: number; user: any; isMe: boolean }>;
    me: { rank: number; count: number; user: any } | null;
  } | null>(null);

  useEffect(() => {
    Api.myReferrals().then(setData).catch(() => {}).finally(() => setLoading(false));
    Api.me().then((r) => setMe(r.user)).catch(() => {});
  }, []);

  useEffect(() => {
    const opts: { societyId?: string; days?: number } = {};
    if (scope === 'month') opts.days = 30;
    if (scope === 'society' && me?.societyId) opts.societyId = me.societyId;
    if (scope === 'society' && !me?.societyId) { setBoard({ leaderboard: [], me: null }); return; }
    Api.referralLeaderboard(opts).then(setBoard).catch(() => setBoard({ leaderboard: [], me: null }));
  }, [scope, me?.societyId]);

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  if (!data) return <View style={styles.center}><Text style={styles.meta}>Could not load.</Text></View>;

  const link = `${SHARE_BASE}${data.code}`;
  const message = `Join me on LOCALIO — your neighborhood in one app. Use my code ${data.code} or tap ${link}`;

  const copy = async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && (navigator as any).clipboard) {
        await (navigator as any).clipboard.writeText(data.code);
        Alert.alert('Copied', `Code ${data.code} copied.`);
      } else {
        Alert.alert('Your code', data.code);
      }
    } catch {}
  };
  const share = async () => {
    try {
      if (Platform.OS === 'web' && (navigator as any).share) {
        await (navigator as any).share({ text: message });
      } else {
        await Share.share({ message });
      }
    } catch {}
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: 20 }}>
      <View style={styles.hero}>
        <Text style={styles.title}>🎁 Invite your neighbors</Text>
        <Text style={styles.sub}>Help grow your local community. Share your code — every neighbor who joins is linked to you.</Text>
      </View>

      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>Your referral code</Text>
        <Text style={styles.code}>{data.code}</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={copy}>
            <Text style={[styles.btnText, { color: theme.colors.primary }]}>Copy code</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={share}>
            <Text style={styles.btnText}>Share invite</Text>
          </TouchableOpacity>
        </View>
      </View>

      {data.referredBy && (
        <View style={styles.byCard}>
          <Text style={styles.meta}>Invited by</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            {data.referredBy.avatarUrl ? <Image source={{ uri: data.referredBy.avatarUrl }} style={styles.avatarSm} /> : <View style={[styles.avatarSm, styles.avatarPh]}><Text>👤</Text></View>}
            <Text style={styles.name}>{data.referredBy.name ?? 'a neighbor'}</Text>
          </View>
        </View>
      )}

      <Text style={styles.section}>{data.count} neighbor{data.count === 1 ? '' : 's'} joined with your code</Text>
      {data.referrals.map((r) => (
        <View key={r.id} style={styles.row}>
          {r.avatarUrl ? <Image source={{ uri: r.avatarUrl }} style={styles.avatarSm} /> : <View style={[styles.avatarSm, styles.avatarPh]}><Text>👤</Text></View>}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.name}>{r.name ?? 'New neighbor'}</Text>
            <Text style={styles.meta}>Joined {new Date(r.createdAt).toLocaleDateString('en-IN')}</Text>
          </View>
        </View>
      ))}
      {data.count === 0 && <Text style={styles.meta}>No invites yet. Share your code to get started.</Text>}

      <Text style={styles.section}>🏆 Top inviters</Text>
      <View style={styles.scopeRow}>
        <ScopeChip label="All time" active={scope === 'all'} onPress={() => setScope('all')} />
        <ScopeChip label="Last 30 days" active={scope === 'month'} onPress={() => setScope('month')} />
        {me?.societyId && (
          <ScopeChip label="My society" active={scope === 'society'} onPress={() => setScope('society')} />
        )}
      </View>
      {board === null ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 10 }} />
      ) : board.leaderboard.length === 0 ? (
        <Text style={styles.meta}>Be the first — invite a neighbor to top the board.</Text>
      ) : (
        <>
          {board.leaderboard.map((r) => (
            <LbRow key={r.userId} row={r} />
          ))}
          {board.me && !board.leaderboard.some((r) => r.isMe) && (
            <>
              <Text style={styles.yourRankHint}>Your rank</Text>
              <LbRow row={{ ...board.me, isMe: true } as any} />
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

function ScopeChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.scopeChip, active && styles.scopeChipActive]}
    >
      <Text style={[styles.scopeChipText, active && styles.scopeChipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function LbRow({ row }: { row: { rank: number; count: number; user: any; isMe: boolean } }) {
  const medal = row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : null;
  return (
    <View style={[styles.lbRow, row.isMe && styles.lbRowMe]}>
      <View style={styles.rankCell}>
        {medal ? <Text style={styles.medal}>{medal}</Text> : <Text style={styles.rankNum}>#{row.rank}</Text>}
      </View>
      {row.user?.avatarUrl ? (
        <Image source={{ uri: row.user.avatarUrl }} style={styles.avatarSm} />
      ) : (
        <View style={[styles.avatarSm, styles.avatarPh]}><Text>👤</Text></View>
      )}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.name} numberOfLines={1}>
          {row.user?.name ?? 'Neighbor'}{row.isMe ? ' · you' : ''}
        </Text>
      </View>
      <Text style={styles.lbCount}>{row.count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hero: { marginBottom: 18 },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.text },
  sub: { color: theme.colors.textMuted, marginTop: 6, lineHeight: 20 },
  codeCard: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 18, alignItems: 'center' },
  codeLabel: { color: theme.colors.textMuted, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  code: { fontSize: 36, fontWeight: '900', color: theme.colors.primary, letterSpacing: 4, marginTop: 8 },
  btn: { backgroundColor: theme.colors.primary, padding: 14, borderRadius: theme.radius.md, alignItems: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.primary, paddingHorizontal: 18 },
  btnText: { color: '#fff', fontWeight: '800' },
  byCard: { marginTop: 14, padding: 12, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface },
  section: { marginTop: 24, marginBottom: 10, fontWeight: '800', color: theme.colors.text, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, marginBottom: 8 },
  avatarSm: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.border },
  avatarPh: { justifyContent: 'center', alignItems: 'center' },
  name: { color: theme.colors.text, fontWeight: '700' },
  meta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  scopeRow: { flexDirection: 'row', gap: 8, marginBottom: 10, flexWrap: 'wrap' },
  scopeChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
  },
  scopeChipActive: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  scopeChipText: { fontWeight: '700', color: theme.colors.textMuted, fontSize: 12 },
  scopeChipTextActive: { color: theme.colors.primaryDark },
  lbRow: {
    flexDirection: 'row', alignItems: 'center', padding: 10, marginBottom: 8,
    backgroundColor: theme.colors.card, borderRadius: theme.radius.md,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  lbRowMe: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  rankCell: { width: 40, alignItems: 'center' },
  medal: { fontSize: 22 },
  rankNum: { fontWeight: '900', color: theme.colors.textMuted, fontSize: 13 },
  lbCount: {
    fontWeight: '900', color: theme.colors.primary, fontSize: 18,
    marginLeft: 8, minWidth: 32, textAlign: 'right',
  },
  yourRankHint: { marginTop: 6, marginBottom: 4, fontSize: 12, fontWeight: '700', color: theme.colors.textMuted },
});
