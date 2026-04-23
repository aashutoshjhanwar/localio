import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Api } from '../api/client';
import { theme } from '../theme';
import type { RootStackParamList } from '../nav/RootNav';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const MAX_COMPARE = 4;

export function FavoritesScreen() {
  const [tab, setTab] = useState<'listings' | 'services'>('listings');
  const [items, setItems] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const nav = useNavigation<Nav>();

  const load = useCallback(async () => {
    try {
      const [{ favorites }, sres] = await Promise.all([
        Api.favorites(),
        Api.favoriteServices(),
      ]);
      setItems(favorites);
      setServices(sres.favorites);
    } catch { /* noop */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        if (next.size >= MAX_COMPARE) {
          Alert.alert('Limit reached', `Compare up to ${MAX_COMPARE} listings at once.`);
          return prev;
        }
        next.add(id);
      }
      return next;
    });
  }

  function exitSelect() {
    setSelectMode(false);
    setSelected(new Set());
  }

  function openCompare() {
    if (selected.size < 2) return Alert.alert('Pick at least 2', 'Select 2 to 4 listings to compare.');
    nav.navigate('CompareListings', { ids: Array.from(selected) });
    exitSelect();
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;

  const data = tab === 'listings' ? items : services;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === 'listings' && styles.tabOn]} onPress={() => { setTab('listings'); exitSelect(); }}>
          <Text style={[styles.tabText, tab === 'listings' && styles.tabTextOn]}>Listings ({items.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === 'services' && styles.tabOn]} onPress={() => { setTab('services'); exitSelect(); }}>
          <Text style={[styles.tabText, tab === 'services' && styles.tabTextOn]}>Services ({services.length})</Text>
        </TouchableOpacity>
      </View>
      {tab === 'listings' && items.length > 1 && (
        <View style={styles.toolbar}>
          {!selectMode ? (
            <TouchableOpacity style={styles.toolbarBtn} onPress={() => setSelectMode(true)}>
              <Text style={styles.toolbarBtnText}>⇄ Compare</Text>
            </TouchableOpacity>
          ) : (
            <>
              <Text style={styles.toolbarHint}>Selected {selected.size}/{MAX_COMPARE}</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity style={[styles.toolbarBtn, styles.toolbarGhost]} onPress={exitSelect}>
                  <Text style={[styles.toolbarBtnText, { color: theme.colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.toolbarBtn} onPress={openCompare}>
                  <Text style={styles.toolbarBtnText}>Compare →</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}
      <FlatList
        data={data}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.colors.primary} />}
        ListEmptyComponent={<Text style={styles.empty}>{tab === 'listings' ? 'Tap ♥ on any listing to save it here.' : 'Tap ♡ Save on any service to save it here.'}</Text>}
        renderItem={({ item }) => {
          if (tab === 'services') {
            return (
              <TouchableOpacity style={styles.card} onPress={() => nav.navigate('ServiceDetail', { id: item.id })}>
                <View style={[styles.thumb, styles.thumbPh]}><Text style={{ fontSize: 28 }}>🛠️</Text></View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.price}>
                    {item.priceFrom ? `From ₹${(item.priceFrom / 100).toLocaleString('en-IN')}` : 'Ask for price'}
                  </Text>
                  <Text style={styles.meta}>
                    {item.category}
                    {item.ratingAvg ? ` · ⭐ ${item.ratingAvg.toFixed(1)}` : ''}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }
          const isSelected = selected.has(item.id);
          return (
            <TouchableOpacity
              style={[styles.card, isSelected && styles.cardSelected]}
              onLongPress={() => { if (!selectMode) { setSelectMode(true); toggleSelect(item.id); } }}
              onPress={() => {
                if (selectMode) toggleSelect(item.id);
                else nav.navigate('ListingDetail', { id: item.id });
              }}
            >
              {selectMode && (
                <View style={[styles.check, isSelected && styles.checkOn]}>
                  <Text style={{ color: '#fff', fontWeight: '900' }}>{isSelected ? '✓' : ''}</Text>
                </View>
              )}
              {item.images?.[0] ? (
                <Image source={{ uri: item.images[0] }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPh]}><Text>📦</Text></View>
              )}
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.price}>₹{(item.priceInPaise / 100).toLocaleString('en-IN')}</Text>
                <Text style={styles.meta}>{item.category}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { color: theme.colors.textMuted, textAlign: 'center', marginTop: 60 },
  tabs: {
    flexDirection: 'row', paddingHorizontal: 12, paddingTop: 10, gap: 8,
  },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    alignItems: 'center',
  },
  tabOn: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  tabText: { color: theme.colors.textMuted, fontWeight: '700', fontSize: 13 },
  tabTextOn: { color: theme.colors.primary },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border,
  },
  toolbarBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primary,
  },
  toolbarGhost: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  toolbarBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  toolbarHint: { color: theme.colors.textMuted, fontWeight: '700', fontSize: 13 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg, padding: 12, marginBottom: 10,
    borderWidth: 1, borderColor: 'transparent',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  cardSelected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primarySoft },
  check: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  checkOn: { backgroundColor: theme.colors.primary },
  thumb: { width: 72, height: 72, borderRadius: theme.radius.md, backgroundColor: '#EEE' },
  thumbPh: { justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700', color: theme.colors.text },
  price: { color: theme.colors.primary, fontWeight: '800', marginTop: 2 },
  meta: { color: theme.colors.textMuted, marginTop: 4, fontSize: 13 },
});
