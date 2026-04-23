import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, StyleSheet, Alert, ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Api } from '../api/client';
import { compressToBase64 } from '../utils/image';
import { theme } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onDone?: () => void;
  toId: string;
  context: 'listing' | 'service';
  contextId: string;
  title?: string;
};

export function RateModal({ visible, onClose, onDone, toId, context, contextId, title }: Props) {
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);

  async function addPhoto() {
    if (photos.length >= 3) return;
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled || !res.assets?.[0]) return;
    try {
      setPicking(true);
      const base64 = await compressToBase64(res.assets[0].uri, { maxWidth: 1280, quality: 0.7 });
      const { url } = await Api.upload('review.jpg', 'image/jpeg', base64);
      setPhotos((p) => [...p, url]);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'try again');
    } finally { setPicking(false); }
  }

  async function submit() {
    if (stars < 1) return Alert.alert('Pick a star rating');
    try {
      setSaving(true);
      await Api.rate({
        toId, context, contextId, stars,
        review: review.trim() || undefined,
        photoUrls: photos.length ? photos : undefined,
      });
      onDone?.();
      onClose();
      setStars(0); setReview(''); setPhotos([]);
    } catch (e: any) {
      Alert.alert('Could not submit', e.message ?? 'try again');
    } finally { setSaving(false); }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title ?? 'Rate your experience'}</Text>
          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} onPress={() => setStars(n)}>
                <Text style={[styles.star, stars >= n && styles.starOn]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.input}
            placeholder="Optional review"
            placeholderTextColor={theme.colors.textMuted}
            multiline value={review} onChangeText={setReview}
          />
          <View style={styles.photoRow}>
            {photos.map((u) => (
              <View key={u} style={styles.photoWrap}>
                <Image source={{ uri: u }} style={styles.photo} />
                <TouchableOpacity style={styles.photoRm} onPress={() => setPhotos((p) => p.filter((x) => x !== u))}>
                  <Text style={styles.photoRmText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 3 && (
              <TouchableOpacity onPress={addPhoto} style={[styles.photo, styles.photoAdd]} disabled={picking}>
                {picking ? <ActivityIndicator color={theme.colors.primary} /> : <Text style={{ fontSize: 24, color: theme.colors.textMuted }}>📷</Text>}
              </TouchableOpacity>
            )}
          </View>
          <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onClose}>
              <Text style={[styles.btnText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={submit} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.bg, padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  title: { fontSize: 18, fontWeight: '800', color: theme.colors.text, marginBottom: 12 },
  stars: { flexDirection: 'row', justifyContent: 'center', marginVertical: 6 },
  star: { fontSize: 44, color: theme.colors.border, marginHorizontal: 4 },
  starOn: { color: '#F5A623' },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    padding: 12, backgroundColor: theme.colors.surface, color: theme.colors.text,
    minHeight: 80, textAlignVertical: 'top', marginTop: 10,
  },
  photoRow: { flexDirection: 'row', marginTop: 10, gap: 8 },
  photoWrap: { position: 'relative' },
  photo: { width: 70, height: 70, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface },
  photoAdd: { justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: theme.colors.border },
  photoRm: {
    position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: theme.colors.danger, justifyContent: 'center', alignItems: 'center',
  },
  photoRmText: { color: '#fff', fontWeight: '900', marginTop: -2 },
  btn: { flex: 1, backgroundColor: theme.colors.primary, padding: 14, borderRadius: theme.radius.md, alignItems: 'center' },
  btnGhost: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, flex: 0, paddingHorizontal: 20 },
  btnText: { color: '#fff', fontWeight: '800' },
});
