import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
  Modal, TextInput, Alert, ScrollView,
} from 'react-native';
import { RouteProp, useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Api } from '../api/client';
import { theme } from '../theme';
import { useT } from '../i18n';
import type { RootStackParamList } from '../nav/RootNav';

type R = RouteProp<RootStackParamList, 'GroupDetail'>;

export function GroupDetailScreen() {
  const { params } = useRoute<R>();
  const nav = useNavigation<any>();
  const t = useT();
  const [group, setGroup] = useState<any>(null);
  const [membership, setMembership] = useState<any>(null);
  const [channels, setChannels] = useState<any[]>([]);
  const [anns, setAnns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [annOpen, setAnnOpen] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [g, ch, an] = await Promise.all([
        Api.group(params.id),
        Api.groupChannels(params.id),
        Api.groupAnnouncements(params.id),
      ]);
      setGroup(g.group);
      setMembership(g.membership);
      setChannels(ch.channels);
      setAnns(an.announcements);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const isAdmin = membership?.role === 'admin' || membership?.role === 'owner';

  async function postAnnouncement() {
    if (!annTitle.trim() || !annBody.trim()) return;
    setPosting(true);
    try {
      await Api.createAnnouncement(params.id, { title: annTitle.trim(), body: annBody.trim() });
      setAnnOpen(false);
      setAnnTitle(''); setAnnBody('');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed');
    } finally {
      setPosting(false);
    }
  }

  if (loading || !group) {
    return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: theme.spacing(10) }}>
      <View style={styles.header}>
        <Text style={styles.name}>{group.name}</Text>
        {group.society ? <Text style={styles.subtitle}>{group.society.city} · {group.society.pincode}</Text> : null}
        <Text style={styles.meta}>{group._count?.members ?? 0} members</Text>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.pillBtn} onPress={() => nav.navigate('GroupMembers', { id: params.id })}>
            <Text style={styles.pillBtnTxt}>{t('group_members')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pillBtn, { backgroundColor: theme.colors.dangerSoft }]}
            onPress={() => nav.navigate('Sos', { groupId: params.id })}
          >
            <Text style={[styles.pillBtnTxt, { color: theme.colors.danger }]}>{t('group_send_sos')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {anns.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('group_announcements_title')}</Text>
          {anns.slice(0, 3).map((a) => (
            <View key={a.id} style={styles.annCard}>
              <Text style={styles.annTitle}>{a.title}</Text>
              <Text style={styles.annBody} numberOfLines={4}>{a.body}</Text>
            </View>
          ))}
        </View>
      )}

      {isAdmin && (
        <TouchableOpacity style={styles.addAnn} onPress={() => setAnnOpen(true)}>
          <Text style={styles.addAnnTxt}>{t('group_new_announcement')}</Text>
        </TouchableOpacity>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('group_channels_title')}</Text>
        <FlatList
          scrollEnabled={false}
          data={channels}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.channel}
              onPress={() => nav.navigate('ChatRoom', {
                conversationId: item.conversationId,
                title: `${item.emoji ?? '#'} ${item.name}`,
              })}
            >
              <Text style={styles.chEmoji}>{item.emoji ?? '#'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.chName}>{item.name}</Text>
                <Text style={styles.chLast} numberOfLines={1}>
                  {item.lastMessage?.body ?? (item.readOnly ? t('group_admins_post_here') : t('group_no_messages'))}
                </Text>
              </View>
              {item.unread > 0 ? (
                <View style={styles.badge}><Text style={styles.badgeTxt}>{item.unread > 99 ? '99+' : item.unread}</Text></View>
              ) : null}
            </TouchableOpacity>
          )}
        />
      </View>

      <Modal visible={annOpen} transparent animationType="slide" onRequestClose={() => setAnnOpen(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{t('group_new_announcement')}</Text>
            <TextInput style={styles.input} placeholder={t('group_announcement_title_ph')} value={annTitle} onChangeText={setAnnTitle} />
            <TextInput
              style={[styles.input, { height: 120, textAlignVertical: 'top' }]}
              placeholder={t('group_announcement_body_ph')} value={annBody} onChangeText={setAnnBody} multiline
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setAnnOpen(false)}><Text>{t('cancel')}</Text></TouchableOpacity>
              <TouchableOpacity style={styles.postBtn} onPress={postAnnouncement} disabled={posting}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>{posting ? t('group_posting') : t('post')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  header: { padding: theme.spacing(4), backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  name: { fontSize: theme.font.size.xl, fontWeight: '800', color: theme.colors.text },
  subtitle: { color: theme.colors.textMuted, marginTop: 4 },
  meta: { color: theme.colors.textMuted, marginTop: 2 },
  headerRow: { flexDirection: 'row', gap: 8, marginTop: theme.spacing(3) },
  pillBtn: { backgroundColor: theme.colors.surface, paddingVertical: 8, paddingHorizontal: 14, borderRadius: theme.radius.pill },
  pillBtnTxt: { color: theme.colors.text, fontWeight: '600' },
  section: { marginTop: theme.spacing(4), paddingHorizontal: theme.spacing(3) },
  sectionTitle: { color: theme.colors.text, fontWeight: '700', fontSize: theme.font.size.md, marginBottom: theme.spacing(2) },
  annCard: { padding: theme.spacing(3), backgroundColor: theme.colors.warningSoft, borderRadius: theme.radius.md, marginBottom: theme.spacing(2) },
  annTitle: { fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  annBody: { color: theme.colors.text, lineHeight: 20 },
  addAnn: { marginHorizontal: theme.spacing(3), marginTop: theme.spacing(2), padding: theme.spacing(2), borderStyle: 'dashed', borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, alignItems: 'center' },
  addAnnTxt: { color: theme.colors.primary, fontWeight: '600' },
  channel: {
    flexDirection: 'row', alignItems: 'center', padding: theme.spacing(3),
    backgroundColor: theme.colors.card, borderRadius: theme.radius.md,
    marginBottom: theme.spacing(2), ...theme.shadow.sm,
  },
  chEmoji: { fontSize: 22, marginRight: theme.spacing(2) },
  chName: { fontWeight: '700', color: theme.colors.text },
  chLast: { color: theme.colors.textMuted, fontSize: theme.font.size.sm, marginTop: 2 },
  badge: { backgroundColor: theme.colors.primary, borderRadius: theme.radius.pill, paddingHorizontal: 8, paddingVertical: 3, minWidth: 22, alignItems: 'center' },
  badgeTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  modalWrap: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  modal: { backgroundColor: theme.colors.card, padding: theme.spacing(4), borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg },
  modalTitle: { fontSize: theme.font.size.lg, fontWeight: '700', marginBottom: theme.spacing(3) },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: theme.spacing(2), marginBottom: theme.spacing(2), backgroundColor: theme.colors.bg },
  postBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: theme.radius.md },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
});
