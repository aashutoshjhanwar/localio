import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ScrollView, Image, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { compressToBase64 } from '../utils/image';
import { useNavigation } from '@react-navigation/native';
import { Api } from '../api/client';
import { useAuth } from '../state/auth';
import { closeSocket } from '../api/socket';
import { theme } from '../theme';
import { useI18n, useT } from '../i18n';

export function ProfileScreen() {
  const t = useT();
  const { locale, setLocale } = useI18n();
  const { user, setUser, logout } = useAuth();
  const nav = useNavigation<any>();
  const [name, setName] = useState(user?.name ?? '');
  const [bio, setBio] = useState('');
  const [society, setSociety] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function pickAvatar() {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      setUploading(true);
      const base64 = await compressToBase64(a.uri, { maxWidth: 512 });
      const { url } = await Api.upload('avatar.jpg', 'image/jpeg', base64);
      const { user: u } = await Api.updateMe({ avatarUrl: url });
      await setUser({ id: u.id, phone: u.phone, name: u.name, avatarUrl: u.avatarUrl, societyId: u.societyId, kycVerified: u.kycVerified });
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'try again');
    } finally { setUploading(false); }
  }

  useEffect(() => {
    Api.me().then((r) => {
      setName(r.user.name ?? '');
      setBio(r.user.bio ?? '');
      setSociety(r.user.society ?? null);
    }).catch(() => {});
  }, []);

  async function save() {
    try {
      const { user: u } = await Api.updateMe({ name, bio });
      await setUser({ id: u.id, phone: u.phone, name: u.name, avatarUrl: u.avatarUrl, societyId: u.societyId, kycVerified: u.kycVerified });
      setEditing(false);
    } catch (e: any) {
      Alert.alert('Could not save', e.message ?? 'try again');
    }
  }

  async function doLogout() {
    closeSocket();
    await logout();
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={pickAvatar} disabled={uploading} activeOpacity={0.8}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPh]}><Text style={{ fontSize: 32 }}>👤</Text></View>
          )}
          <View style={styles.camBadge}>
            {uploading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontSize: 14 }}>📷</Text>}
          </View>
        </TouchableOpacity>
        <Text style={styles.name}>{name || t('set_your_name')}</Text>
        <Text style={styles.phone}>{user?.phone}</Text>
        {user?.kycVerified && <Text style={styles.verified}>{t('kyc_verified')}</Text>}
      </View>

      <TouchableOpacity style={styles.card} onPress={() => nav.navigate('JoinSociety')}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.section}>{t('your_neighbourhood')}</Text>
            <Text style={styles.value}>{society ? `${society.name}, ${society.city}` : t('not_set_tap_to_join')}</Text>
          </View>
          <Text style={{ color: theme.colors.textMuted }}>›</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => nav.navigate('MyTrust')}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.section}>🏆  Trust score & badges</Text>
          <Text style={{ color: theme.colors.textMuted }}>›</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => nav.navigate('SearchChats')}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.section}>🔎  Search all chats</Text>
          <Text style={{ color: theme.colors.textMuted }}>›</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => nav.navigate('Groups')}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.section}>{t('my_groups_menu')}</Text>
          <Text style={{ color: theme.colors.textMuted }}>›</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => nav.navigate('Sos')}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={[styles.section, { color: theme.colors.danger }]}>{t('sos_menu')}</Text>
          <Text style={{ color: theme.colors.textMuted }}>›</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => nav.navigate('MyItems')}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.section}>{t('my_posts')}</Text>
          <Text style={{ color: theme.colors.textMuted }}>›</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => nav.navigate('CreateService')}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.section}>{t('offer_a_service')}</Text>
          <Text style={{ color: theme.colors.textMuted }}>›</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => nav.navigate('Favorites')}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.section}>{t('saved_listings')}</Text>
          <Text style={{ color: theme.colors.textMuted }}>›</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.section}>Profile</Text>
          <TouchableOpacity onPress={() => setEditing((e) => !e)}>
            <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>{editing ? 'Cancel' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>
        {editing ? (
          <>
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={theme.colors.textMuted} />
            <Text style={styles.label}>Bio</Text>
            <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} multiline value={bio} onChangeText={setBio} placeholder="A line about you" placeholderTextColor={theme.colors.textMuted} />
            <TouchableOpacity style={styles.btn} onPress={save}>
              <Text style={styles.btnText}>Save</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={{ color: theme.colors.text, marginTop: 6 }}>{bio || 'Add a bio so your neighbors know what you do.'}</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>🌐  {t('language')}</Text>
        <View style={{ flexDirection: 'row', marginTop: 10, gap: 8 }}>
          <TouchableOpacity
            style={[styles.langBtn, locale === 'en' && styles.langBtnOn]}
            onPress={() => setLocale('en')}
          >
            <Text style={[styles.langText, locale === 'en' && { color: '#fff' }]}>{t('language_english')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langBtn, locale === 'hi' && styles.langBtnOn]}
            onPress={() => setLocale('hi')}
          >
            <Text style={[styles.langText, locale === 'hi' && { color: '#fff' }]}>{t('language_hindi')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!user?.kycVerified && (
        <TouchableOpacity style={styles.card} onPress={() => nav.navigate('Kyc')}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.section}>{t('verify_identity')}</Text>
            <Text style={{ color: theme.colors.textMuted }}>›</Text>
          </View>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.card} onPress={() => nav.navigate('Wanted')}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.section}>{t('wanted_requests')}</Text>
          <Text style={{ color: theme.colors.textMuted }}>›</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => nav.navigate('Following')}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.section}>{t('following_menu')}</Text>
          <Text style={{ color: theme.colors.textMuted }}>›</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => nav.navigate('Invite')}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.section}>🎁  Invite neighbors</Text>
          <Text style={{ color: theme.colors.textMuted }}>›</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => nav.navigate('SavedSearches')}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.section}>🔔  Saved searches & alerts</Text>
          <Text style={{ color: theme.colors.textMuted }}>›</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => nav.navigate('OffersInbox')}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.section}>💸  Offers inbox</Text>
          <Text style={{ color: theme.colors.textMuted }}>›</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => nav.navigate('NotificationPrefs')}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.section}>⚙️  Notification preferences</Text>
          <Text style={{ color: theme.colors.textMuted }}>›</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => nav.navigate('Blocks')}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.section}>🚫  Blocked users</Text>
          <Text style={{ color: theme.colors.textMuted }}>›</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => nav.navigate('Admin')}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.section}>🛡️  Moderation (admin)</Text>
          <Text style={{ color: theme.colors.textMuted }}>›</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.card} onPress={() => nav.navigate('Analytics')}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.section}>📊  Analytics (admin)</Text>
          <Text style={{ color: theme.colors.textMuted }}>›</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.btn, { backgroundColor: theme.colors.danger, marginTop: 24 }]} onPress={doLogout}>
        <Text style={styles.btnText}>Log out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: theme.colors.surface },
  avatarPh: { justifyContent: 'center', alignItems: 'center' },
  camBadge: { position: 'absolute', right: 0, bottom: 0, backgroundColor: theme.colors.primary, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: theme.colors.bg },
  name: { fontSize: 20, fontWeight: '800', color: theme.colors.text, marginTop: 10 },
  phone: { color: theme.colors.textMuted, marginTop: 2 },
  verified: { color: theme.colors.success, marginTop: 4, fontWeight: '700' },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    padding: 14, marginBottom: 12,
  },
  section: { fontWeight: '700', color: theme.colors.text },
  langBtn: { flex: 1, paddingVertical: 10, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', backgroundColor: theme.colors.bg },
  langBtnOn: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  langText: { fontWeight: '700', color: theme.colors.text },
  value: { color: theme.colors.text, marginTop: 6 },
  label: { fontWeight: '600', marginTop: 10, color: theme.colors.text },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    padding: 10, marginTop: 6, backgroundColor: '#fff', color: theme.colors.text,
  },
  btn: { backgroundColor: theme.colors.primary, padding: 14, borderRadius: theme.radius.md, alignItems: 'center', marginTop: 12 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
