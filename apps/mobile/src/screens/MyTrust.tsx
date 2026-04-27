import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { Api } from '../api/client';
import { TrustBreakdownCard } from '../components/TrustBadge';
import { theme } from '../theme';

export function MyTrustScreen() {
  const [trust, setTrust] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Api.myTrust()
      .then((r) => setTrust(r.trust))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: theme.spacing(4) }}>
      <Text style={styles.title}>Your Trust Score</Text>
      <Text style={styles.subtitle}>
        Calculated live from your activity. Higher scores rank higher in search and get more buyer chats.
      </Text>
      {trust && <TrustBreakdownCard trust={trust} />}
      <View style={styles.why}>
        <Text style={styles.whyTitle}>Why trust beats OLX & WhatsApp</Text>
        <Text style={styles.whyBody}>
          OLX hides how sellers are ranked. WhatsApp has no seller reputation at all. LOCALIO shows
          every component of your score and exactly how to raise it — so every verified seller gets
          a fair shot at the top.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  title: { fontSize: 24, fontWeight: '900', color: theme.colors.text },
  subtitle: { color: theme.colors.textMuted, marginTop: 4, marginBottom: 18, lineHeight: 20 },
  why: { marginTop: 24, padding: 14, backgroundColor: theme.colors.primarySoft, borderRadius: theme.radius.md },
  whyTitle: { fontWeight: '800', color: theme.colors.primaryDark, marginBottom: 4 },
  whyBody: { color: theme.colors.text, lineHeight: 20, fontSize: 13 },
});
