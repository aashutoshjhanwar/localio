import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Api } from '../api/client';
import { useLocation } from '../hooks/useLocation';
import { theme } from '../theme';

export function CreatePollScreen() {
  const nav = useNavigation<any>();
  const { coords } = useLocation();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [busy, setBusy] = useState(false);

  const setOpt = (i: number, v: string) => setOptions((prev) => prev.map((x, idx) => (idx === i ? v : x)));
  const addOpt = () => options.length < 6 && setOptions([...options, '']);
  const rmOpt = (i: number) => options.length > 2 && setOptions(options.filter((_, idx) => idx !== i));

  const submit = async () => {
    const clean = options.map((o) => o.trim()).filter(Boolean);
    if (question.trim().length < 3) return Alert.alert('Question too short', 'Add a clear question.');
    if (clean.length < 2) return Alert.alert('Need 2 options', 'Add at least two choices.');
    setBusy(true);
    try {
      const { poll } = await Api.createPoll({
        question: question.trim(),
        options: clean,
        lat: coords.lat, lng: coords.lng,
      });
      nav.replace('PollDetail', { id: poll.id });
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Try again');
    } finally { setBusy(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.label}>Question</Text>
      <TextInput
        style={styles.input}
        value={question}
        onChangeText={setQuestion}
        placeholder="Should we organize a Holi meet-up?"
        placeholderTextColor={theme.colors.textMuted}
        maxLength={300}
      />

      <Text style={styles.label}>Options</Text>
      {options.map((o, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            value={o}
            onChangeText={(v) => setOpt(i, v)}
            placeholder={`Option ${i + 1}`}
            placeholderTextColor={theme.colors.textMuted}
            maxLength={120}
          />
          {options.length > 2 && (
            <TouchableOpacity onPress={() => rmOpt(i)} style={styles.rmBtn}>
              <Text style={{ color: theme.colors.danger, fontWeight: '800' }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
      {options.length < 6 && (
        <TouchableOpacity onPress={addOpt} style={styles.addBtn}>
          <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>+ Add option</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.btn} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Publish poll</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: { color: theme.colors.text, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 12, backgroundColor: theme.colors.surface, color: theme.colors.text, fontSize: 15 },
  rmBtn: { marginLeft: 8, padding: 10 },
  addBtn: { padding: 10, alignSelf: 'flex-start' },
  btn: { backgroundColor: theme.colors.primary, paddingVertical: 14, borderRadius: theme.radius.md, alignItems: 'center', marginTop: 22 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
