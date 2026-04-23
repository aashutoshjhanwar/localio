import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

export function trustTier(score: number): { label: string; icon: string; bg: string; fg: string } {
  if (score >= 4.5) return { label: 'Elite', icon: '⭐', bg: '#FFF4D6', fg: '#8A6A00' };
  if (score >= 4)   return { label: 'Top rated', icon: '🏅', bg: '#D8F3E2', fg: '#0E7F40' };
  if (score >= 3)   return { label: 'Trusted', icon: '✓', bg: '#DDEBFF', fg: '#1653C5' };
  if (score > 0)    return { label: 'Rising', icon: '🌱', bg: '#F1EDFF', fg: '#5B3DBF' };
  return { label: 'New', icon: '•', bg: theme.colors.surface, fg: theme.colors.textMuted };
}

export function TrustBadge({ score, size = 'sm', kycVerified }: { score?: number | null; size?: 'sm' | 'md'; kycVerified?: boolean }) {
  const t = trustTier(score ?? 0);
  const padV = size === 'md' ? 4 : 2;
  const padH = size === 'md' ? 8 : 6;
  const fs = size === 'md' ? 12 : 11;
  return (
    <View style={{ flexDirection: 'row', gap: 4 }}>
      <View style={[styles.chip, { backgroundColor: t.bg, paddingVertical: padV, paddingHorizontal: padH }]}>
        <Text style={[styles.text, { color: t.fg, fontSize: fs }]}>{t.icon} {t.label}</Text>
      </View>
      {kycVerified && (
        <View style={[styles.chip, { backgroundColor: '#E0F7F1', paddingVertical: padV, paddingHorizontal: padH }]}>
          <Text style={[styles.text, { color: '#0B7A5E', fontSize: fs }]}>🛡 KYC</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: 999, alignSelf: 'flex-start' },
  text: { fontWeight: '800' },
});
