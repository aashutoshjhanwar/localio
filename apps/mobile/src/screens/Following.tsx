import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Api } from '../api/client';
import { theme } from '../theme';
import { TrustBadge } from '../components/TrustBadge';

export function FollowingScreen() {
  const nav = useNavigation<any>();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { following } = await Api.following();
      setRows(following);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;

  return (
    <FlatList
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      data={rows}
      keyExtractor={(u) => u.id}
      contentContainerStyle={{ padding: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}
      ListEmptyComponent={<Text style={styles.empty}>You aren't following anyone yet. Open a neighbor's profile and tap Follow.</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} onPress={() => nav.navigate('UserProfile', { id: item.id })}>
          {item.avatarUrl
            ? <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
            : <View style={[styles.avatar, styles.avatarPh]}><Text>👤</Text></View>}
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.name}>{item.name ?? 'Someone'}</Text>
            <View style={{ marginTop: 4 }}>
              <TrustBadge score={item.trustScore} kycVerified={item.kycVerified} />
            </View>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 60, paddingHorizontal: 20 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: 12, marginBottom: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.border },
  avatarPh: { justifyContent: 'center', alignItems: 'center' },
  name: { color: theme.colors.text, fontWeight: '700' },
});
