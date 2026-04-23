import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image, Alert, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Api } from '../api/client';
import { useLocation } from '../hooks/useLocation';
import { secureStorage } from '../state/secureStorage';
import { theme } from '../theme';
import { attrFields } from '../utils/listingAttributes';
import type { RootStackParamList } from '../nav/RootNav';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Tab = 'listings' | 'services' | 'societies';

const RECENT_KEY = 'localio.recentSearches';
const RECENT_MAX = 8;

export function SearchScreen() {
  const nav = useNavigation<Nav>();
  const { coords } = useLocation();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('listings');
  const [results, setResults] = useState<{ listings: any[]; services: any[]; societies: any[] }>({ listings: [], services: [], societies: [] });
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cats, setCats] = useState<any[]>([]);
  const [catFilter, setCatFilter] = useState<string | undefined>(undefined);
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState<'recent' | 'priceAsc' | 'priceDesc'>('recent');
  const [attrFilters, setAttrFilters] = useState<Record<string, any>>({});
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Api.categories()
      .then((r) => setCats(Array.from(new Map([...r.listings, ...r.services].map((c: any) => [c.key, c])).values())))
      .catch(() => {});
  }, []);

  const activeFilterCount =
    (catFilter ? 1 : 0) + (minPrice ? 1 : 0) + (maxPrice ? 1 : 0) + (sort !== 'recent' ? 1 : 0)
    + Object.keys(attrFilters).length;

  // Reset attribute filters when category changes
  useEffect(() => { setAttrFilters({}); }, [catFilter]);

  const catAttrs = catFilter ? attrFields(catFilter).filter((f) => f.type === 'choice' || f.type === 'number') : [];

  useEffect(() => {
    secureStorage.get(RECENT_KEY).then((raw) => {
      if (!raw) return;
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setRecent(arr.filter((x) => typeof x === 'string').slice(0, RECENT_MAX));
      } catch {}
    });
  }, []);

  const pushRecent = (term: string) => {
    const t = term.trim();
    if (!t) return;
    setRecent((prev) => {
      const next = [t, ...prev.filter((x) => x.toLowerCase() !== t.toLowerCase())].slice(0, RECENT_MAX);
      secureStorage.set(RECENT_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const clearRecent = () => {
    setRecent([]);
    secureStorage.del(RECENT_KEY).catch(() => {});
  };

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (persistRef.current) clearTimeout(persistRef.current);
    if (!q.trim()) { setResults({ listings: [], services: [], societies: [] }); return; }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      try {
        const parts = [
          `q=${encodeURIComponent(q.trim())}`,
          `lat=${coords.lat}`,
          `lng=${coords.lng}`,
          `radiusKm=25`,
          `sort=${sort}`,
        ];
        if (catFilter) parts.push(`category=${encodeURIComponent(catFilter)}`);
        const minP = parseInt(minPrice, 10);
        const maxP = parseInt(maxPrice, 10);
        if (minP > 0) parts.push(`minPrice=${minP * 100}`);
        if (maxP > 0) parts.push(`maxPrice=${maxP * 100}`);
        if (Object.keys(attrFilters).length > 0) parts.push(`attrs=${encodeURIComponent(JSON.stringify(attrFilters))}`);
        const r = await Api.search(parts.join('&'));
        setResults(r);
      } catch { /* noop */ } finally { setLoading(false); }
    }, 250);
    persistRef.current = setTimeout(() => pushRecent(q), 1200);
  }, [q, coords.lat, coords.lng, catFilter, minPrice, maxPrice, sort, attrFilters]);

  const data = useMemo(() => (results as any)[tab] ?? [], [results, tab]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          value={q}
          onChangeText={setQ}
          placeholder="Search listings, services, societies"
          placeholderTextColor={theme.colors.textMuted}
          autoFocus
        />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <TouchableOpacity style={styles.filterBtn} onPress={() => setFiltersOpen((v) => !v)}>
            <Text style={styles.filterBtnText}>
              ⚙️ Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
            </Text>
          </TouchableOpacity>
          {activeFilterCount > 0 && (
            <TouchableOpacity
              style={[styles.filterBtn, { borderColor: theme.colors.border }]}
              onPress={() => { setCatFilter(undefined); setMinPrice(''); setMaxPrice(''); setSort('recent'); setAttrFilters({}); }}
            >
              <Text style={[styles.filterBtnText, { color: theme.colors.text }]}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
        {filtersOpen && (
          <View style={styles.filterPanel}>
            <Text style={styles.filterLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 6 }}>
              <TouchableOpacity
                style={[styles.chip, !catFilter && styles.chipActive]}
                onPress={() => setCatFilter(undefined)}
              >
                <Text style={[styles.chipText, !catFilter && { color: '#fff' }]}>All</Text>
              </TouchableOpacity>
              {cats.map((c: any) => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.chip, catFilter === c.key && styles.chipActive]}
                  onPress={() => setCatFilter((prev) => prev === c.key ? undefined : c.key)}
                >
                  <Text style={[styles.chipText, catFilter === c.key && { color: '#fff' }]}>
                    {c.icon ? `${c.icon} ` : ''}{c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Text style={[styles.filterLabel, { marginTop: 8 }]}>Price (₹)</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={[styles.priceInput, { flex: 1 }]}
                value={minPrice}
                onChangeText={setMinPrice}
                placeholder="Min"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="number-pad"
              />
              <TextInput
                style={[styles.priceInput, { flex: 1 }]}
                value={maxPrice}
                onChangeText={setMaxPrice}
                placeholder="Max"
                placeholderTextColor={theme.colors.textMuted}
                keyboardType="number-pad"
              />
            </View>
            <Text style={[styles.filterLabel, { marginTop: 8 }]}>Sort</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([
                { k: 'recent', label: 'Newest' },
                { k: 'priceAsc', label: 'Price ↑' },
                { k: 'priceDesc', label: 'Price ↓' },
              ] as const).map((s) => (
                <TouchableOpacity
                  key={s.k}
                  style={[styles.chip, sort === s.k && styles.chipActive]}
                  onPress={() => setSort(s.k)}
                >
                  <Text style={[styles.chipText, sort === s.k && { color: '#fff' }]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {catAttrs.length > 0 && (
              <>
                <Text style={[styles.filterLabel, { marginTop: 10 }]}>More filters</Text>
                {catAttrs.map((f) => {
                  if (f.type === 'choice') {
                    const selected = attrFilters[f.key];
                    return (
                      <View key={f.key} style={{ marginBottom: 8 }}>
                        <Text style={styles.attrLabel}>{f.label}</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                          {f.options.map((opt) => {
                            const active = selected === opt;
                            return (
                              <TouchableOpacity
                                key={opt}
                                style={[styles.chip, active && styles.chipActive]}
                                onPress={() => setAttrFilters((p) => {
                                  const next = { ...p };
                                  if (active) delete next[f.key]; else next[f.key] = opt;
                                  return next;
                                })}
                              >
                                <Text style={[styles.chipText, active && { color: '#fff' }]}>{opt}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    );
                  }
                  // number — show min/max pair
                  const range = (attrFilters[f.key] ?? {}) as { min?: number; max?: number };
                  return (
                    <View key={f.key} style={{ marginBottom: 8 }}>
                      <Text style={styles.attrLabel}>{f.label}{f.suffix ? ` (${f.suffix})` : ''}</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TextInput
                          style={[styles.priceInput, { flex: 1 }]}
                          value={range.min != null ? String(range.min) : ''}
                          onChangeText={(v) => setAttrFilters((p) => {
                            const n = parseFloat(v);
                            const r = { ...(p[f.key] ?? {}) };
                            if (Number.isFinite(n)) r.min = n; else delete r.min;
                            const next = { ...p };
                            if (r.min == null && r.max == null) delete next[f.key]; else next[f.key] = r;
                            return next;
                          })}
                          placeholder="Min"
                          placeholderTextColor={theme.colors.textMuted}
                          keyboardType="number-pad"
                        />
                        <TextInput
                          style={[styles.priceInput, { flex: 1 }]}
                          value={range.max != null ? String(range.max) : ''}
                          onChangeText={(v) => setAttrFilters((p) => {
                            const n = parseFloat(v);
                            const r = { ...(p[f.key] ?? {}) };
                            if (Number.isFinite(n)) r.max = n; else delete r.max;
                            const next = { ...p };
                            if (r.min == null && r.max == null) delete next[f.key]; else next[f.key] = r;
                            return next;
                          })}
                          placeholder="Max"
                          placeholderTextColor={theme.colors.textMuted}
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </View>
        )}
        {q.trim().length > 1 && (
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={async () => {
              try {
                await Api.saveSearch({
                  label: q.trim(),
                  q: q.trim(),
                  kind: tab === 'societies' ? 'both' : (tab === 'listings' ? 'listing' : 'service'),
                  lat: coords.lat, lng: coords.lng, radiusKm: 15,
                });
                Alert.alert('Saved', `You'll be notified when new matches appear for "${q.trim()}".`);
              } catch (e: any) {
                Alert.alert('Error', e.message ?? 'Try again');
              }
            }}
          >
            <Text style={styles.saveBtnText}>🔔 Save search & alert me</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.tabs}>
        {(['listings', 'services', 'societies'] as Tab[]).map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && { color: '#fff' }]}>
              {t} ({(results as any)[t]?.length ?? 0})
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      {!q.trim() && recent.length > 0 && (
        <View style={styles.recentWrap}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>Recent searches</Text>
            <TouchableOpacity onPress={clearRecent}><Text style={styles.recentClear}>Clear</Text></TouchableOpacity>
          </View>
          <View style={styles.chipRow}>
            {recent.map((term) => (
              <TouchableOpacity key={term} style={styles.chip} onPress={() => setQ(term)}>
                <Text style={styles.chipText}>🕘 {term}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
      {loading ? (
        <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(x: any) => x.id}
          contentContainerStyle={{ padding: 12 }}
          ListEmptyComponent={<Text style={styles.empty}>{q ? 'Nothing matched.' : 'Type to search.'}</Text>}
          renderItem={({ item }: any) => {
            if (tab === 'listings') {
              return (
                <TouchableOpacity style={styles.row} onPress={() => nav.navigate('ListingDetail', { id: item.id })}>
                  {item.images?.[0] ? <Image source={{ uri: item.images[0] }} style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbPh]}><Text>📦</Text></View>}
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.price}>₹{(item.priceInPaise / 100).toLocaleString('en-IN')}</Text>
                    {item.distanceKm !== undefined && <Text style={styles.meta}>{item.distanceKm.toFixed(1)} km · {item.category}</Text>}
                  </View>
                </TouchableOpacity>
              );
            }
            if (tab === 'services') {
              return (
                <TouchableOpacity style={styles.row} onPress={() => nav.navigate('ServiceDetail', { id: item.id })}>
                  <View style={[styles.thumb, styles.thumbPh]}><Text style={{ fontSize: 22 }}>🛠️</Text></View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.meta}>
                      {item.ratingAvg ? `⭐ ${item.ratingAvg.toFixed(1)}` : 'New'}
                      {item.distanceKm !== undefined ? ` · ${item.distanceKm.toFixed(1)} km` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }
            return (
              <View style={styles.row}>
                <View style={[styles.thumb, styles.thumbPh]}><Text style={{ fontSize: 22 }}>🏘️</Text></View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.title} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.meta}>{item.city} · {item.pincode} · {item.memberCount} members</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchBar: { padding: 12 },
  saveBtn: { marginTop: 10, borderWidth: 1, borderColor: theme.colors.primary, borderRadius: theme.radius.md, paddingVertical: 10, alignItems: 'center' },
  saveBtnText: { color: theme.colors.primary, fontWeight: '700' },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg,
    paddingHorizontal: 14, paddingVertical: 12, color: theme.colors.text, fontSize: 16,
    backgroundColor: theme.colors.surface,
  },
  tabs: { flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  tab: {
    flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 999,
    paddingVertical: 8, alignItems: 'center', backgroundColor: theme.colors.surface,
  },
  tabActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  tabText: { color: theme.colors.text, fontWeight: '700', textTransform: 'capitalize' },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 60 },
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg, padding: 12, marginBottom: 10,
  },
  thumb: { width: 64, height: 64, borderRadius: theme.radius.md, backgroundColor: '#EEE' },
  thumbPh: { justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  price: { color: theme.colors.primary, fontWeight: '800', marginTop: 2 },
  meta: { color: theme.colors.textMuted, marginTop: 4, fontSize: 13 },
  recentWrap: { paddingHorizontal: 12, marginBottom: 8 },
  recentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  recentTitle: { color: theme.colors.text, fontWeight: '800' },
  recentClear: { color: theme.colors.textMuted, fontSize: 13 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.colors.surface },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { color: theme.colors.text, fontSize: 13, fontWeight: '600' },
  filterBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.pill,
    borderWidth: 1, borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft,
  },
  filterBtnText: { color: theme.colors.primaryDark, fontWeight: '800', fontSize: 13 },
  filterPanel: {
    marginTop: 10, padding: 12, borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
  },
  filterLabel: { fontSize: 12, fontWeight: '800', color: theme.colors.textMuted, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  attrLabel: { fontSize: 11, fontWeight: '700', color: theme.colors.text, marginBottom: 4 },
  priceInput: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    paddingHorizontal: 12, paddingVertical: 10, color: theme.colors.text, fontSize: 14,
    backgroundColor: theme.colors.bg,
  },
});
