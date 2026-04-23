import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { theme } from '../theme';

export type OfferStatus = 'pending' | 'accepted' | 'declined' | 'countered' | 'withdrawn';

interface Props {
  amountInPaise: number;
  status?: OfferStatus;
  mine: boolean;
  counterAmountPaise?: number | null;
  counterMessage?: string | null;
  onAccept?: () => Promise<void>;
  onDecline?: () => Promise<void>;
  onCounter?: () => void;
  onAcceptCounter?: () => Promise<void>;
  onWithdraw?: () => Promise<void>;
}

export function OfferCard({
  amountInPaise, status = 'pending', mine,
  counterAmountPaise, counterMessage,
  onAccept, onDecline, onCounter, onAcceptCounter, onWithdraw,
}: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const amount = `₹${(amountInPaise / 100).toLocaleString('en-IN')}`;
  const counterAmt = counterAmountPaise != null
    ? `₹${(counterAmountPaise / 100).toLocaleString('en-IN')}` : null;

  const badgeColor =
    status === 'accepted' ? theme.colors.success
    : status === 'declined' || status === 'withdrawn' ? theme.colors.danger
    : status === 'countered' ? '#c98300'
    : theme.colors.textMuted;

  async function run(key: string, fn?: () => Promise<void>) {
    if (!fn) return;
    setBusy(key);
    try { await fn(); } finally { setBusy(null); }
  }

  return (
    <View style={[styles.card, mine && { borderColor: theme.colors.primary }]}>
      <Text style={styles.label}>OFFER</Text>
      <Text style={styles.amount}>{amount}</Text>
      <Text style={[styles.status, { color: badgeColor }]}>{status.toUpperCase()}</Text>

      {status === 'countered' && counterAmt && (
        <View style={styles.counterBox}>
          <Text style={styles.counterLabel}>SELLER COUNTER</Text>
          <Text style={styles.counterAmt}>{counterAmt}</Text>
          {counterMessage ? <Text style={styles.counterMsg}>{counterMessage}</Text> : null}
        </View>
      )}

      {status === 'pending' && !mine && (
        <View style={styles.row}>
          <TouchableOpacity style={[styles.btn, styles.accept]} onPress={() => run('accept', onAccept)} disabled={!!busy}>
            {busy === 'accept' ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Accept</Text>}
          </TouchableOpacity>
          {onCounter && (
            <TouchableOpacity style={[styles.btn, styles.counter]} onPress={onCounter} disabled={!!busy}>
              <Text style={styles.btnText}>Counter</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.btn, styles.decline]} onPress={() => run('decline', onDecline)} disabled={!!busy}>
            {busy === 'decline' ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Decline</Text>}
          </TouchableOpacity>
        </View>
      )}

      {status === 'countered' && mine && (
        <View style={styles.row}>
          <TouchableOpacity style={[styles.btn, styles.accept]} onPress={() => run('acceptCounter', onAcceptCounter)} disabled={!!busy}>
            {busy === 'acceptCounter' ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Accept counter</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.decline]} onPress={() => run('withdraw', onWithdraw)} disabled={!!busy}>
            {busy === 'withdraw' ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Walk away</Text>}
          </TouchableOpacity>
        </View>
      )}

      {status === 'pending' && mine && onWithdraw && (
        <TouchableOpacity style={[styles.btn, styles.decline, { marginTop: 10 }]} onPress={() => run('withdraw', onWithdraw)} disabled={!!busy}>
          {busy === 'withdraw' ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Withdraw</Text>}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 220, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.lg, padding: 12, backgroundColor: '#fff',
  },
  label: { fontSize: 10, fontWeight: '800', color: theme.colors.textMuted, letterSpacing: 1 },
  amount: { fontSize: 26, fontWeight: '900', color: theme.colors.primary, marginTop: 4 },
  status: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  counterBox: {
    marginTop: 8, padding: 8, borderRadius: theme.radius.md,
    backgroundColor: '#fff8e6', borderWidth: 1, borderColor: '#f3d58a',
  },
  counterLabel: { fontSize: 10, fontWeight: '800', color: '#8a6500', letterSpacing: 1 },
  counterAmt: { fontSize: 22, fontWeight: '900', color: '#8a6500', marginTop: 2 },
  counterMsg: { color: '#6a4f00', marginTop: 2 },
  row: { flexDirection: 'row', gap: 8, marginTop: 10 },
  btn: { flex: 1, paddingVertical: 8, borderRadius: theme.radius.md, alignItems: 'center' },
  accept: { backgroundColor: theme.colors.success },
  counter: { backgroundColor: theme.colors.primary },
  decline: { backgroundColor: theme.colors.danger },
  btnText: { color: '#fff', fontWeight: '700' },
});
