import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { RouteProp, useFocusEffect, useRoute } from '@react-navigation/native';
import { Api } from '../api/client';
import { theme } from '../theme';
import type { RootStackParamList } from '../nav/RootNav';

type R = RouteProp<RootStackParamList, 'ManageSlots'>;

export function ManageSlotsScreen() {
  const { params } = useRoute<R>();
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(defaultDate());
  const [from, setFrom] = useState('10:00');
  const [to, setTo] = useState('11:00');

  const load = useCallback(async () => {
    try { const r = await Api.serviceSlots(params.serviceId); setSlots(r.slots); }
    catch {} finally { setLoading(false); }
  }, [params.serviceId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const add = async () => {
    const startsAt = combine(date, from);
    const endsAt = combine(date, to);
    if (!startsAt || !endsAt) return Alert.alert('Invalid date/time', 'Use YYYY-MM-DD and HH:MM.');
    if (endsAt.getTime() <= startsAt.getTime()) return Alert.alert('End must be after start');
    if (startsAt.getTime() < Date.now()) return Alert.alert('Slot is in the past');
    setBusy(true);
    try {
      await Api.createSlot({
        serviceId: params.serviceId,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      });
      await load();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    try { await Api.deleteSlot(id); await load(); }
    catch (e: any) { Alert.alert('Error', e.message); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.section}>Add a new slot</Text>
      <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
      <TextInput style={styles.input} value={date} onChangeText={setDate} autoCapitalize="none" placeholderTextColor={theme.colors.textMuted} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>From (HH:MM)</Text>
          <TextInput style={styles.input} value={from} onChangeText={setFrom} autoCapitalize="none" placeholderTextColor={theme.colors.textMuted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>To (HH:MM)</Text>
          <TextInput style={styles.input} value={to} onChangeText={setTo} autoCapitalize="none" placeholderTextColor={theme.colors.textMuted} />
        </View>
      </View>
      <TouchableOpacity style={styles.btn} onPress={add} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Add slot</Text>}
      </TouchableOpacity>

      <Text style={[styles.section, { marginTop: 24 }]}>Upcoming slots ({slots.length})</Text>
      {slots.length === 0 && <Text style={styles.meta}>No slots yet. Add your availability above.</Text>}
      {slots.map((s) => (
        <View key={s.id} style={styles.slot}>
          <View style={{ flex: 1 }}>
            <Text style={styles.slotTime}>
              {new Date(s.startsAt).toLocaleString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {' → '}
              {new Date(s.endsAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Text style={[styles.meta, s.status === 'booked' && { color: theme.colors.primary, fontWeight: '800' }]}>
              {s.status === 'booked' ? '✓ Booked' : 'Open'}
            </Text>
          </View>
          {s.status !== 'booked' && (
            <TouchableOpacity onPress={() => remove(s.id)} style={styles.delBtn}>
              <Text style={{ color: theme.colors.danger, fontWeight: '800' }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function defaultDate(): string {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function combine(date: string, hhmm: string): Date | null {
  const ts = Date.parse(`${date}T${hhmm}:00`);
  return isNaN(ts) ? null : new Date(ts);
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  section: { fontWeight: '800', color: theme.colors.text, fontSize: 16, marginBottom: 10 },
  label: { color: theme.colors.text, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 12, backgroundColor: theme.colors.surface, color: theme.colors.text, fontSize: 15 },
  btn: { backgroundColor: theme.colors.primary, paddingVertical: 14, borderRadius: theme.radius.md, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#fff', fontWeight: '800' },
  slot: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, padding: 12, borderRadius: theme.radius.md, marginBottom: 8 },
  slotTime: { color: theme.colors.text, fontWeight: '700' },
  meta: { color: theme.colors.textMuted, marginTop: 2, fontSize: 13 },
  delBtn: { padding: 10 },
});
