import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { compressToBase64 } from '../utils/image';
import { useNavigation } from '@react-navigation/native';
import { Api } from '../api/client';
import { useLocation } from '../hooks/useLocation';
import { theme } from '../theme';

const KINDS = [
  { key: 'question', label: '❓ Ask a question' },
  { key: 'recommendation', label: '⭐ Recommendation' },
  { key: 'lost_found', label: '🔎 Lost / Found' },
  { key: 'announcement', label: '📣 Announcement' },
  { key: 'safety', label: '⚠️ Safety alert' },
] as const;

export function CreatePostScreen() {
  const nav = useNavigation<any>();
  const { coords } = useLocation();
  const [kind, setKind] = useState<typeof KINDS[number]['key']>('question');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    try {
      const base64 = await compressToBase64(a.uri);
      const { url } = await Api.upload('photo.jpg', 'image/jpeg', base64);
      setImages((prev) => [...prev, url]);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'try again');
    }
  };

  const submit = async () => {
    if (title.trim().length < 3 || body.trim().length < 3) {
      return Alert.alert('Missing info', 'Add a title and body (min 3 chars each).');
    }
    setBusy(true);
    try {
      const { post } = await Api.createPost({
        kind, title: title.trim(), body: body.trim(),
        lat: coords.lat, lng: coords.lng,
        images: images.length ? images : undefined,
      });
      nav.replace('PostDetail', { id: post.id });
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Try again');
    } finally { setBusy(false); }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.label}>Kind</Text>
      <View style={styles.kindRow}>
        {KINDS.map((k) => (
          <TouchableOpacity
            key={k.key}
            style={[styles.kind, kind === k.key && styles.kindOn]}
            onPress={() => setKind(k.key)}
          >
            <Text style={[styles.kindText, kind === k.key && { color: '#fff' }]}>{k.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="Best paediatrician near Bohra Ganesh?"
        placeholderTextColor={theme.colors.textMuted}
        maxLength={200}
      />

      <Text style={styles.label}>Body</Text>
      <TextInput
        style={[styles.input, { minHeight: 140, textAlignVertical: 'top' }]}
        multiline
        value={body}
        onChangeText={setBody}
        placeholder="Share details so neighbors can help…"
        placeholderTextColor={theme.colors.textMuted}
        maxLength={4000}
      />

      <Text style={styles.label}>Photos (optional)</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {images.map((u) => (
          <TouchableOpacity key={u} onLongPress={() => setImages((p) => p.filter((x) => x !== u))}>
            <Image source={{ uri: u }} style={styles.img} />
          </TouchableOpacity>
        ))}
        {images.length < 4 && (
          <TouchableOpacity onPress={pick} style={[styles.img, styles.imgAdd]}>
            <Text style={{ fontSize: 28, color: theme.colors.textMuted }}>+</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={styles.btn} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Post to neighborhood</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: { color: theme.colors.text, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 12, backgroundColor: theme.colors.surface, color: theme.colors.text, fontSize: 15 },
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kind: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.colors.surface },
  kindOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  kindText: { color: theme.colors.text, fontWeight: '700', fontSize: 13 },
  img: { width: 80, height: 80, borderRadius: theme.radius.md, marginRight: 8, marginBottom: 8, backgroundColor: '#EEE' },
  imgAdd: { justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: theme.colors.border, borderStyle: 'dashed', backgroundColor: theme.colors.surface },
  btn: { backgroundColor: theme.colors.primary, paddingVertical: 14, borderRadius: theme.radius.md, alignItems: 'center', marginTop: 22 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
