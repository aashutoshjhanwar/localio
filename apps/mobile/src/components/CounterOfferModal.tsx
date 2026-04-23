import React, { useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Api } from '../api/client';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  offerId: string | null;
  buyerName: string;
  buyerOfferPaise: number;
  askingPricePaise: number;
  onSent?: () => void;
}

export function CounterOfferModal({ visible, onClose, offerId, buyerName, buyerOfferPaise, askingPricePaise, onSent }: Props) {
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const buyerRupees = Math.round(buyerOfferPaise / 100);
  const askingRupees = Math.round(askingPricePaise / 100);
  const mid = Math.round((buyerRupees + askingRupees) / 2);

  async function send() {
    if (!offerId) return;
    const rupees = parseInt(amount.replace(/[^0-9]/g, ''), 10);
    if (!rupees || rupees <= 0) return Alert.alert('Enter an amount');
    if (rupees * 100 === buyerOfferPaise) return Alert.alert('Same amount', 'Counter should differ from the buyer\'s offer.');
    setSending(true);
    try {
      await Api.counterOffer(offerId, rupees * 100, message.trim() || undefined);
      setAmount(''); setMessage('');
      onClose();
      onSent?.();
    } catch (e: any) {
      Alert.alert('Could not send counter', e.message ?? 'try again');
    } finally { setSending(false); }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Counter offer</Text>
          <Text style={styles.sub}>{buyerName} offered ₹{buyerRupees.toLocaleString('en-IN')} · Asking ₹{askingRupees.toLocaleString('en-IN')}</Text>

          <View style={styles.quickRow}>
            {[mid, Math.round(askingRupees * 0.95), askingRupees].map((v) => (
              <TouchableOpacity key={v} style={styles.quick} onPress={() => setAmount(String(v))}>
                <Text style={styles.quickText}>₹{v.toLocaleString('en-IN')}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Your counter (₹)</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            keyboardType="number-pad"
            placeholder="e.g. 1500"
            placeholderTextColor={theme.colors.textMuted}
          />
          <Text style={styles.label}>Message (optional)</Text>
          <TextInput
            style={[styles.input, { minHeight: 64, textAlignVertical: 'top' }]}
            value={message}
            onChangeText={setMessage}
            multiline
            placeholder="Firm price, includes delivery…"
            placeholderTextColor={theme.colors.textMuted}
          />

          <View style={styles.footer}>
            <TouchableOpacity style={[styles.btn, styles.ghost]} onPress={onClose} disabled={sending}>
              <Text style={[styles.btnText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.primary]} onPress={send} disabled={sending}>
              {sending ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Send counter</Text>}
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
