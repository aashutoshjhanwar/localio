import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Image, ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Slider from '@react-native-community/slider';
import { Api } from '../api/client';
import { useLocation } from '../hooks/useLocation';
import { theme } from '../theme';
import { TrustBadge } from '../components/TrustBadge';
import { FilterSheet, DEFAULT_FILTERS, applyFilters, activeFilterCount, type FilterState } from '../components/FilterSheet';
import { StoryBar } from '../components/StoryBar';
import { useT } from '../i18n';
import type { RootStackParamList } from '../nav/RootNav';

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Scope = 'nearby' | 'city' | 'india';
const SCOPE_RADIUS: Record<Exclude<Scope, 'nearby'>, number> = { city: 50, india: 3000 };

export function FeedScreen() {
  const t = useT();
  const { coords, label } = useLocation();
  const [items, setItems] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unread, setUnread] = useState(0);
  const [scope, setScope] = useState<Scope>('nearby');
  const [nearbyKm, setNearbyKm] = useState(10);
  const [sliderOpen, setSliderOpen] = useState(false);
  const radiusKm = scope === 'nearby' ? nearbyKm : SCOPE_RADIUS[scope];
  const cityName = (label ?? '').split(',').pop()?.trim() || 'City';
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  useEffect(() => { Api.categories().then((r) => setCats([...r.listings, ...r.services])).catch(() => {}); }, []);
  const filtered = useMemo(() => applyFilters(items, filters), [items, filters]);
  const fCount = activeFilterCount(filters);
  const nav = useNavigation<Nav>();

  const loadSavedSearches = useCallback(() => {
    Api.savedSearches().then((r) => setSavedSearches(r.savedSearches)).catch(() => {});
  }, []);
  useEffect(() => { loadSavedSearches(); }, [loadSavedSearches]);

  async function saveCurrentSearch() {
    const scopeLabel = scope === 'india' ? 'India' : scope === 'city' ? cityName : `${nearbyKm}km`;
    const kindLabel = filters.kind === 'service' ? 'Services' : filters.kind === 'listing' ? 'Items' : 'Near me';
    const label = `${kindLabel} · ${scopeLabel}`;
    try {
      await Api.saveSearch({
        label: categoryFilter ? `${label} · ${categoryFilter}` : label,
        kind: filters.kind === 'all' ? 'both' : filters.kind,
        category: categoryFilter,
        lat: coords.lat, lng: coords.lng, radiusKm,
      });
      loadSavedSearches();
      Alert.alert('Saved 🔔', `You'll get a push when new matches are posted within ${radiusKm}km.`);
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Try again');
    }
  }

  async function applySavedSearch(s: any) {
    const r = Math.round(s.radiusKm);
    if (r >= 1000) setScope('india');
    else if (r >= 40) setScope('city');
    else { setScope('nearby'); setNearbyKm(r); }
    setFilters({
      ...DEFAULT_FILTERS,
      kind: s.kind === 'both' ? 'all' : (s.kind as 'listing' | 'service'),
    });
    setCategoryFilter(s.category || undefined);
    if ((s.newMatchCount ?? 0) > 0) {
      try { await Api.markSavedSearchSeen(s.id); } catch {}
      loadSavedSearches();
    }
  }

  useEffect(() => {
    let live = true;
    const tick = () => {
      Api.notifications().then((r) => { if (live) setUnread(r.unread); }).catch(() => {});
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => { live = false; clearInterval(id); };
  }, []);

  const load = useCallback(async () => {
    try {
      const [feedR, trendR] = await Promise.all([
        Api.feed(coords.lat, coords.lng, radiusKm, categoryFilter),
        Api.trendingListings(coords.lat, coords.lng, radiusKm, 10).catch(() => ({ listings: [] as any[] })),
      ]);
      setItems(feedR.feed);
      setTrending(trendR.listings);
    } catch (e) { /* handle */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [coords.lat, coords.lng, radiusKm, categoryFilter]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={styles.iconBar}>
        <TouchableOpacity style={styles.bellBtn} onPress={() => nav.navigate('Categories')}>
          <Text style={{ fontSize: 20 }}>☰</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bellBtn} onPress={() => nav.navigate('Events')}>
          <Text style={{ fontSize: 20 }}>📅</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bellBtn} onPress={() => nav.navigate('Posts')}>
          <Text style={{ fontSize: 20 }}>💬</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bellBtn} onPress={() => nav.navigate('Polls')}>
          <Text style={{ fontSize: 20 }}>📊</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bellBtn} onPress={() => nav.navigate('MapView')}>
          <Text style={{ fontSize: 20 }}>🗺</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bellBtn} onPress={() => nav.navigate('Deals')}>
          <Text style={{ fontSize: 20 }}>📉</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.bellBtn} onPress={() => nav.navigate('Inbox')}>
          <Text style={{ fontSize: 20 }}>🔔</Text>
          {unread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      {savedSearches.length > 0 && (
        <View style={styles.savedRow}>
          <Text style={styles.savedLabel}>🔔 My searches</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 12 }}>
            {savedSearches.map((s) => (
              <View key={s.id} style={styles.savedChip}>
                <TouchableOpacity onPress={() => applySavedSearch(s)} style={styles.savedChipInner}>
                  <Text style={styles.savedChipText} numberOfLines={1}>{s.label}</Text>
                  {s.newMatchCount > 0 && (
                    <View style={styles.savedBadge}>
                      <Text style={styles.savedBadgeText}>{s.newMatchCount > 9 ? '9+' : s.newMatchCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    try { await Api.deleteSavedSearch(s.id); } catch {}
                    loadSavedSearches();
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.savedChipX}
                >
                  <Text style={styles.savedChipXText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            {savedSearches.length > 1 && (
              <TouchableOpacity
                onPress={() => {
                  Alert.alert('Clear all saved searches?', undefined, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Clear all', style: 'destructive', onPress: async () => {
                      await Promise.all(savedSearches.map((s) => Api.deleteSavedSearch(s.id).catch(() => {})));
                      loadSavedSearches();
                    } },
                  ]);
                }}
                style={styles.clearAllChip}
              >
                <Text style={styles.clearAllText}>Clear all</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      )}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={[styles.filterBtn, fCount > 0 && styles.filterBtnActive]}
          onPress={() => setFilterOpen(true)}
        >
          <Text style={[styles.filterBtnText, fCount > 0 && { color: '#fff' }]}>
            ⚙︎ Filters{fCount > 0 ? ` · ${fCount}` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveBtn} onPress={saveCurrentSearch}>
          <Text style={styles.saveBtnText}>🔔 Save</Text>
        </TouchableOpacity>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 12 }}>
          <TouchableOpacity
            style={[styles.scopeChip, scope === 'nearby' && styles.scopeChipActive]}
            onPress={() => { setScope('nearby'); setSliderOpen((v) => scope === 'nearby' ? !v : true); }}
          >
            <Text style={[styles.scopeChipText, scope === 'nearby' && styles.scopeChipTextActive]}>
              📍 {nearbyKm}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scopeChip, scope === 'city' && styles.scopeChipActive]}
            onPress={() => { setScope('city'); setSliderOpen(false); }}
          >
            <Text style={[styles.scopeChipText, scope === 'city' && styles.scopeChipTextActive]}>
              🏙 {cityName}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.scopeChip, scope === 'india' && styles.scopeChipActive]}
            onPress={() => { setScope('india'); setSliderOpen(false); }}
          >
            <Text style={[styles.scopeChipText, scope === 'india' && styles.scopeChipTextActive]}>
              🇮🇳 India
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
      {sliderOpen && scope === 'nearby' && (
        <View style={styles.sliderWrap}>
          <Text style={styles.sliderLabel}>Radius · {nearbyKm} km</Text>
          <Slider
            style={{ width: '100%', height: 36 }}
            minimumValue={1}
            maximumValue={100}
            step={1}
            value={nearbyKm}
            onValueChange={setNearbyKm}
            minimumTrackTintColor={theme.colors.primary}
            maximumTrackTintColor={theme.colors.border}
            thumbTintColor={theme.colors.primary}
          />
        </View>
      )}
      <TouchableOpacity style={styles.searchBar} onPress={() => nav.navigate('Search')} activeOpacity={0.7}>
        <Text style={styles.searchIcon}>🔍</Text>
        <Text style={styles.searchPh}>{t('search_placeholder')}</Text>
      </TouchableOpacity>
      {cats.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
        >
          <TouchableOpacity
            style={[styles.catChip, !categoryFilter && styles.catChipActive]}
            onPress={() => setCategoryFilter(undefined)}
          >
            <Text style={[styles.catChipText, !categoryFilter && styles.catChipTextActive]}>All</Text>
          </TouchableOpacity>
          {Array.from(new Map(cats.map((c) => [c.key, c])).values()).map((c: any) => {
            const active = categoryFilter === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                style={[styles.catChip, active && styles.catChipActive]}
                onPress={() => setCategoryFilter(active ? undefined : c.key)}
              >
                <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
                  {c.icon} {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
      <FlatList
        data={filtered}
        keyExtractor={(i) => `${i.kind}:${i.id}`}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}
        contentContainerStyle={{ padding: 12 }}
        ListHeaderComponent={
          <>
            {coords.lat !== 0 && coords.lng !== 0 && <StoryBar lat={coords.lat} lng={coords.lng} />}
            {trending.length > 0 ? (
            <View style={{ marginBottom: 10, marginTop: 10 }}>
              <Text style={styles.trendTitle}>🔥 Trending near you</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 4 }}>
                {trending.map((l) => (
                  <TouchableOpacity key={l.id} style={styles.trendCard} activeOpacity={0.85} onPress={() => nav.navigate('ListingDetail', { id: l.id })}>
                    {l.images?.[0]
                      ? <Image source={{ uri: l.images[0] }} style={styles.trendImg} />
                      : <View style={[styles.trendImg, styles.trendImgPh]}><Text style={{ fontSize: 30 }}>📦</Text></View>}
                    <View style={{ padding: 10 }}>
                      <Text numberOfLines={1} style={styles.trendName}>{l.title}</Text>
                      <Text style={styles.trendPrice}>₹{(l.priceInPaise / 100).toLocaleString('en-IN')}</Text>
                      <Text style={styles.trendMeta} numberOfLines={1}>
                        {l.distanceKm.toFixed(1)} km · 👀 {l.views} · ❤ {l.favoritesCount}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>
              {fCount > 0 ? 'Nothing matches these filters' : `Nothing within ${radiusKm} km`}
            </Text>
            <Text style={styles.emptySub}>
              {fCount > 0 ? 'Try clearing a filter or widening the radius.' : 'Try widening the search radius.'}
            </Text>
            {fCount > 0 && (
              <TouchableOpacity style={[styles.emptyCta, { marginTop: 12 }]} onPress={() => setFilters(DEFAULT_FILTERS)}>
                <Text style={styles.emptyCtaText}>Clear filters</Text>
              </TouchableOpacity>
            )}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[25, 50, 100].filter((r) => r > radiusKm).map((r) => (
                <TouchableOpacity key={r} style={styles.emptyCta} onPress={() => { setScope('nearby'); setNearbyKm(r); }}>
                  <Text style={styles.emptyCtaText}>Expand to {r} km</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => {
          if (item.kind === 'listing') {
            const hide = () => {
              Alert.alert('Hide this listing?', 'You won\'t see it in your feed again.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Hide', style: 'destructive',
                  onPress: () => {
                    setItems((prev) => prev.filter((x) => !(x.kind === 'listing' && x.id === item.id)));
                    Api.hideListing(item.id).catch(() => {});
                  },
                },
              ]);
            };
            return (
              <ListingCard
                item={item}
                onPress={() => nav.navigate('ListingDetail', { id: item.id })}
                onHide={hide}
              />
            );
          }
          return <ServiceCard item={item} />;
        }}
      />
      <TouchableOpacity style={styles.fab} onPress={() => nav.navigate('CreateListing')}>
        <Text style={styles.fabPlus}>+</Text>
      </TouchableOpacity>
      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        value={filters}
        onApply={setFilters}
      />
    </View>
  );
}

function ListingCard({ item, onPress, onHide }: { item: any; onPress: () => void; onHide?: () => void }) {
  const img = item.data.images?.[0];
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} onLongPress={onHide} delayLongPress={280}>
      {img ? <Image source={{ uri: img }} style={styles.thumb} /> : <View style={[styles.thumb, styles.thumbPh]}><Text>📦</Text></View>}
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text numberOfLines={1} style={styles.title}>{item.data.title}</Text>
        <Text style={styles.price}>₹{(item.data.priceInPaise / 100).toLocaleString('en-IN')}</Text>
        <Text style={styles.meta}>{item.distanceKm.toFixed(1)} km · {item.data.category}</Text>
        {item.data.seller && (
          <View style={{ marginTop: 6 }}>
            <TrustBadge score={item.data.seller.trustScore} />
          </View>
        )}
      </View>
      {onHide && (
        <TouchableOpacity style={styles.hideDot} onPress={onHide} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.hideDotText}>⋯</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function ServiceCard({ item }: { item: any }) {
  return (
    <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: theme.colors.accent }]}>
      <View style={[styles.thumb, styles.thumbPh]}><Text style={{ fontSize: 24 }}>🛠️</Text></View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text numberOfLines={1} style={styles.title}>{item.data.title}</Text>
        <Text style={styles.meta}>
          {item.data.priceFrom ? `From ₹${(item.data.priceFrom / 100).toLocaleString('en-IN')}` : 'Ask for price'}
        </Text>
        <Text style={styles.meta}>{item.distanceKm.toFixed(1)} km · {item.data.category}</Text>
        {item.data.provider && (
          <View style={{ marginTop: 6 }}>
            <TrustBadge score={item.data.provider.trustScore} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 64 },
  card: {
    flexDirection: 'row', backgroundColor: theme.colors.card, borderRadius: theme.radius.lg,
    padding: 12, marginBottom: 12, alignItems: 'center',
    ...theme.shadow.sm,
  },
  thumb: { width: 72, height: 72, borderRadius: theme.radius.md, backgroundColor: '#EEE' },
  thumbPh: { justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  price: { color: theme.colors.primary, fontWeight: '800', marginTop: 2 },
  meta: { color: theme.colors.textMuted, marginTop: 4, fontSize: 13 },
  fab: {
    position: 'absolute', right: 20, bottom: 28, width: 58, height: 58,
    borderRadius: 29, backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  fabPlus: { color: '#fff', fontSize: 30, fontWeight: '800', marginTop: -2 },
  iconBar: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingTop: 10, justifyContent: 'space-between' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 8, marginBottom: 4,
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg,
    paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: theme.colors.border,
  },
  controlsRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingLeft: 12, paddingTop: 6, paddingBottom: 2,
  },
  scopeChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
  },
  scopeChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  scopeChipText: { color: theme.colors.text, fontWeight: '700', fontSize: 13 },
  scopeChipTextActive: { color: '#fff' },
  sliderWrap: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4 },
  sliderLabel: { fontSize: 12, fontWeight: '800', color: theme.colors.primaryDark, letterSpacing: 0.6 },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchPh: { color: theme.colors.textMuted, fontSize: 15 },
  catRow: { paddingHorizontal: 12, paddingTop: 4, paddingBottom: 6, gap: 6 },
  catChip: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.pill,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.colors.card, marginRight: 6,
  },
  catChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  catChipText: { color: theme.colors.text, fontWeight: '600', fontSize: 13 },
  catChipTextActive: { color: '#fff' },
  bellBtn: {
    width: 44, height: 44, borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  badge: {
    position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: theme.colors.danger, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 5,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  trendTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.text, marginBottom: 8, marginLeft: 2 },
  trendCard: {
    width: 180, marginRight: 10, backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.sm,
  },
  trendImg: { width: '100%', height: 120, backgroundColor: '#EEE' },
  trendImgPh: { justifyContent: 'center', alignItems: 'center' },
  trendName: { fontWeight: '700', color: theme.colors.text, fontSize: 14 },
  trendPrice: { fontWeight: '900', color: theme.colors.primary, fontSize: 16, marginTop: 2 },
  trendMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 4 },
  radiusRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingLeft: 12, paddingVertical: 10,
  },
  radiusLabel: { fontSize: 12, fontWeight: '800', color: theme.colors.textMuted, marginRight: 10, letterSpacing: 0.6 },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: theme.radius.pill, backgroundColor: theme.colors.card,
    borderWidth: 1, borderColor: theme.colors.border, marginRight: 10,
  },
  filterBtnActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  filterBtnText: { color: theme.colors.text, fontWeight: '800', fontSize: 13 },
  saveBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft, borderWidth: 1, borderColor: theme.colors.primary,
    marginRight: 10,
  },
  saveBtnText: { color: theme.colors.primaryDark, fontWeight: '800', fontSize: 13 },
  savedRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingTop: 6 },
  savedLabel: { fontSize: 12, fontWeight: '800', color: theme.colors.textMuted, marginRight: 10, letterSpacing: 0.6 },
  savedChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingLeft: 12, paddingRight: 6, paddingVertical: 4, borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
    maxWidth: 220,
  },
  savedChipInner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  savedChipX: {
    width: 22, height: 22, borderRadius: 11, marginLeft: 6,
    backgroundColor: theme.colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: theme.colors.border,
  },
  savedChipXText: { color: theme.colors.textMuted, fontWeight: '900', marginTop: -2 },
  clearAllChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: theme.radius.pill,
    backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.danger,
    justifyContent: 'center',
  },
  clearAllText: { color: theme.colors.danger, fontWeight: '800', fontSize: 12 },
  savedChipText: { color: theme.colors.text, fontWeight: '700', fontSize: 12 },
  savedBadge: {
    backgroundColor: theme.colors.primary, borderRadius: 10,
    minWidth: 18, paddingHorizontal: 5, paddingVertical: 1, alignItems: 'center',
  },
  savedBadgeText: { color: '#fff', fontWeight: '800', fontSize: 10 },
  areaPill: {
    flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginTop: 10,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primarySoft, borderWidth: 1, borderColor: theme.colors.primary,
  },
  areaIcon: { fontSize: 20, marginRight: 10 },
  areaLabel: { fontSize: 10, fontWeight: '800', color: theme.colors.primaryDark, letterSpacing: 0.6 },
  areaName: { fontSize: 14, fontWeight: '800', color: theme.colors.text, marginTop: 1 },
  areaRefresh: { fontSize: 18, color: theme.colors.primary, fontWeight: '900', marginLeft: 10 },
  radiusChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
  },
  radiusChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  radiusChipText: { color: theme.colors.text, fontWeight: '700', fontSize: 13 },
  radiusChipTextActive: { color: '#fff' },
  emptyWrap: { alignItems: 'center', paddingTop: 64, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.text },
  emptySub: { fontSize: 13, color: theme.colors.textMuted, marginTop: 4, textAlign: 'center' },
  emptyCta: {
    backgroundColor: theme.colors.primarySoft, borderWidth: 1, borderColor: theme.colors.primary,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: theme.radius.pill,
  },
  emptyCtaText: { color: theme.colors.primaryDark, fontWeight: '800', fontSize: 13 },
  hideDot: {
    position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14,
    backgroundColor: theme.colors.surface, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: theme.colors.border,
  },
  hideDotText: { fontSize: 16, color: theme.colors.textMuted, fontWeight: '900', marginTop: -4 },
});
