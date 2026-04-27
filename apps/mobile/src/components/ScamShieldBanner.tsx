import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from '../theme';

export interface ShieldData {
  risk: 'clean' | 'low' | 'medium' | 'high';
  flags?: Array<{ kind: string; severity: string; reason: string; excerpt?: string }>;
  advice?: string;
}

export function ScamShieldBanner({
  shield, onDismiss, onReport,
}: {
  shield: ShieldData;
  onDismiss?: () => void;
  onReport?: () => void;
}) {
  if (!shield || shield.risk === 'clean') return null;
  const palette = shield.risk === 'high'
    ? { bg: '#FEE2E2', fg: '#991B1B', accent: '#DC2626', emoji: '🚨' }
    : shield.risk === 'medium'
    ? { bg: '#FEF3C7', fg: '#92400E', accent: '#D97706', emoji: '⚠️' }
    : { bg: '#E0F2FE', fg: '#075985', accent: '#0284C7', emoji: 'ℹ️' };
  const first = shield.flags?.[0];
  return (
    <View style={[styles.wrap, { backgroundColor: palette.bg, borderColor: palette.accent }]}>
      <Text style={[styles.emoji]}>{palette.emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: palette.fg }]}>
          {shield.risk === 'high' ? 'Likely scam detected' : shield.risk === 'medium' ? 'Be careful' : 'Heads up'}
        </Text>
        <Text style={[styles.body, { color: palette.fg }]}>{first?.reason ?? shield.advice}</Text>
        {shield.advice && shield.advice !== first?.reason ? (
          <Text style={[styles.advice, { color: palette.fg }]}>{shield.advice}</Text>
        ) : null}
        <View style={styles.row}>
          {onReport ? (
            <TouchableOpacity onPress={onReport}>
              <Text style={[styles.link, { color: palette.accent }]}>Report user</Text>
            </TouchableOpacity>
          ) : null}
          {onDismiss ? (
            <TouchableOpacity onPress={onDismiss}>
              <Text style={[styles.link, { color: palette.fg, opacity: 0.7 }]}>Dismiss</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    padding: 10, borderRadius: theme.radius.sm, borderWidth: 1,
    marginVertical: 6, marginHorizontal: 8,
  },
  emoji: { fontSize: 20, marginTop: 1 },
  title: { fontWeight: '800', fontSize: 13, marginBottom: 2 },
  body: { fontSize: 13, lineHeight: 18 },
  advice: { fontSize: 12, marginTop: 4, opacity: 0.9 },
  row: { flexDirection: 'row', gap: 16, marginTop: 6 },
  link: { fontWeight: '700', fontSize: 12 },
});
