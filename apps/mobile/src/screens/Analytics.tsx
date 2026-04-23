import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Api } from '../api/client';
import { theme } from '../theme';

export function AnalyticsScreen() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Api.adminAnalytics()
      .then(setData)
      .catch((e) => setErr(e.message ?? 'error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  if (err || !data) return <View style={styles.center}><Text style={styles.meta}>⚠️ {err ?? 'No data'}</Text></View>;

  const maxSignup = Math.max(1, ...data.dailySignups.map((d: any) => d.count));

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.h1}>📊 Overview</Text>

      <View style={styles.grid}>
        <Stat label="Users" value={data.totals.users} sub={`+${data.growth7d.users} this week`} />
        <Stat label="Listings" value={data.totals.listings} sub={`+${data.growth7d.listings}`} />
        <Stat label="Services" value={data.totals.services} sub={`+${data.growth7d.services}`} />
        <Stat label="Bookings" value={data.totals.bookings} sub={`+${data.growth7d.bookings}`} />
        <Stat label="Posts" value={data.totals.posts} sub={`+${data.growth7d.posts}`} />
        <Stat label="Polls" value={data.totals.polls} />
        <Stat label="Events" value={data.totals.events} />
        <Stat label="Societies" value={data.totals.societies} />
        <Stat label="Ratings" value={data.totals.ratings} />
      </View>

      <Text style={styles.h2}>Signups · last 14 days</Text>
      <View style={styles.chart}>
        {data.dailySignups.map((d: any) => {
          const h = Math.max(2, (d.count / maxSignup) * 100);
          return (
            <View key={d.date} style={styles.barCol}>
              <View style={{ height: 100, justifyContent: 'flex-end' }}>
                <View style={[styles.bar, { height: h }]} />
              </View>
              <Text style={styles.barLabel}>{d.date.slice(5)}</Text>
              <Text style={styles.barCount}>{d.count}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.h2}>Moderation</Text>
      <View style={styles.grid}>
        <Stat label="Open reports" value={data.moderation.reportsOpen} danger />
        <Stat label="Resolved" value={data.moderation.reportsResolved} />
      </View>

      <Text style={styles.h2}>Bookings by status</Text>
      {data.bookingsByStatus.map((b: any) => (
        <Row key={b.status} label={b.status} value={b.count} />
      ))}
      {data.bookingsByStatus.length === 0 && <Text style={styles.meta}>No bookings yet.</Text>}

      <Text style={styles.h2}>Top listing categories</Text>
      {data.topCategories.map((c: any) => (
        <Row key={c.category} label={c.category} value={c.count} />
      ))}
      {data.topCategories.length === 0 && <Text style={styles.meta}>No data yet.</Text>}
    </ScrollView>
  );
}

function Stat({ label, value, sub, danger }: { label: string; value: number; sub?: string; danger?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, danger && value > 0 && { color: theme.colors.danger }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  meta: { color: theme.colors.textMuted },
  h1: { fontSize: 22, fontWeight: '800', color: theme.colors.text, marginBottom: 12 },
  h2: { fontSize: 15, fontWeight: '800', color: theme.colors.text, marginTop: 22, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { width: '31%', backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 12 },
  statValue: { fontSize: 22, fontWeight: '900', color: theme.colors.primary },
  statLabel: { color: theme.colors.text, fontWeight: '700', fontSize: 12, marginTop: 2 },
  statSub: { color: theme.colors.textMuted, fontSize: 11, marginTop: 2 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 10, gap: 4 },
  barCol: { flex: 1, alignItems: 'center' },
  bar: { width: '70%', backgroundColor: theme.colors.primary, borderRadius: 3 },
  barLabel: { fontSize: 9, color: theme.colors.textMuted, marginTop: 4 },
  barCount: { fontSize: 10, color: theme.colors.text, fontWeight: '700' },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, marginBottom: 6 },
  rowLabel: { color: theme.colors.text, fontWeight: '700', textTransform: 'capitalize' },
  rowValue: { color: theme.colors.primary, fontWeight: '900' },
});
