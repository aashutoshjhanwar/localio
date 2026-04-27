import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, FlatList, ActivityIndicator,
  Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { Api } from '../api/client';
import { useLocation } from '../hooks/useLocation';
import { useLocationOverride, type LocationPick } from '../state/location';
import { theme } from '../theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick?: (pick: LocationPick) => void;
}

type Row =
  | { kind: 'header'; title: string }
  | { kind: 'current' }
  | { kind: 'create' }
  | { kind: 'recent'; pick: LocationPick }
  | { kind: 'society'; society: any }
  | { kind: 'place'; name: string; lat: number; lng: number };

export function LocationPicker({ visible, onClose, onPick }: Props) {
  const nav = useNavigation<any>();
  const { coords, refresh } = useLocation();
  const { recents, setOverride } = useLocationOverride();
  const [q, setQ] = useState('');
  const [societies, setSocieties] = useState<any[]>([]);
  const [searchHits, setSearchHits] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [usingMine, setUsingMine] = useState(false);

  useEffect(() => {
    if (!visible || !coords) return;
    let cancelled = false;
    setLoading(true);
    Api.nearbySocieties(coords.lat, coords.lng, 25)
      .then((r) => { if (!cancelled) setSocieties(r.societies); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, coords?.lat, coords?.lng]);

  useEffect(() => {
    if (!visible) return;
    const term = q.trim();
    if (term.length < 2) { setSearchHits(null); return; }
    let cancelled = false;
    const h = setTimeout(async () => {
      const out: Row[] = [];
      const local = societies.filter((s) =>
        s.name.toLowerCase().includes(term.toLowerCase())
        || (s.city ?? '').toLowerCase().includes(term.toLowerCase())
        || (s.pincode ?? '').includes(term),
      );
      if (local.length > 0) {
        out.push({ kind: 'header', title: 'Verified societies' });
        for (const s of local.slice(0, 6)) out.push({ kind: 'society', society: s });
      }
      try {
        const places = await Location.geocodeAsync(term);
        if (places.length > 0) {
          out.push({ kind: 'header', title: 'Places' });
          for (const p of places.slice(0, 6)) out.push({ kind: 'place', name: term, lat: p.latitude, lng: p.longitude });
        }
      } catch { /* noop */ }
      out.push({ kind: 'create' });
      if (!cancelled) setSearchHits(out);
    }, 300);
    return () => { cancelled = true; clearTimeout(h); };
  }, [q, visible, societies]);

  const finishPick = useCallback(async (pick: LocationPick) => {
    await setOverride(pick);
    onPick?.(pick);
    onClose();
    setQ('');
  }, [setOverride, onPick, onClose]);

  async function useCurrent() {
    setUsingMine(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow location access to use your current spot.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const places = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude }).catch(() => []);
      const p = places[0] as any;
      const label = p
        ? [p.subLocality ?? p.district ?? p.street, p.city ?? p.region].filter(Boolean).join(', ')
        : 'My current location';
      await setOverride(null);
      onPick?.({ label, lat: loc.coords.latitude, lng: loc.coords.longitude });
      refresh();
      onClose();
      setQ('');
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Could not get location');
    } finally { setUsingMine(false); }
  }

  function pickSociety(s: any) {
    finishPick({
      label: `${s.name}, ${s.city}`,
      lat: s.lat, lng: s.lng,
      societyId: s.id, pincode: s.pincode,
    });
  }
  function pickPlace(p: { name: string; lat: number; lng: number }) {
    finishPick({ label: p.name, lat: p.lat, lng: p.lng });
  }
  function startCreate() {
    onClose();
    setQ('');
    setTimeout(() => { nav.navigate('CreateSociety'); }, 250);
  }

  // Default rows when no search term
  const defaultRows: Row[] = [
    { kind: 'current' },
    ...(recents.length ? [{ kind: 'header' as const, title: 'Recent' }] : []),
    ...recents.map<Row>((r) => ({ kind: 'recent', pick: r })),
    ...(societies.length ? [{ kind: 'header' as const, title: 'Verified societies near you' }] : []),
    ...societies.map<Row>((s) => ({ kind: 'society', society: s })),
    { kind: 'create' },
  ];
  const rows = searchHits ?? defaultRows;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Sticky header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Location</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.cancel}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Sticky search row */}
        <View style={styles.searchRow}>
          <Text style={styles.searchIcon}>🔎</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search city, society or pincode"
            placeholderTextColor={theme.colors.textMuted}
            style={styles.searchInput}
            autoFocus
            returnKeyType="search"
          />
          {q.length > 0 ? (
            <TouchableOpacity onPress={() => setQ('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.clear}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <FlatList
            data={rows}
            keyExtractor={(it, i) => `${it.kind}:${i}`}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={loading ? <ActivityIndicator style={{ marginTop: 24 }} color={theme.colors.primary} /> : null}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            contentContainerStyle={{ paddingBottom: 24 }}
            renderItem={({ item }) => {
              if (item.kind === 'header') return <Text style={styles.sectionHead}>{item.title}</Text>;
              if (item.kind === 'current') {
                return (
                  <TouchableOpacity style={styles.row} onPress={useCurrent} disabled={usingMine}>
                    <View style={styles.iconBubble}>
                      {usingMine ? <ActivityIndicator color={theme.colors.primary} size="small" /> : <Text style={styles.bubbleEmoji}>🎯</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowName, { color: theme.colors.primary }]}>Use my current location</Text>
                      <Text style={styles.rowMeta}>GPS-accurate</Text>
                    </View>
                    <Text style={styles.chev}>›</Text>
                  </TouchableOpacity>
                );
              }
              if (item.kind === 'create') {
                return (
                  <TouchableOpacity style={styles.row} onPress={startCreate}>
                    <View style={[styles.iconBubble, { backgroundColor: theme.colors.successSoft }]}>
                      <Text style={styles.bubbleEmoji}>＋</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowName, { color: theme.colors.success }]}>Create a new society</Text>
                      <Text style={styles.rowMeta}>Don't see your society? Add it for your neighbors.</Text>
                    </View>
                    <Text style={styles.chev}>›</Text>
                  </TouchableOpacity>
                );
              }
              if (item.kind === 'recent') {
                return (
                  <TouchableOpacity style={styles.row} onPress={() => finishPick(item.pick)}>
                    <View style={styles.iconBubble}><Text style={styles.bubbleEmoji}>🕒</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName} numberOfLines={1}>{item.pick.label}</Text>
                      <Text style={styles.rowMeta}>Recent</Text>
                    </View>
                    <Text style={styles.arrow}>↖</Text>
                  </TouchableOpacity>
                );
              }
              if (item.kind === 'society') {
                const s = item.society;
                return (
                  <TouchableOpacity style={styles.row} onPress={() => pickSociety(s)}>
                    <View style={styles.iconBubble}><Text style={styles.bubbleEmoji}>🏘️</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowName} numberOfLines={1}>{s.name}</Text>
                      <Text style={styles.rowMeta} numberOfLines={1}>
                        Society · {s.city}{s.pincode ? ` · ${s.pincode}` : ''}{typeof s.distanceKm === 'number' ? ` · ${s.distanceKm.toFixed(1)} km` : ''}
                      </Text>
                    </View>
                    <Text style={styles.arrow}>↖</Text>
                  </TouchableOpacity>
                );
              }
              // place
              return (
                <TouchableOpacity style={styles.row} onPress={() => pickPlace(item)}>
                  <View style={styles.iconBubble}><Text style={styles.bubbleEmoji}>📍</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.rowMeta}>Place</Text>
                  </View>
                  <Text style={styles.arrow}>↖</Text>
                </TouchableOpacity>
              );
            }}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.bg,
  },
  close: { fontSize: 22, color: theme.colors.text, fontWeight: '500', minWidth: 24 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.text },
  cancel: { fontSize: 15, color: theme.colors.text, fontWeight: '600', textDecorationLine: 'underline' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: theme.colors.surface,
  },
  searchIcon: { fontSize: 16, marginRight: 10, color: theme.colors.textMuted },
  searchInput: { flex: 1, fontSize: 16, color: theme.colors.text, paddingVertical: 4 },
  clear: { fontSize: 16, color: theme.colors.textMuted, marginLeft: 6, paddingHorizontal: 6 },
  sectionHead: {
    fontSize: 11, fontWeight: '800', color: theme.colors.textMuted, letterSpacing: 0.6, textTransform: 'uppercase',
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 8,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  iconBubble: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  bubbleEmoji: { fontSize: 18 },
  rowName: { fontSize: 15, fontWeight: '700', color: theme.colors.text },
  rowMeta: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  arrow: { fontSize: 18, color: theme.colors.textMuted, transform: [{ rotate: '0deg' }] },
  chev: { fontSize: 22, color: theme.colors.textMuted, fontWeight: '300' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.border, marginLeft: 64 },
});
