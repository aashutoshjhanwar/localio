import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Api } from '../api/client';
import { theme } from '../theme';
import { useT } from '../i18n';

export function GroupsScreen() {
  const nav = useNavigation<any>();
  const t = useT();
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await Api.myGroups();
      setGroups(r.groups);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.joinBtn}
        onPress={() => nav.navigate('JoinSociety')}
        activeOpacity={0.8}
      >
        <Text style={styles.joinBtnText}>{t('group_join_society')}</Text>
      </TouchableOpacity>

      {groups.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>{t('groups_empty_title')}</Text>
          <Text style={styles.emptyBody}>{t('groups_empty_body')}</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => nav.navigate('GroupDetail', { id: item.id, title: item.name })}>
              <View style={styles.avatar}><Text style={styles.avatarTxt}>🏘️</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {item._count?.members ?? 0} · {item.role === 'owner' ? t('role_owner') : item.role === 'admin' ? t('role_admin') : t('role_member')}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  joinBtn: {
    margin: theme.spacing(3),
    padding: theme.spacing(3),
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: 1, borderColor: theme.colors.primary,
  },
  joinBtnText: { color: theme.colors.primaryDark, fontWeight: '700', textAlign: 'center' },
  row: {
    flexDirection: 'row', alignItems: 'center',
    padding: theme.spacing(3), marginHorizontal: theme.spacing(3), marginBottom: theme.spacing(2),
    backgroundColor: theme.colors.card, borderRadius: theme.radius.md,
    ...theme.shadow.sm,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.surface,
    alignItems: 'center', justifyContent: 'center', marginRight: theme.spacing(3),
  },
  avatarTxt: { fontSize: 22 },
  name: { color: theme.colors.text, fontWeight: '700', fontSize: theme.font.size.md },
  meta: { color: theme.colors.textMuted, fontSize: theme.font.size.sm, marginTop: 2 },
  empty: { alignItems: 'center', padding: theme.spacing(6) },
  emptyTitle: { color: theme.colors.text, fontWeight: '700', fontSize: theme.font.size.lg, marginBottom: theme.spacing(2) },
  emptyBody: { color: theme.colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
