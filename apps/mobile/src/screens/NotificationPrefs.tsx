import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, ActivityIndicator, ScrollView } from 'react-native';
import { Api } from '../api/client';
import { theme } from '../theme';

const PREF_META: Array<{ key: string; icon: string; label: string; hint: string }> = [
  { key: 'chat', icon: '💬', label: 'Chat messages', hint: 'New messages in your conversations.' },
  { key: 'offer', icon: '💰', label: 'Offers & counters', hint: 'Offers on your listings and counters on yours.' },
  { key: 'wanted_match', icon: '🎯', label: 'Wanted matches', hint: 'New listings matching your Wanted posts.' },
  { key: 'wanted_lead', icon: '📣', label: 'Wanted leads', hint: 'Buyers posting Wanted requests that match your listings.' },
  { key: 'price_drop', icon: '📉', label: 'Price drops', hint: 'When a saved listing gets cheaper.' },
  { key: 'saved_search_hit', icon: '🔔', label: 'Saved searches', hint: 'New results for searches you saved.' },
  { key: 'follow', icon: '👥', label: 'Follows & new posts', hint: 'When someone follows you or your followees post.' },
  { key: 'system', icon: '⚙️', label: 'System updates', hint: 'KYC, reports, and account alerts.' },
];

export function NotificationPrefsScreen() {
  const [prefs, setPrefs] = useState<Record<string, boolean> | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    Api.notificationPrefs().then((r) => setPrefs(r.prefs)).catch(() => setPrefs({}));
  }, []);

  async function toggle(key: string, value: boolean) {
    setPrefs((p) => ({ ...(p ?? {}), [key]: value }));
    setSaving(key);
    try {
      const r = await Api.updateNotificationPrefs({ [key]: value });
      setPrefs(r.prefs);
    } catch {
      setPrefs((p) => ({ ...(p ?? {}), [key]: !value }));
    } finally { setSaving(null); }
  }

  if (!prefs) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;

  return (
    <ScrollView style={{ backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.intro}>Choose which push notifications you want to receive. In-app inbox always shows everything.</Text>
      {PREF_META.map((p) => {
        const enabled = prefs[p.key] !== false;
        return (
          <View key={p.key} style={styles.row}>
            <Text style={styles.icon}>{p.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{p.label}</Text>
              <Text style={styles.hint}>{p.hint}</Text>
            </View>
            <Switch
              value={enabled}
              disabled={saving === p.key}
              onValueChange={(v) => toggle(p.key, v)}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor="#fff"
            />
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  intro: { color: theme.colors.textMuted, fontSize: 13, marginBottom: 16, lineHeight: 18 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: theme.colors.border,
    shadowColor: '#1C1A17', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  icon: { fontSize: 24, marginRight: 14 },
  label: { fontSize: 15, fontWeight: '800', color: theme.colors.text },
  hint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2, lineHeight: 16 },
});
