import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Api } from '../api/client';
import { useLocation } from '../hooks/useLocation';
import { theme } from '../theme';

const UNITS = [
  { key: 'per_visit', label: 'per visit' },
  { key: 'per_hour', label: 'per hour' },
  { key: 'per_job', label: 'per job' },
  { key: 'per_month', label: 'per month' },
] as const;

export function CreateServiceScreen() {
  const { coords } = useLocation();
  const nav = useNavigation<any>();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [priceFrom, setPriceFrom] = useState('');
  const [unit, setUnit] = useState<typeof UNITS[number]['key']>('per_visit');
  const [category, setCategory] = useState('other');
  const [cats, setCats] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Api.categories().then((r) => setCats(r.services)).catch(() => {});
  }, []);

  async function submit() {
    if (title.length < 3) return Alert.alert('Title too short');
    if (desc.length < 5) return Alert.alert('Describe what you offer');
    const priceNum = priceFrom ? parseInt(priceFrom, 10) : 0;
    try {
      setSaving(true);
      const { service } = await Api.createService({
        title, description: desc, category,
        priceFrom: priceNum * 100,
        priceUnit: unit,
        lat: coords.lat, lng: coords.lng,
      });
      nav.replace('ServiceDetail', { id: service.id });
    } catch (e: any) {
      Alert.alert('Could not publish', e.message ?? 'try again');
    } finally { setSaving(false); }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.label}>Service title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Home cleaning, Plumbing, Tutor" placeholderTextColor={theme.colors.textMuted} />

      <Text style={styles.label}>Starting price (₹)</Text>
      <TextInput style={styles.input} keyboardType="number-pad" value={priceFrom} onChangeText={setPriceFrom} placeholder="Optional" placeholderTextColor={theme.colors.textMuted} />

      <Text style={styles.label}>Rate type</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 }}>
        {UNITS.map((u) => (
          <TouchableOpacity key={u.key} onPress={() => setUnit(u.key)} style={[styles.chip, unit === u.key && styles.chipActive]}>
            <Text style={[styles.chipText, unit === u.key && { color: '#fff' }]}>{u.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {cats.map((c) => (
          <TouchableOpacity key={c.key} onPress={() => setCategory(c.key)} style={[styles.chip, category === c.key && styles.chipActive]}>
            <Text style={[styles.chipText, category === c.key && { color: '#fff' }]}>{c.icon} {c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.label}>About your service</Text>
      <TextInput
        style={[styles.input, { minHeight: 120, textAlignVertical: 'top' }]}
        multiline value={desc} onChangeText={setDesc}
        placeholder="What you do, years of experience, service area…"
        placeholderTextColor={theme.colors.textMuted}
      />

      <TouchableOpacity style={styles.btn} onPress={submit} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Publish service</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: '700', color: theme.colors.text, marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    padding: 12, backgroundColor: theme.colors.surface, color: theme.colors.text, fontSize: 16,
  },
  chip: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, marginBottom: 8, backgroundColor: theme.colors.surface,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { color: theme.colors.text },
  btn: { backgroundColor: theme.colors.primary, padding: 16, borderRadius: theme.radius.md, alignItems: 'center', marginTop: 20 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
