import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, Image, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { compressToBase64 } from '../utils/image';
import { Api } from '../api/client';
import { useAuth } from '../state/auth';
import { theme } from '../theme';

const DOC_TYPES: { key: 'aadhaar' | 'pan' | 'dl' | 'passport'; label: string }[] = [
  { key: 'aadhaar', label: 'Aadhaar' },
  { key: 'pan', label: 'PAN' },
  { key: 'dl', label: 'Driving licence' },
  { key: 'passport', label: 'Passport' },
];

export function KycScreen() {
  const me = useAuth((s) => s.user);
  const [docType, setDocType] = useState<typeof DOC_TYPES[number]['key']>('aadhaar');
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<'doc' | 'selfie' | 'submit' | null>(null);
  const [latest, setLatest] = useState<any>(null);

  const load = () => Api.myKyc().then((r) => setLatest(r.submissions[0] ?? null)).catch(() => {});
  useEffect(() => { load(); }, []);

  const pick = async (kind: 'doc' | 'selfie') => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setBusy(kind);
    try {
      const base64 = await compressToBase64(a.uri, { maxWidth: 1600, quality: 0.8 });
      const { url } = await Api.upload('kyc.jpg', 'image/jpeg', base64);
      if (kind === 'doc') setDocUrl(url); else setSelfieUrl(url);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'try again');
    } finally { setBusy(null); }
  };

  const submit = async () => {
    if (!docUrl || !selfieUrl) return Alert.alert('Missing photos', 'Upload ID and a selfie.');
    setBusy('submit');
    try {
      await Api.submitKyc({ docType, docUrl, selfieUrl });
      setDocUrl(null); setSelfieUrl(null);
      await load();
      Alert.alert('Submitted', 'Your KYC is under review. You\'ll be notified when it\'s approved.');
    } catch (e: any) {
      Alert.alert('Error', e.message?.includes('pending_exists') ? 'You already have a pending submission.' : e.message ?? 'try again');
    } finally { setBusy(null); }
  };

  if (me?.kycVerified) {
    return (
      <View style={styles.center}>
        <Text style={styles.verifiedTitle}>✅ You are KYC verified</Text>
        <Text style={styles.verifiedSub}>Your profile shows the verified badge.</Text>
      </View>
    );
  }

  const pending = latest?.status === 'pending';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.intro}>
        Verify your identity to earn the ✅ badge, rank higher in search, and unlock higher-trust features.
      </Text>

      {pending && (
        <View style={styles.pendingCard}>
          <Text style={styles.pendingTitle}>Under review</Text>
          <Text style={styles.pendingSub}>Submitted {new Date(latest.createdAt).toLocaleString('en-IN')}. We usually reply within 48 hours.</Text>
        </View>
      )}

      {latest?.status === 'rejected' && (
        <View style={[styles.pendingCard, { borderColor: theme.colors.danger }]}>
          <Text style={[styles.pendingTitle, { color: theme.colors.danger }]}>Previous submission rejected</Text>
          {latest.reason ? <Text style={styles.pendingSub}>Reason: {latest.reason}</Text> : null}
          <Text style={styles.pendingSub}>Please resubmit with clearer photos.</Text>
        </View>
      )}

      <Text style={styles.label}>Document type</Text>
      <View style={styles.chipRow}>
        {DOC_TYPES.map((d) => (
          <TouchableOpacity
            key={d.key}
            style={[styles.chip, docType === d.key && styles.chipOn]}
            onPress={() => setDocType(d.key)}
            disabled={pending}
          >
            <Text style={[styles.chipText, docType === d.key && { color: '#fff' }]}>{d.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Photo of your ID</Text>
      <TouchableOpacity style={styles.photoSlot} onPress={() => pick('doc')} disabled={busy === 'doc' || pending}>
        {docUrl ? <Image source={{ uri: docUrl }} style={styles.photo} /> : busy === 'doc' ? <ActivityIndicator color={theme.colors.primary} /> : <Text style={styles.photoHint}>Tap to upload ID photo</Text>}
      </TouchableOpacity>

      <Text style={styles.label}>Selfie holding the ID</Text>
      <TouchableOpacity style={styles.photoSlot} onPress={() => pick('selfie')} disabled={busy === 'selfie' || pending}>
        {selfieUrl ? <Image source={{ uri: selfieUrl }} style={styles.photo} /> : busy === 'selfie' ? <ActivityIndicator color={theme.colors.primary} /> : <Text style={styles.photoHint}>Tap to upload selfie</Text>}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.btn, (pending || busy === 'submit') && { opacity: 0.6 }]}
        onPress={submit}
        disabled={pending || busy === 'submit'}
      >
        {busy === 'submit' ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit for review</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  verifiedTitle: { fontSize: 22, fontWeight: '800', color: theme.colors.success },
  verifiedSub: { color: theme.colors.textMuted, marginTop: 8, textAlign: 'center' },
  intro: { color: theme.colors.text, lineHeight: 20 },
  pendingCard: { borderWidth: 1, borderColor: theme.colors.primary, borderRadius: theme.radius.md, padding: 12, marginTop: 14 },
  pendingTitle: { color: theme.colors.primary, fontWeight: '800' },
  pendingSub: { color: theme.colors.textMuted, fontSize: 12, marginTop: 4 },
  label: { marginTop: 18, marginBottom: 6, fontWeight: '700', color: theme.colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: theme.colors.surface },
  chipOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { color: theme.colors.text, fontWeight: '700', fontSize: 13 },
  photoSlot: {
    borderWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.border, borderRadius: theme.radius.md,
    height: 160, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.surface, overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  photoHint: { color: theme.colors.textMuted },
  btn: { backgroundColor: theme.colors.primary, padding: 16, borderRadius: theme.radius.md, alignItems: 'center', marginTop: 24 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
