import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Api } from '../api/client';
import { useAuth } from '../state/auth';
import { useLocation } from '../hooks/useLocation';
import { theme } from '../theme';

export function JoinSocietyScreen() {
  const nav = useNavigation<any>();
  const { coords } = useLocation();
  const { setUser, user } = useAuth();
  const [societies, setSocieties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    Api.nearbySocieties(coords.lat, coords.lng, 10)
      .then((r) => setSocieties(r.societies))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [coords.lat, coords.lng]);

  async function join(id: string) {
    try {
      setJoining(id);
      await Api.joinSociety(id);
      const me = await Api.me();
      await setUser({
        id: me.user.id, phone: me.user.phone, name: me.user.name,
        avatarUrl: me.user.avatarUrl, societyId: me.user.societyId, kycVerified: me.user.kycVerified,
      });
      nav.goBack();
    } catch (e: any) {
      Alert.alert('Could not join', e.message ?? 'try again');
    } finally { setJoining(null); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <Text style={styles.blurb}>Join a nearby society so neighbours can find your posts faster.</Text>
      <FlatList
        data={societies}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: 12 }}
        ListEmptyComponent={<Text style={styles.empty}>No societies within 10 km. Ask your admin to register one.</Text>}
        renderItem={({ item }) => {
          const mine = user?.societyId === item.id;
          return (
            <View style={[styles.card, mine && { borderColor: theme.colors.primary, borderWidth: 1 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{item.city} · {item.pincode} · {item.memberCount} members</Text>
                {item.verified && <Text style={styles.verified}>✓ Verified</Text>}
              </View>
              <TouchableOpacity
                style={[styles.btn, mine && styles.btnMine]}
                onPress={() => !mine && join(item.id)}
                disabled={!!joining || mine}
              >
                {joining === item.id ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.btnText}>{mine ? 'Joined' : 'Join'}</Text>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  blurb: { color: theme.colors.textMuted, padding: 16, paddingBottom: 0 },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 60 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg, padding: 14, marginBottom: 10,
  },
  name: { fontSize: 16, fontWeight: '800', color: theme.colors.text },
  meta: { color: theme.colors.textMuted, marginTop: 4, fontSize: 13 },
  verified: { color: theme.colors.success, marginTop: 4, fontWeight: '700', fontSize: 12 },
  btn: { backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: theme.radius.md },
  btnMine: { backgroundColor: theme.colors.textMuted },
  btnText: { color: '#fff', fontWeight: '800' },
});
