import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Image } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Api } from '../api/client';
import { useAuth } from '../state/auth';
import { theme } from '../theme';
import type { RootStackParamList } from '../nav/RootNav';

type R = RouteProp<RootStackParamList, 'EventDetail'>;

export function EventDetailScreen() {
  const { params } = useRoute<R>();
  const nav = useNavigation<any>();
  const me = useAuth((s) => s.user);
  const [ev, setEv] = useState<any>(null);
  const [myRsvp, setMyRsvp] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const r = await Api.event(params.id);
      setEv(r.event);
      setMyRsvp(r.myRsvp);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [params.id]);

  const rsvp = async (status: 'going' | 'interested') => {
    if (busy) return;
    setBusy(true);
    try { await Api.rsvpEvent(params.id, status); await load(); }
    catch (e: any) { Alert.alert('Error', e.message ?? 'Try again'); }
    finally { setBusy(false); }
  };
  const cancel = async () => {
    setBusy(true);
    try { await Api.cancelRsvp(params.id); await load(); } catch {} finally { setBusy(false); }
  };
  const del = async () => {
    Alert.alert('Delete event?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await Api.deleteEvent(params.id); nav.goBack(); } catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  if (!ev) return <View style={styles.center}><Text style={styles.meta}>Event not found.</Text></View>;

  const isCreator = me?.id === ev.creatorId;
  const start = new Date(ev.startsAt);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.dateBox}>
        <Text style={styles.dateMonth}>{start.toLocaleString('en-IN', { month: 'short' }).toUpperCase()}</Text>
        <Text style={styles.dateDay}>{start.getDate()}</Text>
      </View>
      <Text style={styles.title}>{ev.title}</Text>
      <Text style={styles.when}>{start.toLocaleString('en-IN', { weekday: 'long', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'long' })}</Text>
      <Text style={styles.loc}>📍 {ev.locationText}</Text>

      <Text style={styles.section}>About</Text>
      <Text style={styles.body}>{ev.description}</Text>

      <Text style={styles.section}>Hosted by</Text>
      <TouchableOpacity style={styles.creator} onPress={() => nav.navigate('UserProfile', { id: ev.creator.id })}>
        {ev.creator.avatarUrl ? <Image source={{ uri: ev.creator.avatarUrl }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarPh]}><Text>👤</Text></View>}
        <Text style={styles.creatorName}>{ev.creator.name ?? 'LOCALIO user'}</Text>
      </TouchableOpacity>

      <Text style={styles.section}>{ev._count?.rsvps ?? 0} people RSVPed{ev.capacity ? ` · cap ${ev.capacity}` : ''}</Text>
      <View style={styles.attRow}>
        {ev.rsvps?.slice(0, 8).map((r: any) => (
          <View key={r.id} style={styles.attCell}>
            {r.user?.avatarUrl ? <Image source={{ uri: r.user.avatarUrl }} style={styles.attAvatar} /> : <View style={[styles.attAvatar, styles.avatarPh]}><Text style={{ fontSize: 18 }}>👤</Text></View>}
            <Text style={styles.attName} numberOfLines={1}>{r.user?.name ?? '—'}</Text>
          </View>
        ))}
      </View>

      {!isCreator ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <TouchableOpacity
            style={[styles.btn, myRsvp?.status === 'going' ? styles.btnActive : styles.btnPrimary]}
            onPress={() => rsvp('going')}
            disabled={busy}
          >
            <Text style={styles.btnText}>{myRsvp?.status === 'going' ? '✓ Going' : 'Going'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, myRsvp?.status === 'interested' ? styles.btnActive : styles.btnGhost]}
            onPress={() => rsvp('interested')}
            disabled={busy}
          >
            <Text style={[styles.btnText, myRsvp?.status !== 'interested' && { color: theme.colors.primary }]}>
              {myRsvp?.status === 'interested' ? '✓ Interested' : 'Interested'}
            </Text>
          </TouchableOpacity>
          {myRsvp && (
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={cancel} disabled={busy}>
              <Text style={[styles.btnText, { color: theme.colors.danger }]}>Cancel RSVP</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <TouchableOpacity style={[styles.btn, { marginTop: 16, backgroundColor: theme.colors.danger }]} onPress={del}>
          <Text style={styles.btnText}>Delete event</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  meta: { color: theme.colors.textMuted },
  dateBox: { width: 68, backgroundColor: theme.colors.primary, borderRadius: theme.radius.md, padding: 10, alignItems: 'center' },
  dateMonth: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  dateDay: { color: '#fff', fontSize: 26, fontWeight: '900' },
  title: { fontSize: 24, fontWeight: '800', color: theme.colors.text, marginTop: 14 },
  when: { color: theme.colors.text, marginTop: 6, fontSize: 15 },
  loc: { color: theme.colors.textMuted, marginTop: 4 },
  section: { fontWeight: '800', color: theme.colors.text, marginTop: 20, marginBottom: 6 },
  body: { color: theme.colors.text, lineHeight: 22 },
  creator: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.border },
  avatarPh: { justifyContent: 'center', alignItems: 'center' },
  creatorName: { marginLeft: 10, fontWeight: '700', color: theme.colors.text },
  attRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  attCell: { width: 64, alignItems: 'center' },
  attAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.border },
  attName: { fontSize: 11, color: theme.colors.textMuted, marginTop: 4 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: theme.radius.md, alignItems: 'center' },
  btnPrimary: { backgroundColor: theme.colors.primary },
  btnGhost: { borderWidth: 1, borderColor: theme.colors.primary },
  btnActive: { backgroundColor: theme.colors.success },
  btnText: { color: '#fff', fontWeight: '800' },
});
