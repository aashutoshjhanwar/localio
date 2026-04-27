import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

// Tier derived from backend 0-100 score (matches services/trust.ts tierFromScore).
export type TrustTier = 'new' | 'rising' | 'trusted' | 'pro' | 'elite';

export function tierFromScore100(score: number): TrustTier {
  if (score >= 85) return 'elite';
  if (score >= 70) return 'pro';
  if (score >= 50) return 'trusted';
  if (score >= 25) return 'rising';
  return 'new';
}

const TIER_STYLE: Record<TrustTier, { label: string; icon: string; bg: string; fg: string }> = {
  elite:   { label: 'Elite',   icon: '💎', bg: '#FFF4D6', fg: '#8A6A00' },
  pro:     { label: 'Pro',     icon: '🏅', bg: '#D8F3E2', fg: '#0E7F40' },
  trusted: { label: 'Trusted', icon: '✓',  bg: '#DDEBFF', fg: '#1653C5' },
  rising:  { label: 'Rising',  icon: '🌱', bg: '#F1EDFF', fg: '#5B3DBF' },
  new:     { label: 'New',     icon: '•',  bg: theme.colors.surface, fg: theme.colors.textMuted },
};

// Back-compat: old callers pass a 0-5 rating average. We accept both and auto-detect.
// If score <= 5, treat as 5-star average; otherwise treat as 0-100 trust score.
export function trustTier(score: number) {
  if (score <= 5) {
    if (score >= 4.5) return { label: 'Elite', icon: '⭐', bg: '#FFF4D6', fg: '#8A6A00' };
    if (score >= 4)   return { label: 'Top rated', icon: '🏅', bg: '#D8F3E2', fg: '#0E7F40' };
    if (score >= 3)   return { label: 'Trusted', icon: '✓', bg: '#DDEBFF', fg: '#1653C5' };
    if (score > 0)    return { label: 'Rising', icon: '🌱', bg: '#F1EDFF', fg: '#5B3DBF' };
    return { label: 'New', icon: '•', bg: theme.colors.surface, fg: theme.colors.textMuted };
  }
  return TIER_STYLE[tierFromScore100(score)];
}

export function TrustBadge({
  score,
  size = 'sm',
  kycVerified,
  showScore,
}: {
  score?: number | null;
  size?: 'sm' | 'md';
  kycVerified?: boolean;
  showScore?: boolean;  // show the raw 0-100 number alongside the tier
}) {
  const t = trustTier(score ?? 0);
  const padV = size === 'md' ? 4 : 2;
  const padH = size === 'md' ? 8 : 6;
  const fs = size === 'md' ? 12 : 11;
  const isTrust100 = (score ?? 0) > 5;

  return (
    <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap' }}>
      <View style={[styles.chip, { backgroundColor: t.bg, paddingVertical: padV, paddingHorizontal: padH }]}>
        <Text style={[styles.text, { color: t.fg, fontSize: fs }]}>
          {t.icon} {t.label}{showScore && isTrust100 ? ` · ${Math.round(score!)}` : ''}
        </Text>
      </View>
      {kycVerified && (
        <View style={[styles.chip, { backgroundColor: '#E0F7F1', paddingVertical: padV, paddingHorizontal: padH }]}>
          <Text style={[styles.text, { color: '#0B7A5E', fontSize: fs }]}>🛡 KYC</Text>
        </View>
      )}
    </View>
  );
}

// Larger breakdown card — used on the profile and seller detail screens.
export function TrustBreakdownCard({ trust }: { trust: {
  score: number;
  tier: TrustTier;
  components: Record<string, { value: number; weight: number; label: string }>;
  suggestions?: string[];
} }) {
  const style = TIER_STYLE[trust.tier] ?? TIER_STYLE.new;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.score}>{trust.score}</Text>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={[styles.chipBig, { backgroundColor: style.bg }]}>
            <Text style={[styles.text, { color: style.fg, fontSize: 13 }]}>{style.icon} {style.label}</Text>
          </View>
          <Text style={styles.caption}>Trust score out of 100</Text>
        </View>
      </View>

      <View style={{ marginTop: 12 }}>
        {Object.entries(trust.components).map(([k, c]) => (
          <View key={k} style={styles.row}>
            <Text style={styles.rowLabel} numberOfLines={1}>{c.label}</Text>
            <View style={styles.bar}>
              <View style={[styles.barFill, { width: `${Math.round(c.value * 100)}%` }]} />
            </View>
            <Text style={styles.rowVal}>{Math.round(c.value * 100)}</Text>
          </View>
        ))}
      </View>

      {trust.suggestions && trust.suggestions.length > 0 && (
        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>Raise your score</Text>
          {trust.suggestions.map((s, i) => (
            <Text key={i} style={styles.tip}>• {s}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { borderRadius: 999, alignSelf: 'flex-start' },
  chipBig: { borderRadius: 999, alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 10 },
  text: { fontWeight: '800' },
  card: {
    backgroundColor: theme.colors.card, borderRadius: theme.radius.md,
    padding: theme.spacing(3), ...theme.shadow.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  score: { fontSize: 44, fontWeight: '900', color: theme.colors.text, minWidth: 70 },
  caption: { color: theme.colors.textMuted, marginTop: 4, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  rowLabel: { flex: 1.2, color: theme.colors.text, fontSize: 13 },
  rowVal: { width: 32, textAlign: 'right', color: theme.colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  bar: { flex: 1.3, height: 6, backgroundColor: theme.colors.surface, borderRadius: 3, marginHorizontal: 8, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: theme.colors.primary, borderRadius: 3 },
  tips: { marginTop: 10, padding: 10, backgroundColor: theme.colors.primarySoft, borderRadius: theme.radius.sm },
  tipsTitle: { fontWeight: '800', color: theme.colors.primaryDark, marginBottom: 4 },
  tip: { color: theme.colors.text, fontSize: 13, marginVertical: 1 },
});
