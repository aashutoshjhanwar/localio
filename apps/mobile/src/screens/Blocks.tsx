import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Api } from '../api/client';
import { theme } from '../theme';

export function BlocksScreen() {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Api.blocks().then((r) => setBlocks(r.blocks)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const unblock = async (userId: string) => {
    try {
      await Api.unblock(userId);
      setBlocks((b) => b.filter((x) => x.blockedId !== userId));
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Try again');
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      contentContainerStyle={{ padding: 16 }}
      data={blocks}
      keyExtractor={(b) => b.id}
      ListEmptyComponent={<Text style={styles.empty}>You haven't blocked anyone.</Text>}
      renderItem={({ item }) => (
        <View style={styles.row}>
          {item.blocked?.avatarUrl ? (
            <Image source={{ uri: item.blocked.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPh]}><Text>👤</Text></View>
          )}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.name}>{item.blocked?.name ?? 'Someone'}</Text>
            <Text style={styles.meta}>{item.blocked?.phone ?? ''}</Text>
          </View>
          <TouchableOpacity style={styles.btn} onPress={() => unblock(item.blockedId)}>
            <Text style={styles.btnText}>Unblock</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 40 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 10, marginBottom: 8 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.border },
  avatarPh: { justifyContent: 'center', alignItems: 'center' },
  name: { fontWeight: '700', color: theme.colors.text },
  meta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  btn: { backgroundColor: theme.colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.md },
  btnText: { color: '#fff', fontWeight: '700' },
});
