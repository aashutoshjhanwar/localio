import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Api } from '../api/client';
import { useLocation } from '../hooks/useLocation';
import { theme } from '../theme';

const CATS = ['electronics', 'furniture', 'vehicles', 'home', 'books', 'sports', 'fashion', 'other'];

export function CreateWantedScreen() {
  const nav = useNavigation<any>();
  const { coords } = useLocation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATS[0]);
  const [budget, setBudget] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (title.trim().length < 3 || description.trim().length < 5) {
      return Alert.alert('Missing info', 'Add a clear title and description.');
    }
    const maxBudget = budget ? parseInt(budget.replace(/[^0-9]/g, ''), 10) : undefined;
    setBusy(true);
    try {
      await Api.createWanted({
        title: title.trim(),
        description: description.trim(),
        category,
        maxBudgetPaise: maxBudget ? maxBudget * 100 : undefined,
        lat: coords.lat, lng: coords.lng,
      });
      nav.goBack();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'try again');
    } finally { setBusy(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.label}>What are you looking for?</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Looking for a used cycle" placeholderTextColor={theme.colors.textMuted} />

      <Text style={styles.label}>Details</Text>
      <TextInput
        style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]}
        multiline value={description} onChangeText={setDescription}
        placeholder="Condition, size, pickup preferences…" placeholderTextColor={theme.colors.textMuted}
      />

      <Text style={styles.label}>Category</Text>
      <View style={styles.chipRow}>
        {CATS.map((c) => (
          <TouchableOpacity key={c} style={[styles.chip, category === c && styles.chipOn]} onPress={() => setCategory(c)}>
            <Text style={[styles.chipText, category === c && { color: '#fff' }]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Max budget in ₹ (optional)</Text>
      <TextInput
        style={styles.input}
        value={budget} onChangeText={setBudget}
        keyboardType="number-pad" placeholder="e.g. 3000" placeholderTextColor={theme.colors.textMuted}
      />

      <TouchableOpacity style={[styles.btn, busy && { opacity: 0.7 }]} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Post request</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 16, marginBottom: 6, fontWeight: '700', color: theme.colors.text },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 12, backgroundColor: theme.colors.surface, color: theme.colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.colors.surface },
  chipOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { color: theme.colors.text, fontWeight: '700', fontSize: 13, textTransform: 'capitalize' },
  btn: { backgroundColor: theme.colors.primary, padding: 16, borderRadius: theme.radius.md, alignItems: 'center', marginTop: 24 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
