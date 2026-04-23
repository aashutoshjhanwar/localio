import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Image, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Api } from '../api/client';
import { theme } from '../theme';

type Chatter = { id: string; name: string | null; avatarUrl: string | null };

interface Props {
  visible: boolean;
  onClose: () => void;
  listingId: string;
  onMarked: (buyer: Chatter | null) => void;
}

export function MarkSoldModal({ visible, onClose, listingId, onMarked }: Props) {
  const [chatters, setChatters] = useState<Chatter[] | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) { setChatters(null); setPicked(null); return; }
    Api.listingChatters(listingId).then((r) => setChatters(r.chatters)).catch(() => setChatters([]));
  }, [visible, listingId]);

  const submit = async () => {
    setBusy(true);
    try {
      await Api.markListingSold(listingId, picked ?? undefined);
      const buyer = chatters?.find((c) => c.id === picked) ?? null;
      onMarked(buyer);
      onClose();
    } catch (e: any) { Alert.alert('Error', e.message ?? 'try again'); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Who did you sell it to?</Text>
          <Text style={styles.sub}>We'll ask the buyer to rate you, and prompt you to rate them.</Text>

          {chatters === null ? (
            <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 20 }} />
          ) : (
            <ScrollView style={{ maxHeight: 260, marginTop: 12 }}>
              {chatters.length === 0 && (
                <Text style={styles.empty}>No chat history on this listing yet. You can still mark it sold.</Text>
              )}
              {chatters.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.row, picked === c.id && styles.rowOn]}
                  onPress={() => setPicked(picked === c.id ? null : c.id)}
                >
                  {c.avatarUrl ? <Image source={{ uri: c.avatarUrl }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarPh]}><Text>👤</Text></View>}
                  <Text style={[styles.rowName, picked === c.id && { color: '#fff' }]}>{c.name ?? 'Neighbor'}</Text>
                  {picked === c.id && <Text style={{ color: '#fff' }}>✓</Text>}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.row, picked === '__other' && styles.rowOn]}
                onPress={() => setPicked(picked === '__other' ? null : '__other')}
              >
                <View style={[styles.avatar, styles.avatarPh]}><Text>❓</Text></View>
                <Text style={[styles.rowName, picked === '__other' && { color: '#fff' }]}>Someone else / off-app</Text>
                {picked === '__other' && <Text style={{ color: '#fff' }}>✓</Text>}
              </TouchableOpacity>
            </ScrollView>
          )}

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.btn, styles.ghost]} onPress={onClose} disabled={busy}>
              <Text style={[styles.btnText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.primary]} onPress={submit} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Mark as sold</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.colors.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18, paddingBottom: 32 },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  sub: { color: theme.colors.textMuted, marginTop: 6 },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginVertical: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: theme.radius.md, backgroundColor: theme.colors.surface, marginBottom: 6 },
  rowOn: { backgroundColor: theme.colors.primary },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.border },
  avatarPh: { justifyContent: 'center', alignItems: 'center' },
  rowName: { flex: 1, marginLeft: 12, color: theme.colors.text, fontWeight: '700' },
  footer: { flexDirection: 'row', gap: 8, marginTop: 16 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: theme.radius.md, alignItems: 'center' },
  ghost: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  primary: { backgroundColor: theme.colors.success },
  btnText: { color: '#fff', fontWeight: '800' },
});
