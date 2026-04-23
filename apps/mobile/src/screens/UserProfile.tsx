import React, { useEffect, useState } from 'react';
import { View, Text, Image, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity, Alert, ScrollView } from 'react-native';
import ImageView from 'react-native-image-viewing';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Api } from '../api/client';
import { theme } from '../theme';
import type { RootStackParamList } from '../nav/RootNav';
import { useAuth } from '../state/auth';
import { TrustBadge } from '../components/TrustBadge';
import { formatLastActive, formatResponseTime } from '../utils/trustSignals';

type R = RouteProp<RootStackParamList, 'UserProfile'>;

export function UserProfileScreen() {
  const { params } = useRoute<R>();
  const nav = useNavigation<any>();
  const me = useAuth((s) => s.user);
  const [user, setUser] = useState<any | null>(null);
  const [ratings, setRatings] = useState<any[]>([]);
  const [items, setItems] = useState<{ listings: any[]; services: any[] }>({ listings: [], services: [] });
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [followStats, setFollowStats] = useState<{ followers: number; following: number; iFollow: boolean }>({ followers: 0, following: 0, iFollow: false });
  const [viewer, setViewer] = useState<{ images: string[]; index: number } | null>(null);
  const isSelf = me?.id === params.id;

  useEffect(() => {
    Promise.all([
      Api.user(params.id),
      Api.userRatings(params.id),
      isSelf ? Promise.resolve({ blocks: [] }) : Api.blocks(),
      Api.followStats(params.id).catch(() => ({ followers: 0, following: 0, iFollow: false })),
      Api.userItems(params.id).catch(() => ({ listings: [], services: [] })),
    ])
      .then(([u, r, b, f, it]: any) => {
        setUser(u.user);
        setRatings(r.ratings);
        setIsBlocked(b.blocks.some((x: any) => x.blockedId === params.id));
        setFollowStats(f);
        setItems(it);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id, isSelf]);

  const toggleFollow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (followStats.iFollow) {
        await Api.unfollow(params.id);
        setFollowStats((s) => ({ ...s, iFollow: false, followers: Math.max(0, s.followers - 1) }));
      } else {
        await Api.follow(params.id);
        setFollowStats((s) => ({ ...s, iFollow: true, followers: s.followers + 1 }));
      }
    } catch (e: any) { Alert.alert('Error', e.message ?? 'Try again'); }
    finally { setBusy(false); }
  };

  const toggleBlock = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (isBlocked) { await Api.unblock(params.id); setIsBlocked(false); }
      else { await Api.block(params.id); setIsBlocked(true); }
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Try again');
    } finally { setBusy(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  if (!user) return <View style={styles.center}><Text style={styles.meta}>User not found.</Text></View>;

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      data={ratings}
      keyExtractor={(r) => r.id}
      ListHeaderComponent={
        <View style={styles.header}>
          {user.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPh]}><Text style={{ fontSize: 32 }}>👤</Text></View>
          )}
          <Text style={styles.name}>{user.name ?? 'LOCALIO user'}</Text>
          <View style={{ marginTop: 6, alignItems: 'center' }}>
            <TrustBadge score={user.trustScore} size="md" kycVerified={user.kycVerified} />
          </View>
          {user.bio && <Text style={styles.bio}>{user.bio}</Text>}
          <View style={styles.statsRow}>
            <Stat label="Trust" value={user.trustScore ? user.trustScore.toFixed(1) : '—'} />
            <Stat label="Rating" value={user.stats?.ratingAvg ? `⭐ ${user.stats.ratingAvg.toFixed(1)}` : '—'} />
            <Stat label="Sold" value={String(user.stats?.listingsSold ?? 0)} />
            <Stat label="Followers" value={String(followStats.followers)} />
          </View>
          {(formatResponseTime(user.stats?.avgResponseMins) || formatLastActive(user.stats?.lastActiveAt)) && (
            <View style={styles.signalRow}>
              {formatResponseTime(user.stats?.avgResponseMins) && (
                <Text style={styles.signalPill}>💬 {formatResponseTime(user.stats?.avgResponseMins)}</Text>
              )}
              {formatLastActive(user.stats?.lastActiveAt) && (
                <Text style={styles.signalPill}>🟢 {formatLastActive(user.stats?.lastActiveAt)}</Text>
              )}
            </View>
          )}
          {!isSelf && (
            <TouchableOpacity
              style={[styles.followBtn, followStats.iFollow && styles.followBtnOn]}
              onPress={toggleFollow}
              disabled={busy}
            >
              <Text style={[styles.followBtnText, followStats.iFollow && { color: '#fff' }]}>
                {followStats.iFollow ? '✓ Following' : '+ Follow'}
              </Text>
            </TouchableOpacity>
          )}
          {!isSelf && (
            <TouchableOpacity
              style={[styles.blockBtn, isBlocked && styles.blockBtnActive]}
              onPress={toggleBlock}
              disabled={busy}
            >
              <Text style={[styles.blockBtnText, isBlocked && styles.blockBtnTextActive]}>
                {isBlocked ? '✓ Blocked — tap to unblock' : '🚫 Block user'}
              </Text>
            </TouchableOpacity>
          )}
          {items.services.length > 0 && (
            <>
              <Text style={styles.sectionHead}>Services ({items.services.length})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ alignSelf: 'stretch' }}>
                {items.services.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={styles.shopCard}
                    onPress={() => nav.navigate('ServiceDetail', { id: s.id })}
                  >
                    <Text style={{ fontSize: 28 }}>🛠️</Text>
                    <Text style={styles.shopTitle} numberOfLines={2}>{s.title}</Text>
                    <Text style={styles.shopMeta}>
                      {s.priceFrom ? `From ₹${(s.priceFrom / 100).toLocaleString('en-IN')}` : 'Ask'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}
          {items.listings.length > 0 && (
            <>
              <Text style={styles.sectionHead}>Listings ({items.listings.length})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ alignSelf: 'stretch' }}>
                {items.listings.map((l) => (
                  <TouchableOpacity
                    key={l.id}
                    style={styles.shopCard}
                    onPress={() => nav.navigate('ListingDetail', { id: l.id })}
                  >
                    {l.images?.[0]
                      ? <Image source={{ uri: l.images[0] }} style={styles.shopImg} />
                      : <View style={[styles.shopImg, { alignItems: 'center', justifyContent: 'center' }]}><Text>📦</Text></View>}
                    <Text style={styles.shopTitle} numberOfLines={2}>{l.title}</Text>
                    <Text style={styles.shopMeta}>₹{(l.priceInPaise / 100).toLocaleString('en-IN')}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}
          <Text style={styles.sectionHead}>Reviews</Text>
        </View>
      }
      contentContainerStyle={{ padding: 16 }}
      ListEmptyComponent={<Text style={styles.meta}>No reviews yet.</Text>}
      renderItem={({ item }) => (
        <View style={styles.review}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={styles.reviewer}>{item.from?.name ?? 'Someone'}</Text>
            <Text style={styles.stars}>{'★'.repeat(item.stars)}{'☆'.repeat(5 - item.stars)}</Text>
          </View>
          {item.review && <Text style={styles.reviewText}>"{item.review}"</Text>}
          {Array.isArray(item.photoUrls) && item.photoUrls.length > 0 && (
            <View style={styles.reviewPhotoRow}>
              {item.photoUrls.map((u: string, i: number) => (
                <TouchableOpacity key={u} onPress={() => setViewer({ images: item.photoUrls, index: i })}>
                  <Image source={{ uri: u }} style={styles.reviewPhoto} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          <Text style={styles.meta}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </View>
      )}
      ListFooterComponent={
        viewer ? (
          <ImageView
            images={viewer.images.map((uri) => ({ uri }))}
            imageIndex={viewer.index}
            visible={!!viewer}
            onRequestClose={() => setViewer(null)}
            swipeToCloseEnabled
            doubleTapToZoomEnabled
          />
        ) : null
      }
    />
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 12 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: theme.colors.surface },
  avatarPh: { justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 20, fontWeight: '800', color: theme.colors.text, marginTop: 10 },
  verified: { color: theme.colors.success, marginTop: 4, fontWeight: '700' },
  bio: { color: theme.colors.textMuted, marginTop: 6, textAlign: 'center' },
  statsRow: { flexDirection: 'row', marginTop: 16, gap: 8 },
  signalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, justifyContent: 'center' },
  signalPill: {
    backgroundColor: theme.colors.primarySoft, color: theme.colors.primaryDark,
    fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, overflow: 'hidden',
  },
  statCell: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 10, alignItems: 'center' },
  statVal: { fontWeight: '800', color: theme.colors.text },
  statLabel: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  sectionHead: { alignSelf: 'stretch', marginTop: 20, marginBottom: 6, fontWeight: '800', color: theme.colors.text },
  review: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 12, marginBottom: 8 },
  reviewer: { fontWeight: '700', color: theme.colors.text },
  stars: { color: '#F5A623', fontSize: 16 },
  reviewText: { color: theme.colors.text, marginTop: 4, fontStyle: 'italic' },
  reviewPhotoRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  reviewPhoto: { width: 64, height: 64, borderRadius: theme.radius.sm, backgroundColor: theme.colors.border },
  meta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 4 },
  blockBtn: { marginTop: 14, paddingVertical: 10, paddingHorizontal: 16, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.danger, alignSelf: 'stretch', alignItems: 'center' },
  blockBtnActive: { backgroundColor: theme.colors.danger },
  blockBtnText: { color: theme.colors.danger, fontWeight: '700' },
  blockBtnTextActive: { color: '#fff' },
  followBtn: { marginTop: 12, paddingVertical: 10, paddingHorizontal: 16, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.primary, alignSelf: 'stretch', alignItems: 'center' },
  followBtnOn: { backgroundColor: theme.colors.primary },
  followBtnText: { color: theme.colors.primary, fontWeight: '800' },
  shopCard: { width: 140, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 10, marginRight: 8 },
  shopImg: { width: '100%', height: 80, borderRadius: theme.radius.sm, backgroundColor: theme.colors.border, marginBottom: 6 },
  shopTitle: { color: theme.colors.text, fontWeight: '700', fontSize: 13, marginTop: 6 },
  shopMeta: { color: theme.colors.primary, fontWeight: '800', marginTop: 4, fontSize: 13 },
});
