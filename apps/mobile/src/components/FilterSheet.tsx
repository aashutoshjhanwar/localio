import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, TextInput, ScrollView } from 'react-native';
import { theme } from '../theme';

export type SortMode = 'nearest' | 'newest' | 'price_asc' | 'price_desc';

export interface FilterState {
  priceMin?: number; // rupees (not paise) for UX
  priceMax?: number;
  sort: SortMode;
  kind: 'all' | 'listing' | 'service';
}

export const DEFAULT_FILTERS: FilterState = { sort: 'nearest', kind: 'all' };

interface Props {
  visible: boolean;
  onClose: () => void;
  value: FilterState;
  onApply: (next: FilterState) => void;
}

const SORTS: Array<{ key: SortMode; label: string }> = [
  { key: 'nearest', label: '📍 Nearest' },
  { key: 'newest', label: '🆕 Newest' },
  { key: 'price_asc', label: '₹↑ Price: low → high' },
  { key: 'price_desc', label: '₹↓ Price: high → low' },
];

const KINDS: Array<{ key: FilterState['kind']; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'listing', label: 'Items' },
  { key: 'service', label: 'Services' },
];

export function FilterSheet({ visible, onClose, value, onApply }: Props) {
  const [draft, setDraft] = useState<FilterState>(value);
  const [minStr, setMinStr] = useState(value.priceMin != null ? String(value.priceMin) : '');
  const [maxStr, setMaxStr] = useState(value.priceMax != null ? String(value.priceMax) : '');

  useEffect(() => {
    if (visible) {
      setDraft(value);
      setMinStr(value.priceMin != null ? String(value.priceMin) : '');
      setMaxStr(value.priceMax != null ? String(value.priceMax) : '');
    }
  }, [visible, value]);

  function commit() {
    const priceMin = minStr.trim() ? Math.max(0, parseInt(minStr, 10) || 0) : undefined;
    const priceMax = maxStr.trim() ? Math.max(0, parseInt(maxStr, 10) || 0) : undefined;
    onApply({ ...draft, priceMin, priceMax });
    onClose();
  }

  function reset() {
    setDraft(DEFAULT_FILTERS);
    setMinStr(''); setMaxStr('');
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Filter & sort</Text>
            <TouchableOpacity onPress={onClose}><Text style={styles.close}>✕</Text></TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.section}>Show</Text>
            <View style={styles.chipRow}>
              {KINDS.map((k) => {
                const active = draft.kind === k.key;
                return (
                  <TouchableOpacity
                    key={k.key}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setDraft({ ...draft, kind: k.key })}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{k.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.section}>Price range (₹)</Text>
            <View style={styles.priceRow}>
              <TextInput
                style={styles.priceInput}
                placeholder="Min"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="number-pad"
                value={minStr}
                onChangeText={setMinStr}
              />
              <Text style={styles.priceDash}>—</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="Max"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="number-pad"
                value={maxStr}
                onChangeText={setMaxStr}
              />
            </View>

            <Text style={styles.section}>Sort by</Text>
            <View style={{ gap: 8, marginBottom: 20 }}>
              {SORTS.map((s) => {
                const active = draft.sort === s.key;
                return (
                  <TouchableOpacity
                    key={s.key}
                    style={[styles.sortRow, active && styles.sortRowActive]}
                    onPress={() => setDraft({ ...draft, sort: s.key })}
                  >
                    <Text style={[styles.sortText, active && styles.sortTextActive]}>{s.label}</Text>
                    {active && <Text style={styles.sortCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, styles.resetBtn]} onPress={reset}>
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.applyBtn]} onPress={commit}>
              <Text style={styles.applyText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function isFilterActive(f: FilterState): boolean {
  return f.sort !== 'nearest' || f.kind !== 'all' || f.priceMin != null || f.priceMax != null;
}

export function activeFilterCount(f: FilterState): number {
  let n = 0;
  if (f.sort !== 'nearest') n += 1;
  if (f.kind !== 'all') n += 1;
  if (f.priceMin != null) n += 1;
  if (f.priceMax != null) n += 1;
  return n;
}

export function applyFilters<T extends { kind?: string; data?: any; distanceKm?: number; createdAt?: string | Date }>(
  items: T[],
  f: FilterState,
): T[] {
  let out = [...items];
  if (f.kind !== 'all') out = out.filter((i) => i.kind === f.kind);
  if (f.priceMin != null || f.priceMax != null) {
    const minP = f.priceMin != null ? f.priceMin * 100 : -Infinity;
    const maxP = f.priceMax != null ? f.priceMax * 100 : Infinity;
    out = out.filter((i) => {
      const priceInPaise = i.data?.priceInPaise ?? i.data?.priceFrom;
      if (priceInPaise == null) return f.priceMin == null && f.priceMax == null;
      return priceInPaise >= minP && priceInPaise <= maxP;
    });
  }
  switch (f.sort) {
    case 'newest':
      out.sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
      break;
    case 'price_asc':
      out.sort((a, b) => (a.data?.priceInPaise ?? a.data?.priceFrom ?? Infinity) - (b.data?.priceInPaise ?? b.data?.priceFrom ?? Infinity));
      break;
    case 'price_desc':
      out.sort((a, b) => (b.data?.priceInPaise ?? b.data?.priceFrom ?? -Infinity) - (a.data?.priceInPaise ?? a.data?.priceFrom ?? -Infinity));
      break;
    case 'nearest':
    default:
      out.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
      break;
  }
  return out;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 28, maxHeight: '85%',
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  close: { fontSize: 20, color: theme.colors.textMuted, padding: 6 },
  section: { fontSize: 12, fontWeight: '800', color: theme.colors.textMuted, letterSpacing: 0.6, marginTop: 14, marginBottom: 8 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { color: theme.colors.text, fontWeight: '700', fontSize: 13 },
  chipTextActive: { color: '#fff' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceInput: {
    flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    paddingHorizontal: 12, paddingVertical: 10, color: theme.colors.text, fontSize: 15,
    backgroundColor: theme.colors.card,
  },
  priceDash: { color: theme.colors.textMuted, fontWeight: '700' },
  sortRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
  },
  sortRowActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  sortText: { color: theme.colors.text, fontWeight: '600' },
  sortTextActive: { color: theme.colors.primaryDark, fontWeight: '800' },
  sortCheck: { color: theme.colors.primary, fontWeight: '900' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: { flex: 1, borderRadius: theme.radius.md, paddingVertical: 14, alignItems: 'center' },
  resetBtn: { backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  resetText: { color: theme.colors.text, fontWeight: '800' },
  applyBtn: { backgroundColor: theme.colors.primary, ...theme.shadow.sm },
  applyText: { color: '#fff', fontWeight: '800' },
});
