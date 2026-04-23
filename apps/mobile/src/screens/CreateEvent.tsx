import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Api } from '../api/client';
import { useLocation } from '../hooks/useLocation';
import { theme } from '../theme';

export function CreateEventScreen() {
  const nav = useNavigation<any>();
  const { coords } = useLocation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationText, setLocationText] = useState('');
  const [capacity, setCapacity] = useState('');
  const [when, setWhen] = useState(defaultWhen());
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (title.length < 3 || description.length < 5 || locationText.length < 2) {
      return Alert.alert('Missing info', 'Fill title, description, and location.');
    }
    const ts = Date.parse(when);
    if (isNaN(ts)) return Alert.alert('Invalid date', 'Use format YYYY-MM-DD HH:MM');
    setBusy(true);
    try {
      const { event } = await Api.createEvent({
        title, description, locationText,
        lat: coords.lat, lng: coords.lng,
        startsAt: new Date(ts).toISOString(),
        capacity: capacity ? parseInt(capacity, 10) : undefined,
      });
      nav.replace('EventDetail', { id: event.id });
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Try again');
    } finally { setBusy(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Label>Title</Label>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Sunday garage sale" placeholderTextColor={theme.colors.textMuted} />

      <Label>Description</Label>
      <TextInput style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]} multiline value={description} onChangeText={setDescription} placeholder="What's happening, who it's for…" placeholderTextColor={theme.colors.textMuted} />

      <Label>Location</Label>
      <TextInput style={styles.input} value={locationText} onChangeText={setLocationText} placeholder="Community hall, Tower B" placeholderTextColor={theme.colors.textMuted} />

      <Label>When (YYYY-MM-DD HH:MM)</Label>
      <TextInput style={styles.input} value={when} onChangeText={setWhen} placeholder="2026-05-10 18:00" placeholderTextColor={theme.colors.textMuted} autoCapitalize="none" />

      <Label>Capacity (optional)</Label>
      <TextInput style={styles.input} value={capacity} onChangeText={setCapacity} placeholder="50" keyboardType="number-pad" placeholderTextColor={theme.colors.textMuted} />

      <TouchableOpacity style={styles.btn} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Publish event</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

function defaultWhen(): string {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 18:00`;
}

const styles = StyleSheet.create({
  label: { color: theme.colors.text, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 12, backgroundColor: theme.colors.surface, color: theme.colors.text, fontSize: 15 },
  btn: { backgroundColor: theme.colors.primary, paddingVertical: 14, borderRadius: theme.radius.md, alignItems: 'center', marginTop: 22 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
