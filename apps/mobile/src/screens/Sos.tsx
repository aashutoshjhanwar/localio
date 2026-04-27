import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { Api } from '../api/client';
import { theme } from '../theme';
import { useT } from '../i18n';

export function SosScreen() {
  const nav = useNavigation<any>();
  const t = useT();
  const CATEGORIES: Array<{ key: 'medical' | 'security' | 'fire' | 'other'; label: string; emoji: string }> = [
    { key: 'medical', label: t('sos_cat_medical'), emoji: '🩺' },
    { key: 'security', label: t('sos_cat_security'), emoji: '🛡️' },
    { key: 'fire', label: t('sos_cat_fire'), emoji: '🔥' },
    { key: 'other', label: t('sos_cat_other'), emoji: '⚠️' },
  ];
  const [category, setCategory] = useState<'medical' | 'security' | 'fire' | 'other'>('other');
  const [body, setBody] = useState('');
  const [radiusKm, setRadiusKm] = useState(3);
  const [sending, setSending] = useState(false);

  async function broadcast() {
    if (body.trim().length < 2) return Alert.alert(t('sos_add_message'), t('sos_add_message_body'));
    setSending(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') throw new Error(t('err_location_permission'));
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const r = await Api.sendSos({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        body: body.trim(),
        category,
        radiusKm,
      });
      Alert.alert(t('sos_sent_title'), t('sos_sent_body', r.reached), [
        { text: t('okay'), onPress: () => nav.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert(t('err_generic'), e.message ?? 'Failed to send SOS');
    } finally {
      setSending(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: theme.spacing(4) }}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>{t('sos_banner_title')}</Text>
        <Text style={styles.bannerBody}>{t('sos_banner_body')}</Text>
      </View>

      <Text style={styles.label}>{t('sos_type_label')}</Text>
      <View style={styles.catRow}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c.key}
            style={[styles.cat, category === c.key && styles.catActive]}
            onPress={() => setCategory(c.key)}
          >
            <Text style={styles.catEmoji}>{c.emoji}</Text>
            <Text style={[styles.catLabel, category === c.key && { color: theme.colors.danger, fontWeight: '700' }]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>{t('sos_message_label')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('sos_message_placeholder')}
        value={body}
        onChangeText={setBody}
        multiline
        maxLength={500}
      />

      <Text style={styles.label}>{t('sos_radius_label')}</Text>
      <View style={styles.radiusRow}>
        {[1, 3, 5, 10].map((r) => (
          <TouchableOpacity
            key={r}
            style={[styles.radiusPill, radiusKm === r && styles.radiusPillActive]}
            onPress={() => setRadiusKm(r)}
          >
            <Text style={[styles.radiusTxt, radiusKm === r && { color: '#fff', fontWeight: '700' }]}>
              {r} km
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.sendBtn} onPress={broadcast} disabled={sending}>
        {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendTxt}>{t('sos_broadcast')}</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  banner: { backgroundColor: theme.colors.dangerSoft, padding: theme.spacing(3), borderRadius: theme.radius.md, marginBottom: theme.spacing(4) },
  bannerTitle: { fontWeight: '800', color: theme.colors.danger, fontSize: theme.font.size.md },
  bannerBody: { color: theme.colors.text, marginTop: 4, lineHeight: 20 },
  label: { fontWeight: '700', color: theme.colors.text, marginBottom: theme.spacing(2) },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: theme.spacing(4) },
  cat: { paddingVertical: theme.spacing(2), paddingHorizontal: theme.spacing(3), borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card, alignItems: 'center', minWidth: 80 },
  catActive: { borderColor: theme.colors.danger, backgroundColor: theme.colors.dangerSoft },
  catEmoji: { fontSize: 22 },
  catLabel: { color: theme.colors.textMuted, marginTop: 2 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: theme.spacing(3), minHeight: 100, textAlignVertical: 'top', backgroundColor: theme.colors.card, marginBottom: theme.spacing(4) },
  radiusRow: { flexDirection: 'row', gap: 8, marginBottom: theme.spacing(5) },
  radiusPill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card },
  radiusPillActive: { backgroundColor: theme.colors.danger, borderColor: theme.colors.danger },
  radiusTxt: { color: theme.colors.text },
  sendBtn: { backgroundColor: theme.colors.danger, padding: theme.spacing(4), borderRadius: theme.radius.md, alignItems: 'center', ...theme.shadow.md },
  sendTxt: { color: '#fff', fontWeight: '800', fontSize: theme.font.size.md, letterSpacing: 0.5 },
});
