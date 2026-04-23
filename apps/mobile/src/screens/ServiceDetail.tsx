import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput, Share } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Api } from '../api/client';
import { useAuth } from '../state/auth';
import { theme } from '../theme';
import { ReportModal } from '../components/ReportModal';
import { TrustBadge } from '../components/TrustBadge';
import type { RootStackParamList } from '../nav/RootNav';

type R = RouteProp<RootStackParamList, 'ServiceDetail'>;
type N = NativeStackNavigationProp<RootStackParamList>;

export function ServiceDetailScreen() {
  const { params } = useRoute<R>();
  const nav = useNavigation<N>();
  const me = useAuth((s) => s.user);
  const [service, setService] = useState<any>(null);
  const [notes, setNotes] = useState('');
  const [booking, setBooking] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [slots, setSlots] = useState<any[]>([]);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [fav, setFav] = useState(false);

  const loadSlots = async () => {
    try { const { slots } = await Api.serviceSlots(params.id); setSlots(slots); } catch {}
  };
  useEffect(() => {
    Api.service(params.id).then((r) => setService(r.service)).catch(() => {});
    loadSlots();
    Api.serviceRatings(params.id).then((r) => setReviews(r.ratings)).catch(() => {});
    Api.favoriteServices().then((r) => setFav(r.favorites.some((s: any) => s.id === params.id))).catch(() => {});
  }, [params.id]);

  async function toggleFav() {
    try {
      if (fav) { await Api.unfavoriteService(params.id); setFav(false); }
      else { await Api.favoriteService(params.id); setFav(true); }
    } catch (e: any) { Alert.alert('Error', e.message ?? 'try again'); }
  }

  if (!service) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  const isOwner = me?.id === service.providerId;

  async function chat() {
    const { conversation } = await Api.directChat(service.providerId);
    nav.navigate('ChatRoom', { conversationId: conversation.id, title: service.provider?.name ?? 'Provider' });
  }

  async function book() {
    try {
      setBooking(true);
      await Api.book({ serviceId: service.id, notes: notes || undefined, slotId: slotId ?? undefined });
      Alert.alert('Booking sent', 'The provider will respond shortly.');
      setNotes('');
      nav.navigate('Tabs' as any, { screen: 'Bookings' } as any);
    } catch (e: any) {
      Alert.alert('Could not book', e.message ?? 'try again');
    } finally { setBooking(false); }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>{service.title}</Text>
      <Text style={styles.meta}>
        {service.category} · {service.ratingAvg ? `⭐ ${service.ratingAvg.toFixed(1)} (${service.ratingCount})` : 'New'}
      </Text>
      <Text style={styles.price}>
        {service.priceFrom ? `From ₹${(service.priceFrom / 100).toLocaleString('en-IN')}` : 'Ask for price'}
        {service.priceUnit ? ` / ${service.priceUnit.replace('per_', '')}` : ''}
      </Text>
      <View style={styles.divider} />
      <Text style={styles.section}>About</Text>
      <Text style={styles.desc}>{service.description}</Text>
      <View style={styles.divider} />
      <Text style={styles.section}>Provider</Text>
      <TouchableOpacity style={styles.providerRow} onPress={() => nav.navigate('UserProfile', { id: service.providerId })}>
        <View style={styles.avatar}><Text style={{ fontSize: 22 }}>👤</Text></View>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={styles.providerName}>{service.provider?.name ?? 'User'}</Text>
          <View style={{ marginTop: 4 }}>
            <TrustBadge score={service.provider?.trustScore} kycVerified={service.provider?.kycVerified} />
          </View>
        </View>
        <Text style={{ color: theme.colors.textMuted }}>›</Text>
      </TouchableOpacity>

      {isOwner && (
        <>
          <View style={styles.divider} />
          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => nav.navigate('ManageSlots', { serviceId: service.id, title: service.title })}>
            <Text style={[styles.btnText, { color: theme.colors.primary }]}>🗓 Manage availability slots</Text>
          </TouchableOpacity>
        </>
      )}

      {!isOwner && (
        <>
          {slots.filter((s) => s.status === 'open').length > 0 && (
            <>
              <View style={styles.divider} />
              <Text style={styles.section}>Pick a slot</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {slots.filter((s) => s.status === 'open').map((s) => {
                  const picked = slotId === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.slot, picked && styles.slotOn]}
                      onPress={() => setSlotId(picked ? null : s.id)}
                    >
                      <Text style={[styles.slotText, picked && { color: '#fff' }]}>
                        {new Date(s.startsAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
          <View style={styles.divider} />
          <Text style={styles.section}>Request booking</Text>
          <TextInput
            style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
            multiline
            value={notes}
            onChangeText={setNotes}
            placeholder="Tell the provider what you need…"
            placeholderTextColor={theme.colors.textMuted}
          />
          <TouchableOpacity style={styles.btn} onPress={book} disabled={booking}>
            {booking ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Request booking</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={chat}>
            <Text style={[styles.btnText, { color: theme.colors.primary }]}>💬 Chat first</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={toggleFav}>
            <Text style={[styles.btnText, { color: theme.colors.primary }]}>{fav ? '♥ Saved' : '♡ Save'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnGhost]}
            onPress={() => Share.share({ message: `${service.title} on LOCALIO — localio://service/${service.id}` }).catch(() => {})}
          >
            <Text style={[styles.btnText, { color: theme.colors.primary }]}>↗ Share</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setReportOpen(true)} style={{ marginTop: 16, alignItems: 'center' }}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>🚩 Report this provider</Text>
          </TouchableOpacity>
        </>
      )}
      {reviews.length > 0 && (
        <>
          <View style={styles.divider} />
          <Text style={styles.section}>Reviews ({reviews.length})</Text>
          {reviews.slice(0, 5).map((r) => (
            <View key={r.id} style={styles.review}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.reviewer}>{r.from?.name ?? 'Neighbor'}</Text>
                <Text style={styles.stars}>{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</Text>
              </View>
              {r.review ? <Text style={styles.reviewText}>"{r.review}"</Text> : null}
              <Text style={styles.reviewDate}>{new Date(r.createdAt).toLocaleDateString('en-IN')}</Text>
            </View>
          ))}
        </>
      )}
      <ReportModal
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="service"
        targetId={service.id}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.text },
  meta: { color: theme.colors.textMuted, marginTop: 4 },
  price: { fontSize: 20, fontWeight: '800', color: theme.colors.primary, marginTop: 8 },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 16 },
  section: { fontWeight: '700', color: theme.colors.text, marginBottom: 6 },
  desc: { color: theme.colors.text, lineHeight: 22 },
  providerRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.surface, justifyContent: 'center', alignItems: 'center' },
  providerName: { fontWeight: '700', color: theme.colors.text },
  verified: { color: theme.colors.success, fontSize: 12, marginTop: 2 },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    padding: 12, backgroundColor: theme.colors.surface, color: theme.colors.text,
  },
  btn: {
    backgroundColor: theme.colors.primary, padding: 16,
    borderRadius: theme.radius.md, alignItems: 'center', marginTop: 12,
  },
  btnGhost: {
    backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.primary,
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  slot: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.colors.surface },
  slotOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  slotText: { color: theme.colors.text, fontWeight: '700', fontSize: 13 },
  review: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 12, marginBottom: 8 },
  reviewer: { fontWeight: '700', color: theme.colors.text },
  stars: { color: '#F5A623', fontSize: 15 },
  reviewText: { color: theme.colors.text, marginTop: 4, fontStyle: 'italic' },
  reviewDate: { color: theme.colors.textMuted, fontSize: 12, marginTop: 4 },
});
