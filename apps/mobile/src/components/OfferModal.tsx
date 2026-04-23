import React, { useMemo, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Api } from '../api/client';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  listingId: string;
  listingTitle: string;
  askingPriceInPaise: number;
  onSent?: () => void;
}

export function OfferModal({ visible, onClose, listingId, listingTitle, askingPriceInPaise, onSent }: Props) {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const askingRupees = Math.round(askingPriceInPaise / 100);
  const quickAmounts = useMemo(() => [0.9, 0.8, 0.7].map((f) => Math.round(askingRupees * f)), [askingRupees]);

  async function send() {
    const rupees = parseInt(amount.replace(/[^0-9]/g, ''), 10);
    if (!rupees || rupees <= 0) return Alert.alert('Enter an amount', 'Offer must be a positive number.');
    if (rupees * 100 >= askingPriceInPaise) return Alert.alert('Offer too high', 'Offer should be below the asking price.');
    setSending(true);
    try {
      await Api.makeOffer({ listingId, amountInPaise: rupees * 100, message: message.trim() || undefined });
      setAmount(''); setMessage('');
      onClose();
      onSent?.();
      Alert.alert('Offer sent', 'The seller will be notified.');
    } catch (e: any) {
      const msg = e.message?.includes('offer_pending') ? 'You already have a pending offer on this listing.'
        : e.message?.includes('not_negotiable') ? 'This listing is not negotiable.'
        : e.message ?? 'Try again';
      Alert.alert('Could not send offer', msg);
    } finally { setSending(false); }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Make an offer</Text>
          <Text style={styles.sub} numberOfLines={1}>{listingTitle}</Text>
          <Text style={styles.asking}>Asking: ₹{askingRupees.toLocaleString('en-IN')}</Text>

          <View style={styles.quickRow}>
            {quickAmounts.map((v) => (
              <TouchableOpacity key={v} style={styles.quick} onPress={() => setAmount(String(v))}>
                <Text style={styles.quickText}>₹{v.toLocaleString('en-IN')}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Your offer (₹)</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
            placeholder="e.g. 1200"
            placeholderTextColor={theme.colors.textMuted}
          />
          <Text style={styles.label}>Message (optional)</Text>
          <TextInput
            style={[styles.input, { minHeight: 72, textAlignVertical: 'top' }]}
            value={message}
            onChangeText={setMessage}
            multiline
            placeholder="Why this price, when you can pick up…"
            placeholderTextColor={theme.colors.textMuted}
          />

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.btn, styles.ghost]} onPress={onClose} disabled={sending}>
              <Text style={[styles.btnText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.primary]} onPress={send} disabled={sending}>
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send offer</Text>}
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
  sub: { color: theme.colors.textMuted, marginTop: 4 },
  asking: { marginTop: 6, color: theme.colors.text, fontWeight: '700' },
  quickRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  quick: { flex: 1, borderWidth: 1, borderColor: theme.colors.primary, borderRadius: theme.radius.md, paddingVertical: 8, alignItems: 'center' },
  quickText: { color: theme.colors.primary, fontWeight: '700' },
  label: { marginTop: 14, marginBottom: 6, fontWeight: '700', color: theme.colors.text },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    padding: 12, backgroundColor: theme.colors.surface, color: theme.colors.text,
  },
  footer: { flexDirection: 'row', gap: 8, marginTop: 16 },
  btn: { flex: 1, paddingVertical: 14, borderRadius: theme.radius.md, alignItems: 'center' },
  ghost: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  primary: { backgroundColor: theme.colors.primary },
  btnText: { color: '#fff', fontWeight: '800' },
});
