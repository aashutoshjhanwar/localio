import React, { useCallback, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Switch,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Api } from '../api/client';
import { theme } from '../theme';

interface Reply {
  id: string;
  listingId: string | null;
  kind: 'greeting' | 'faq';
  triggerText: string | null;
  response: string;
  enabled: boolean;
}

const DEFAULT_GREETING = 'Hi! Thanks for your interest. I\'ll respond personally as soon as I\'m free.';

export function AutoReplySettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState<Reply | null>(null);
  const [greetingText, setGreetingText] = useState('');
  const [greetingOn, setGreetingOn] = useState(true);
  const [faqs, setFaqs] = useState<Reply[]>([]);
  const [newTrigger, setNewTrigger] = useState('');
  const [newResponse, setNewResponse] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await Api.autoReplies();
      const g = r.replies.find((x: Reply) => x.kind === 'greeting' && x.listingId === null) ?? null;
      setGreeting(g);
      setGreetingText(g?.response ?? DEFAULT_GREETING);
      setGreetingOn(g?.enabled ?? true);
      setFaqs(r.replies.filter((x: Reply) => x.kind === 'faq'));
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function saveGreeting() {
    if (greetingText.trim().length < 2) return;
    setSaving(true);
    try {
      await Api.upsertAutoReply({
        id: greeting?.id, kind: 'greeting', listingId: null,
        response: greetingText.trim(), enabled: greetingOn,
      });
      await load();
      Alert.alert('Saved', 'Buyers will see this when they first message you.');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to save');
    } finally { setSaving(false); }
  }

  async function addFaq() {
    if (newTrigger.trim().length < 2 || newResponse.trim().length < 2) return;
    setSaving(true);
    try {
      await Api.upsertAutoReply({
        kind: 'faq', listingId: null,
        triggerText: newTrigger.trim(), response: newResponse.trim(),
        enabled: true,
      });
      setNewTrigger(''); setNewResponse('');
      await load();
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed');
    } finally { setSaving(false); }
  }

  async function toggleFaq(f: Reply) {
    await Api.upsertAutoReply({
      id: f.id, kind: 'faq', listingId: f.listingId,
      triggerText: f.triggerText, response: f.response, enabled: !f.enabled,
    });
    await load();
  }

  async function deleteFaq(id: string) {
    Alert.alert('Delete FAQ?', 'This auto-reply will no longer fire.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await Api.deleteAutoReply(id); await load();
      } },
    ]);
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: theme.spacing(4) }}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>🤖 Never ghost a buyer</Text>
        <Text style={styles.bannerBody}>
          When someone messages your listing, LOCALIO sends an instant reply for you with the price + a few quick-reply
          options. If you stay silent for 24 hours, we hint similar listings to keep the buyer warm.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Greeting</Text>
      <Text style={styles.help}>Sent automatically the first time a buyer messages any of your listings.</Text>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Auto-greeting enabled</Text>
        <Switch value={greetingOn} onValueChange={setGreetingOn} />
      </View>
      <TextInput
        style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]}
        value={greetingText}
        onChangeText={setGreetingText}
        multiline
        maxLength={400}
        placeholder={DEFAULT_GREETING}
        placeholderTextColor={theme.colors.textMuted}
      />
      <TouchableOpacity style={styles.saveBtn} onPress={saveGreeting} disabled={saving}>
        <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save greeting'}</Text>
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { marginTop: 28 }]}>Smart FAQs</Text>
      <Text style={styles.help}>
        We auto-respond if the buyer's message contains your trigger words. Example: trigger "negotiable" →
        response "Yes, the price is negotiable up to ₹500."
      </Text>

      {faqs.length === 0 ? (
        <Text style={styles.empty}>No FAQs yet. Add one below.</Text>
      ) : faqs.map((f) => (
        <View key={f.id} style={[styles.faqCard, !f.enabled && { opacity: 0.55 }]}>
          <View style={styles.faqHead}>
            <Text style={styles.faqTrigger} numberOfLines={1}>🎯 if they say "{f.triggerText}"</Text>
            <Switch value={f.enabled} onValueChange={() => toggleFaq(f)} />
          </View>
          <Text style={styles.faqResponse}>↳ {f.response}</Text>
          <TouchableOpacity onPress={() => deleteFaq(f.id)}>
            <Text style={styles.faqDelete}>Delete</Text>
          </TouchableOpacity>
        </View>
      ))}

      <Text style={[styles.help, { marginTop: 16 }]}>Add a new FAQ</Text>
      <TextInput
        style={styles.input}
        value={newTrigger}
        onChangeText={setNewTrigger}
        placeholder="Trigger word (e.g. price, condition, available)"
        placeholderTextColor={theme.colors.textMuted}
        maxLength={120}
      />
      <TextInput
        style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]}
        value={newResponse}
        onChangeText={setNewResponse}
        placeholder="Your auto-reply"
        placeholderTextColor={theme.colors.textMuted}
        multiline
        maxLength={1000}
      />
      <TouchableOpacity style={styles.saveBtn} onPress={addFaq} disabled={saving || !newTrigger.trim() || !newResponse.trim()}>
        <Text style={styles.saveBtnText}>+ Add FAQ</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.bg },
  banner: { backgroundColor: theme.colors.primarySoft, padding: theme.spacing(3), borderRadius: theme.radius.md, marginBottom: theme.spacing(4) },
  bannerTitle: { fontWeight: '800', color: theme.colors.primaryDark, fontSize: theme.font.size.md },
  bannerBody: { color: theme.colors.text, marginTop: 4, lineHeight: 20 },
  sectionTitle: { fontWeight: '800', color: theme.colors.text, fontSize: theme.font.size.lg, marginBottom: 4 },
  help: { color: theme.colors.textMuted, marginBottom: 12, lineHeight: 18 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingVertical: 6 },
  toggleLabel: { color: theme.colors.text, fontWeight: '600' },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: theme.spacing(2), backgroundColor: theme.colors.card, marginBottom: 12, color: theme.colors.text },
  saveBtn: { backgroundColor: theme.colors.primary, padding: theme.spacing(3), borderRadius: theme.radius.md, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: theme.font.size.base },
  empty: { color: theme.colors.textMuted, fontStyle: 'italic', marginBottom: 12 },
  faqCard: { backgroundColor: theme.colors.card, borderRadius: theme.radius.md, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border },
  faqHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faqTrigger: { fontWeight: '700', color: theme.colors.text, flex: 1, marginRight: 8 },
  faqResponse: { color: theme.colors.text, marginTop: 4, lineHeight: 20 },
  faqDelete: { color: theme.colors.danger, fontWeight: '700', marginTop: 8, fontSize: 13 },
});
