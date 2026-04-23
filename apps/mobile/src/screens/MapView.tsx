import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Api } from '../api/client';
import { useLocation } from '../hooks/useLocation';
import { theme } from '../theme';

type Kind = 'listing' | 'service' | 'event';
type Pin = {
  id: string;
  kind: Kind;
  title: string;
  lat: number;
  lng: number;
  distanceKm?: number;
  priceInPaise?: number;
};

type KindFilter = 'all' | Kind;
const RADII = [2, 5, 10, 25] as const;
type Radius = typeof RADII[number];

export function MapViewScreen() {
  const { coords } = useLocation();
  const nav = useNavigation<any>();
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<KindFilter>('all');
  const [radius, setRadius] = useState<Radius>(10);

  useEffect(() => {
    let live = true;
    setLoading(true);
    (async () => {
      try {
        const [feed, events] = await Promise.all([
          Api.feed(coords.lat, coords.lng, radius),
          Api.events(coords.lat, coords.lng, radius),
        ]);
        if (!live) return;
        const fromFeed: Pin[] = feed.feed.map((i: any) => ({
          id: i.id,
          kind: i.kind,
          title: i.data.title,
          lat: i.data.lat,
          lng: i.data.lng,
          distanceKm: i.distanceKm,
          priceInPaise: i.data.priceInPaise,
        }));
        const fromEvents: Pin[] = events.events.map((e: any) => ({
          id: e.id,
          kind: 'event' as const,
          title: e.title,
          lat: e.lat,
          lng: e.lng,
          distanceKm: e.distanceKm,
        }));
        setPins([...fromFeed, ...fromEvents]);
      } catch { /* noop */ }
      finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [coords.lat, coords.lng, radius]);

  const filtered = useMemo(
    () => (kind === 'all' ? pins : pins.filter((p) => p.kind === kind)),
    [pins, kind],
  );

  const counts = useMemo(() => ({
    all: pins.length,
    listing: pins.filter((p) => p.kind === 'listing').length,
    service: pins.filter((p) => p.kind === 'service').length,
    event: pins.filter((p) => p.kind === 'event').length,
  }), [pins]);

  const html = useMemo(
    () => buildLeafletHtml(coords.lat, coords.lng, filtered, radius),
    [coords.lat, coords.lng, filtered, radius],
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={styles.controls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip label={`All · ${counts.all}`} active={kind === 'all'} onPress={() => setKind('all')} />
          <Chip label={`📦 Sell · ${counts.listing}`} active={kind === 'listing'} onPress={() => setKind('listing')} />
          <Chip label={`🛠 Services · ${counts.service}`} active={kind === 'service'} onPress={() => setKind('service')} />
          <Chip label={`📅 Events · ${counts.event}`} active={kind === 'event'} onPress={() => setKind('event')} />
        </ScrollView>
        <View style={styles.chipRow}>
          {RADII.map((r) => (
            <Chip key={r} label={`${r} km`} active={radius === r} onPress={() => setRadius(r)} small />
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>
      ) : Platform.OS === 'web' ? (
        // @ts-ignore — iframe is a DOM element only on web
        <iframe
          key={`${coords.lat}-${coords.lng}-${radius}-${kind}`}
          srcDoc={html}
          style={{ border: 0, flex: 1, width: '100%', height: '100%' }}
          title="LOCALIO map"
        />
      ) : (
        <NativeList pins={filtered} nav={nav} />
      )}
    </View>
  );
}

function NativeList({ pins, nav }: { pins: Pin[]; nav: any }) {
  const sorted = [...pins].sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
  if (sorted.length === 0) {
    return (
      <View style={[styles.center, { padding: 24 }]}>
        <Text style={{ fontSize: 40 }}>🗺</Text>
        <Text style={styles.emptyTitle}>Nothing here yet</Text>
        <Text style={styles.emptyHint}>Try widening the radius or switching category.</Text>
      </View>
    );
  }
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.note}>
        🗺 Map preview (native map coming soon). {sorted.length} nearby — tap to open.
      </Text>
      {sorted.map((p) => (
        <TouchableOpacity
          key={`${p.kind}:${p.id}`}
          style={styles.row}
          onPress={() => {
            if (p.kind === 'listing') nav.navigate('ListingDetail', { id: p.id });
            else if (p.kind === 'service') nav.navigate('ServiceDetail', { id: p.id });
            else nav.navigate('EventDetail', { id: p.id });
          }}
        >
          <Text style={styles.icon}>{iconFor(p.kind)}</Text>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text numberOfLines={1} style={styles.title}>{p.title}</Text>
            <Text style={styles.meta}>
              {p.kind}{p.priceInPaise != null ? ` · ₹${(p.priceInPaise / 100).toLocaleString('en-IN')}` : ''}
              {p.distanceKm != null ? ` · ${p.distanceKm.toFixed(1)} km` : ''}
            </Text>
          </View>
          <Text style={{ color: theme.colors.textMuted }}>›</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function Chip({ label, active, onPress, small }: { label: string; active: boolean; onPress: () => void; small?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive, small && styles.chipSmall]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive, small && { fontSize: 12 }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function iconFor(k: Kind) {
  if (k === 'listing') return '📦';
  if (k === 'service') return '🛠';
  return '📅';
}

function buildLeafletHtml(lat: number, lng: number, pins: Pin[], radiusKm: number): string {
  const markers = pins
    .filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number')
    .map((p) => ({
      lat: p.lat, lng: p.lng,
      title: p.title.replace(/"/g, '\\"').replace(/</g, '&lt;'),
      emoji: p.kind === 'listing' ? '📦' : p.kind === 'service' ? '🛠' : '📅',
      price: p.priceInPaise != null ? `₹${(p.priceInPaise / 100).toLocaleString('en-IN')}` : '',
      dist: p.distanceKm != null ? `${p.distanceKm.toFixed(1)} km` : '',
    }));
  const zoom = radiusKm <= 2 ? 15 : radiusKm <= 5 ? 14 : radiusKm <= 10 ? 13 : 12;
  return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
 html,body,#map{margin:0;padding:0;height:100%;width:100%;}
 .pin{font-size:22px;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4));}
 .me{font-size:26px;}
 .pop-title{font-weight:700;font-size:13px;margin-bottom:2px;}
 .pop-meta{font-size:11px;color:#666;}
 .pop-price{font-weight:800;color:#d97706;font-size:13px;margin-top:2px;}
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map').setView([${lat}, ${lng}], ${zoom});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap'
  }).addTo(map);
  var meIcon = L.divIcon({ html: '<div class="pin me">📍</div>', className: '', iconSize: [32,32] });
  L.marker([${lat}, ${lng}], { icon: meIcon }).addTo(map).bindPopup('<b>You are here</b>');
  L.circle([${lat}, ${lng}], { radius: ${radiusKm * 1000}, color: '#d97706', weight: 1, opacity: 0.5, fillOpacity: 0.06 }).addTo(map);
  var data = ${JSON.stringify(markers)};
  data.forEach(function(p){
    var icon = L.divIcon({ html: '<div class="pin">' + p.emoji + '</div>', className: '', iconSize: [28,28] });
    var html = '<div class="pop-title">' + p.title + '</div>'
      + (p.price ? '<div class="pop-price">' + p.price + '</div>' : '')
      + (p.dist ? '<div class="pop-meta">' + p.dist + ' away</div>' : '');
    L.marker([p.lat, p.lng], { icon: icon }).addTo(map).bindPopup(html);
  });
</script>
</body></html>`;
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  controls: {
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8,
    backgroundColor: theme.colors.bg, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    gap: 8,
  },
  chipRow: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
  },
  chipSmall: { paddingHorizontal: 10, paddingVertical: 5 },
  chipActive: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary },
  chipText: { fontSize: 13, fontWeight: '700', color: theme.colors.textMuted },
  chipTextActive: { color: theme.colors.primaryDark },
  note: { color: theme.colors.textMuted, marginBottom: 12, fontSize: 13 },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.card, borderRadius: theme.radius.md, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: theme.colors.border,
    shadowColor: '#1C1A17', shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  icon: { fontSize: 24 },
  title: { color: theme.colors.text, fontWeight: '700' },
  meta: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2, textTransform: 'capitalize' },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.text, marginTop: 10 },
  emptyHint: { color: theme.colors.textMuted, textAlign: 'center', fontSize: 13, marginTop: 4 },
});
