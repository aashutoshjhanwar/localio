import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { compressToBase64 } from '../utils/image';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Api } from '../api/client';
import { theme } from '../theme';
import { attrFields } from '../utils/listingAttributes';
import type { RootStackParamList } from '../nav/RootNav';

type R = RouteProp<RootStackParamList, 'EditListing'>;

export function EditListingScreen() {
  const { params } = useRoute<R>();
  const nav = useNavigation<any>();
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [category, setCategory] = useState('other');
  const [attributes, setAttributes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Api.listing(params.id).then((r) => {
      const l = r.listing;
      setTitle(l.title);
      setDesc(l.description);
      setPrice(String(Math.floor(l.priceInPaise / 100)));
      setImages(l.images ?? []);
      setCategory(l.category ?? 'other');
      const raw = l.attributes ?? {};
      const strMap: Record<string, string> = {};
      Object.entries(raw).forEach(([k, v]) => { strMap[k] = String(v); });
      setAttributes(strMap);
    }).catch((e: any) => Alert.alert('Could not load', e.message ?? 'try again'))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function pick() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], quality: 1,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    try {
      const base64 = await compressToBase64(a.uri);
      const { url } = await Api.upload('photo.jpg', 'image/jpeg', base64);
      setImages((p) => [...p, url]);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'try again');
    }
  }

  function removeImage(url: string) {
    setImages((p) => p.filter((u) => u !== url));
  }

  async function save() {
    const priceNum = parseInt(price || '0', 10);
    if (title.length < 3) return Alert.alert('Title too short');
    if (desc.length < 5) return Alert.alert('Description too short');
    if (!priceNum || priceNum < 0) return Alert.alert('Enter valid price');
    try {
      setSaving(true);
      const cleanAttrs = Object.fromEntries(Object.entries(attributes).filter(([, v]) => v && String(v).trim()));
      await Api.updateListing(params.id, {
        title, description: desc, priceInPaise: priceNum * 100, images,
        attributes: cleanAttrs,
      });
      nav.goBack();
    } catch (e: any) {
      Alert.alert('Could not save', e.message ?? 'try again');
    } finally { setSaving(false); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholderTextColor={theme.colors.textMuted} />

      <Text style={styles.label}>Price (₹)</Text>
      <TextInput style={styles.input} keyboardType="number-pad" value={price} onChangeText={setPrice} placeholderTextColor={theme.colors.textMuted} />

      {attrFields(category).length > 0 && (
        <View>
          <Text style={styles.label}>Details</Text>
          {attrFields(category).map((f) => {
            const val = attributes[f.key] ?? '';
            if (f.type === 'choice') {
              return (
                <View key={f.key} style={{ marginBottom: 10 }}>
                  <Text style={styles.attrLabel}>{f.label}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {f.options.map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.attrChip, val === opt && styles.attrChipActive]}
                        onPress={() => setAttributes((a) => ({ ...a, [f.key]: val === opt ? '' : opt }))}
                      >
                        <Text style={[styles.attrChipText, val === opt && { color: '#fff' }]}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              );
            }
            return (
              <View key={f.key} style={{ marginBottom: 10 }}>
                <Text style={styles.attrLabel}>{f.label}{f.type === 'number' && f.suffix ? ` (${f.suffix})` : ''}</Text>
                <TextInput
                  style={styles.input}
                  value={val}
                  onChangeText={(v) => setAttributes((a) => ({ ...a, [f.key]: v }))}
                  placeholder={f.placeholder ?? ''}
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType={f.type === 'number' ? 'number-pad' : 'default'}
                />
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]}
        multiline value={desc} onChangeText={setDesc} placeholderTextColor={theme.colors.textMuted}
      />

      <Text style={styles.label}>Photos</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {images.map((u) => (
          <TouchableOpacity key={u} onLongPress={() => removeImage(u)}>
            <Image source={{ uri: u }} style={styles.img} />
          </TouchableOpacity>
        ))}
        {images.length < 6 && (
          <TouchableOpacity onPress={pick} style={[styles.img, styles.imgAdd]}>
            <Text style={{ fontSize: 28, color: theme.colors.textMuted }}>+</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.hint}>Long-press a photo to remove it.</Text>

      <TouchableOpacity style={styles.btn} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save changes</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  label: { fontWeight: '700', color: theme.colors.text, marginTop: 12, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    padding: 12, backgroundColor: theme.colors.surface, color: theme.colors.text, fontSize: 16,
  },
  img: { width: 80, height: 80, borderRadius: theme.radius.md, marginRight: 8, marginBottom: 8, backgroundColor: '#EEE' },
  imgAdd: { justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: theme.colors.border, borderStyle: 'dashed', backgroundColor: theme.colors.surface },
  hint: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  btn: { backgroundColor: theme.colors.primary, padding: 16, borderRadius: theme.radius.md, alignItems: 'center', marginTop: 20 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  attrLabel: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase' },
  attrChip: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.pill,
    paddingHorizontal: 12, paddingVertical: 7, marginRight: 6, backgroundColor: theme.colors.card,
  },
  attrChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  attrChipText: { color: theme.colors.text, fontWeight: '600', fontSize: 13 },
});
