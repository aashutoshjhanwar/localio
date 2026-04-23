import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Api } from '../api/client';
import { theme } from '../theme';

const REASONS = [
  { key: 'spam', label: 'Spam / repetitive' },
  { key: 'scam', label: 'Scam or fraud' },
  { key: 'offensive', label: 'Offensive content' },
  { key: 'unsafe', label: 'Unsafe / dangerous' },
  { key: 'duplicate', label: 'Duplicate listing' },
  { key: 'other', label: 'Other' },
] as const;

type Reason = typeof REASONS[number]['key'];

export function ReportModal({
  visible, onClose, targetType, targetId,
}: {
  visible: boolean;
  onClose: () => void;
  targetType: 'listing' | 'service' | 'user' | 'message' | 'post';
  targetId: string;
}) {
  const [reason, setReason] = useState<Reason | null>(null);
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);

  async function submit() {
    if (!reason) return Alert.alert('Select a reason');
    try {
      setSending(true);
      await Api.report({ targetType, targetId, reason, notes: notes || undefined });
      Alert.alert('Reported', 'Thanks — our team will review.');
      setReason(null); setNotes('');
      onClose();
    } catch (e: any) {
      Alert.alert('Could not submit', e.message ?? 'try again');
    } finally { setSending(false); }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Report</Text>
          <Text style={styles.sub}>Why are you reporting this?</Text>
          {REASONS.map((r) => (
            <TouchableOpacity
              key={r.key}
              style={[styles.row, reason === r.key && styles.rowActive]}
              onPress={() => setReason(r.key)}
            >
              <Text style={[styles.rowText, reason === r.key && { color: '#fff' }]}>{r.label}</Text>
            </TouchableOpacity>
          ))}
          <TextInput
            style={styles.input}
            value={notes}
            onChangeText={setNotes}
            placeholder="Additional details (optional)"
            placeholderTextColor={theme.colors.textMuted}
            multiline
          />
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onClose}>
              <Text style={[styles.btnText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, { flex: 1, backgroundColor: theme.colors.danger }]} onPress={submit} disabled={sending}>
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit report</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.bg, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl,
    padding: 20, paddingBottom: 32,
  },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.text },
  sub: { color: theme.colors.textMuted, marginTop: 4, marginBottom: 12 },
  row: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8, backgroundColor: theme.colors.surface,
  },
  rowActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  rowText: { color: theme.colors.text, fontWeight: '600' },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    padding: 12, marginTop: 8, color: theme.colors.text, minHeight: 70, textAlignVertical: 'top',
    backgroundColor: theme.colors.surface,
  },
  btn: { padding: 14, borderRadius: theme.radius.md, alignItems: 'center' },
  btnGhost: { paddingHorizontal: 20, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  btnText: { color: '#fff', fontWeight: '800' },
});
