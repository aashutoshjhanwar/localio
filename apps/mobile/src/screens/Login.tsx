import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Api } from '../api/client';
import { useAuth } from '../state/auth';
import { registerPushToken } from '../push';
import { theme } from '../theme';
import { useT } from '../i18n';

export function LoginScreen() {
  const t = useT();
  const [phone, setPhone] = useState('+91');
  const [code, setCode] = useState('');
  const [referral, setReferral] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const login = useAuth((s) => s.login);

  async function sendOtp() {
    const normalized = phone.replace(/\s+/g, '');
    if (!/^\+?[0-9]{10,15}$/.test(normalized)) {
      return Alert.alert('Invalid phone', 'Enter a valid mobile number.');
    }
    try {
      setLoading(true);
      await Api.requestOtp(normalized);
      setStep('otp');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not send OTP');
    } finally { setLoading(false); }
  }

  async function verify() {
    if (code.length !== 6) return Alert.alert('Invalid code', '6-digit code expected');
    try {
      setLoading(true);
      const { token, user } = await Api.verifyOtp(phone.replace(/\s+/g, ''), code, referral.trim().toUpperCase() || undefined);
      await login(token, user);
      registerPushToken().catch(() => {});
    } catch (e: any) {
      Alert.alert('Wrong code', e.message ?? 'Try again');
    } finally { setLoading(false); }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <View style={styles.hero}>
          <Text style={styles.logo}>LOCALIO</Text>
          <Text style={styles.tagline}>{t('login_tagline')}</Text>
        </View>

        {step === 'phone' ? (
          <>
            <Text style={styles.label}>{t('login_phone_label')}</Text>
            <TextInput
              style={styles.input}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
              placeholder={t('login_phone_placeholder')}
              placeholderTextColor={theme.colors.textMuted}
              autoFocus
            />
            <TouchableOpacity style={styles.btn} onPress={sendOtp} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t('login_send_otp')}</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.label}>{t('login_otp_label')}</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={code}
              onChangeText={setCode}
              maxLength={6}
              autoFocus
              placeholder="••••••"
              placeholderTextColor={theme.colors.textMuted}
            />
            <Text style={[styles.label, { marginTop: 18 }]}>{t('login_referral')}</Text>
            <TextInput
              style={styles.input}
              value={referral}
              onChangeText={setReferral}
              autoCapitalize="characters"
              maxLength={8}
              placeholder="e.g. ABC123"
              placeholderTextColor={theme.colors.textMuted}
            />
            <TouchableOpacity style={styles.btn} onPress={verify} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t('login_verify')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep('phone')}>
              <Text style={styles.linkMuted}>{t('login_change_number')}</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={styles.footer}>{t('login_terms')}</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  wrap: { flex: 1, padding: 24, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: 48 },
  logo: { fontSize: 44, fontWeight: '900', color: theme.colors.primary, letterSpacing: 1 },
  tagline: { marginTop: 8, color: theme.colors.textMuted, fontSize: 15 },
  label: { color: theme.colors.text, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: 18, color: theme.colors.text,
    backgroundColor: theme.colors.surface,
  },
  btn: {
    backgroundColor: theme.colors.primary, borderRadius: theme.radius.md,
    paddingVertical: 16, alignItems: 'center', marginTop: 16,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  linkMuted: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 16 },
  footer: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 24, fontSize: 12 },
});
