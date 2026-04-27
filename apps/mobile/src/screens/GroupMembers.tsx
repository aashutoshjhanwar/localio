import React, { useCallback, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { RouteProp, useRoute, useFocusEffect } from '@react-navigation/native';
import { Api } from '../api/client';
import { theme } from '../theme';
import { useAuth } from '../state/auth';
import { useT } from '../i18n';
import type { RootStackParamList } from '../nav/RootNav';

type R = RouteProp<RootStackParamList, 'GroupMembers'>;

export function GroupMembersScreen() {
  const { params } = useRoute<R>();
  const me = useAuth((s) => s.user);
  const t = useT();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<string>('member');
  const [actionFor, setActionFor] = useState<any | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, r] = await Promise.all([Api.group(params.id), Api.groupMembers(params.id)]);
      setMembers(r.members);
      setMyRole(g.membership?.role ?? 'member');
    } finally { setLoading(false); }
  }, [params.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const isAdmin = myRole === 'admin' || myRole === 'owner';

  async function promote(userId: string, role: 'member' | 'admin') {
    try { await Api.setMemberRole(params.id, userId, role); await load(); setActionFor(null); }
    catch (e: any) { Alert.alert('Error', e.message); }
  }
  async function kick(userId: string) {
    Alert.alert(t('group_remove_confirm_title'), t('group_remove_confirm_body'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('remove'), style: 'destructive', onPress: async () => {
        try { await Api.kickMember(params.id, userId); await load(); setActionFor(null); }
        catch (e: any) { Alert.alert('Error', e.message); }
      } },
    ]);
  }
  async function mute(userId: string, hours: number) {
    try { await Api.muteMember(params.id, userId, hours); await load(); setActionFor(null); }
    catch (e: any) { Alert.alert('Error', e.message); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={members}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => {
          const isMuted = item.mutedUntil && new Date(item.mutedUntil).getTime() > Date.now();
          return (
            <TouchableOpacity
              style={styles.row}
              disabled={!isAdmin || item.userId === me?.id || item.role === 'owner'}
              onPress={() => setActionFor(item)}
            >
              <View style={styles.avatar}><Text style={styles.avatarTxt}>{item.user.name?.[0] ?? '?'}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.user.name ?? 'Neighbor'}{item.userId === me?.id ? ' ' + t('you_suffix') : ''}</Text>
                <Text style={styles.meta}>
                  {item.role === 'owner' ? t('role_owner') : item.role === 'admin' ? t('role_admin') : t('role_member')}
                  {item.user.kycVerified ? ' · ✅ Verified' : ''}
                  {isMuted ? ' · 🔇 Muted' : ''}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <Modal visible={!!actionFor} transparent animationType="fade" onRequestClose={() => setActionFor(null)}>
        <TouchableOpacity style={styles.modalWrap} activeOpacity={1} onPress={() => setActionFor(null)}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>{actionFor?.user?.name}</Text>
            {actionFor?.role === 'member' ? (
              <TouchableOpacity style={styles.action} onPress={() => promote(actionFor.userId, 'admin')}>
                <Text style={styles.actionTxt}>{t('group_make_admin')}</Text>
              </TouchableOpacity>
            ) : null}
            {actionFor?.role === 'admin' ? (
              <TouchableOpacity style={styles.action} onPress={() => promote(actionFor.userId, 'member')}>
                <Text style={styles.actionTxt}>{t('group_demote')}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.action} onPress={() => mute(actionFor.userId, 24)}>
              <Text style={styles.actionTxt}>{t('group_mute_24')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => mute(actionFor.userId, 0)}>
              <Text style={styles.actionTxt}>{t('group_unmute')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => kick(actionFor.userId)}>
              <Text style={[styles.actionTxt, { color: theme.colors.danger }]}>{t('group_remove_member')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', padding: theme.spacing(3), borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.card },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', marginRight: theme.spacing(3) },
  avatarTxt: { fontWeight: '700', color: theme.colors.text },
  name: { fontWeight: '700', color: theme.colors.text },
  meta: { color: theme.colors.textMuted, fontSize: theme.font.size.sm, marginTop: 2 },
  modalWrap: { flex: 1, backgroundColor: theme.colors.overlay, justifyContent: 'flex-end' },
  modal: { backgroundColor: theme.colors.card, padding: theme.spacing(4), borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg },
  modalTitle: { fontWeight: '700', fontSize: theme.font.size.lg, marginBottom: theme.spacing(3) },
  action: { paddingVertical: theme.spacing(3), borderTopWidth: 1, borderTopColor: theme.colors.border },
  actionTxt: { fontSize: theme.font.size.base, color: theme.colors.text },
});
