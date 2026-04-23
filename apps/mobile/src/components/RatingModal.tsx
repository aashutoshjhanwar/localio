import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, TextInput, StyleSheet, KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { Api } from '../api/client';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSubmitted: () => void;
  toUserId: string;
  toUserName?: string;
  context: 'listing' | 'service';
  contextId: string;
}

export function RatingModal({ visible, onClose, onSubmitted, toUserId, toUserName, context, contextId }: Props) {
  const [stars, setStars] = useState(5);
  const [review, setReview] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await Api.rate({ toId: toUserId, context, contextId, stars, review: review.trim() || undefined });
      onSubmitted();
      onClose();
      setReview('');
      setStars(5);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Try again');
    } finally { setBusy(false); }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <Text style={styles.title}>Rate {toUserName ?? 'the other user'}</Text>
          <Text style={styles.sub}>How did the deal go?</Text>

          <View style={styles.starRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity key={n} onPress={() => setStars(n)}>
                <Text style={[styles.star, n <= stars && styles.starActive]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput
            style={styles.input}
            value={review}
            onChangeText={setReview}
            placeholder="Leave a note (optional)"
            placeholderTextColor={theme.colors.textMuted}
            multiline
            maxLength={1000}
          />

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.btn, styles.ghost]} onPress={onClose} disabled={busy}>
              <Text style={[styles.btnText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.primary]} onPress={submit} disabled={busy}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Submit rating</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: theme.colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 28,
  },
  title: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  sub: { color: theme.colors.textMuted, marginTop: 4 },
  starRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 16 },
  star: { fontSize: 44, color: theme.colors.border },
  starActive: { color: '#F5A623' },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    padding: 12, minHeight: 80, textAlignVertical: 'top',
    color: theme.colors.text, fontSize: 15, backgroundColor: theme.colors.card,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: { flex: 1, borderRadius: theme.radius.md, paddingVertical: 14, alignItems: 'center' },
  ghost: { backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  primary: { backgroundColor: theme.colors.primary },
  btnText: { color: '#fff', fontWeight: '800' },
});
