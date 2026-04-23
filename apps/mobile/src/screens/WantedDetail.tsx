import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Api } from '../api/client';
import { useAuth } from '../state/auth';
import { theme } from '../theme';
import { TrustBadge } from '../components/TrustBadge';
import type { RootStackParamList } from '../nav/RootNav';

type R = RouteProp<RootStackParamList, 'WantedDetail'>;
type N = NativeStackNavigationProp<RootStackParamList>;

export function WantedDetailScreen() {
  const { params } = useRoute<R>();
  const nav = useNavigation<N>();
  const me = useAuth((s) => s.user);
  const [w, setW] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { Api.wanted(params.id).then((r) => setW(r.wanted)).catch(() => {}); }, [params.id]);

  if (!w) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;

  const mine = me?.id === w.buyerId;

  const respond = async () => {
    setBusy(true);
    try {
      const { conversation } = await Api.respondWanted(w.id);
      nav.navigate('ChatRoom', { conversationId: conversation.id, title: w.buyer?.name ?? 'Buyer' });
    } catch (e: any) { Alert.alert('Error', e.message ?? 'try again'); }
    finally { setBusy(false); }
  };

  const close = async () => {
    Alert.alert('Close request?', 'Neighbors will no longer see this.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close', style: 'destructive', onPress: async () => {
        try { const r = await Api.closeWanted(w.id); setW(r.wanted); } catch (e: any) { Alert.alert('Error', e.message ?? 'try again'); }
      }},
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>{w.title}</Text>
      <Text style={styles.meta}>{w.category}{w.status === 'closed' ? ' · CLOSED' : ''}</Text>
      <Text style={styles.budget}>
        {w.maxBudgetPaise ? `Budget up to ₹${(w.maxBudgetPaise / 100).toLocaleString('en-IN')}` : 'Open budget'}
      </Text>
      <View style={styles.divider} />
      <Text style={styles.section}>Details</Text>
      <Text style={styles.body}>{w.description}</Text>
      <View style={styles.divider} />
      <Text style={styles.section}>Requested by</Text>
      <TouchableOpacity style={styles.buyerRow} onPress={() => nav.navigate('UserProfile', { id: w.buyerId })}>
        <View style={styles.avatar}><Text style={{ fontSize: 22 }}>👤</Text></View>
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={styles.buyerName}>{w.buyer?.name ?? 'Neighbor'}</Text>
          <View style={{ marginTop: 4 }}>
            <TrustBadge score={w.buyer?.trustScore} kycVerified={w.buyer?.kycVerified} />
          </View>
        </View>
        <Text style={{ color: theme.colors.textMuted }}>›</Text>
      </TouchableOpacity>

      {mine && w.status === 'open' && (
        <TouchableOpacity style={[styles.btn, styles.ghost]} onPress={close}>
          <Text style={[styles.btnText, { color: theme.colors.danger }]}>Close request</Text>
        </TouchableOpacity>
      )}
      {!mine && w.status === 'open' && (
        <TouchableOpacity style={styles.btn} onPress={respond} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>💬 I can help</Text>}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.text },
  meta: { color: theme.colors.textMuted, marginTop: 4, textTransform: 'capitalize' },
  budget: { fontSize: 18, fontWeight: '800', color: theme.colors.primary, marginTop: 8 },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 16 },
  section: { fontWeight: '700', color: theme.colors.text, marginBottom: 6 },
  body: { color: theme.colors.text, lineHeight: 22 },
  buyerRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.surface, justifyContent: 'center', alignItems: 'center' },
  buyerName: { fontWeight: '700', color: theme.colors.text },
  btn: { backgroundColor: theme.colors.primary, padding: 16, borderRadius: theme.radius.md, alignItems: 'center', marginTop: 16 },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.danger },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
