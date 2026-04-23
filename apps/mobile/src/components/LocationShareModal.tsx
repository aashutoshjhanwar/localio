import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView, Linking } from 'react-native';
import * as Location from 'expo-location';
import { Api } from '../api/client';
import { theme } from '../theme';

type Coords = { lat: number; lng: number; accuracyM?: number };

export type MeetupSpot = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  kind: string;
  distanceKm: number;
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onSendCurrent: (coords: Coords) => void;
  onStartLive: (coords: Coords, durationMin: number) => void;
  onSendMeetup: (spot: MeetupSpot) => void;
}

const LIVE_OPTIONS = [15, 30, 60];

const KIND_ICON: Record<string, string> = {
  police: '🚓', mall: '🏬', metro: '🚇', park: '🌳', cafe: '☕', public: '📍',
};

export function LocationShareModal({ visible, onClose, onSendCurrent, onStartLive, onSendMeetup }: Props) {
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'menu' | 'spots'>('menu');
  const [spots, setSpots] = useState<MeetupSpot[] | null>(null);
  const [spotError, setSpotError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setMode('menu');
      setSpots(null);
      setSpotError(null);
    }
  }, [visible]);

  async function fetchCoords(): Promise<Coords | null> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow location access to share your location.');
      return null;
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: loc.coords.latitude, lng: loc.coords.longitude, accuracyM: loc.coords.accuracy ?? undefined };
  }

  async function sendCurrent() {
    if (busy) return;
    setBusy(true);
    try {
      const c = await fetchCoords();
      if (c) onSendCurrent(c);
    } catch { Alert.alert('Could not get your location'); }
    finally { setBusy(false); }
  }

  async function startLive(durationMin: number) {
    if (busy) return;
    setBusy(true);
    try {
      const c = await fetchCoords();
      if (c) onStartLive(c, durationMin);
    } catch { Alert.alert('Could not get your location'); }
    finally { setBusy(false); }
  }

  async function openSpots() {
    setMode('spots');
    setSpots(null);
    setSpotError(null);
    try {
      const c = await fetchCoords();
      if (!c) { setMode('menu'); return; }
      const r = await Api.meetupSpots(c.lat, c.lng, 15);
      setSpots(r.spots);
    } catch (e: any) {
      setSpotError(e?.message ?? 'Could not load safe spots');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {mode === 'spots' ? '🛡 Safe meetup spots' : '📍 Share your location'}
            </Text>
            <TouchableOpacity onPress={mode === 'spots' ? () => setMode('menu') : onClose}>
              <Text style={styles.close}>{mode === 'spots' ? '‹' : '✕'}</Text>
            </TouchableOpacity>
          </View>

          {mode === 'menu' ? (
            <>
              <Text style={styles.sub}>Pick a way to share so the other person can find you.</Text>

              <TouchableOpacity style={styles.primaryBtn} onPress={sendCurrent} disabled={busy}>
                {busy ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.primaryText}>📌 Send current location</Text>
                    <Text style={styles.primarySub}>One-time snapshot</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.secondaryBtn} onPress={openSpots} disabled={busy}>
                <Text style={styles.secondaryText}>🛡 Pick a safe meetup spot</Text>
                <Text style={styles.secondarySub}>Police, metro, mall, park — public places nearby</Text>
              </TouchableOpacity>

              <Text style={styles.liveLabel}>🟢 Or share live for…</Text>
              <View style={styles.liveRow}>
                {LIVE_OPTIONS.map((m) => (
                  <TouchableOpacity key={m} style={styles.liveChip} onPress={() => startLive(m)} disabled={busy}>
                    <Text style={styles.liveChipText}>{m} min</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.note}>Updates automatically until the time's up — you can stop it anytime.</Text>
            </>
          ) : (
            <View style={{ minHeight: 260 }}>
              {spots === null && !spotError ? (
                <View style={styles.spotsCenter}><ActivityIndicator color={theme.colors.primary} /></View>
              ) : spotError ? (
                <Text style={styles.errText}>{spotError}</Text>
              ) : spots && spots.length === 0 ? (
                <View style={styles.spotsCenter}>
                  <Text style={{ fontSize: 40 }}>🗺</Text>
                  <Text style={styles.emptyTitle}>No safe spots listed nearby</Text>
                  <Text style={styles.emptyHint}>Meet at a well-lit public place like a metro gate or mall food court.</Text>
                </View>
              ) : (
                <ScrollView style={{ maxHeight: 380 }}>
                  {spots!.map((s) => (
                    <View key={s.id} style={styles.spotRow}>
                      <Text style={styles.spotIcon}>{KIND_ICON[s.kind] ?? '📍'}</Text>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.spotName} numberOfLines={1}>{s.name}</Text>
                        <Text style={styles.spotAddr} numberOfLines={2}>{s.address}</Text>
                        <Text style={styles.spotMeta}>{s.distanceKm.toFixed(1)} km · {s.kind}</Text>
                      </View>
                      <View style={{ gap: 6 }}>
                        <TouchableOpacity
                          style={styles.spotSendBtn}
                          onPress={() => onSendMeetup(s)}
                        >
                          <Text style={styles.spotSendText}>Send</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.spotMapBtn}
                          onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`)}
                        >
                          <Text style={styles.spotMapText}>Map ↗</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 34,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '800', color: theme.colors.text },
  close: { fontSize: 22, color: theme.colors.textMuted, padding: 6, minWidth: 28, textAlign: 'center' },
  sub: { fontSize: 13, color: theme.colors.textMuted, marginTop: 2, marginBottom: 16 },
  primaryBtn: {
    backgroundColor: theme.colors.primary, borderRadius: theme.radius.lg,
    paddingVertical: 16, alignItems: 'center', ...theme.shadow.md,
  },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  primarySub: { color: '#FFDFD4', fontSize: 12, marginTop: 2 },
  secondaryBtn: {
    marginTop: 10, backgroundColor: theme.colors.primarySoft,
    borderRadius: theme.radius.lg, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: theme.colors.primary,
  },
  secondaryText: { color: theme.colors.primaryDark, fontWeight: '800', fontSize: 15 },
  secondarySub: { color: theme.colors.primaryDark, opacity: 0.7, fontSize: 11, marginTop: 2 },
  liveLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.text, marginTop: 20, marginBottom: 8 },
  liveRow: { flexDirection: 'row', gap: 10 },
  liveChip: {
    flex: 1, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.pill, paddingVertical: 12, alignItems: 'center', ...theme.shadow.sm,
  },
  liveChipText: { color: theme.colors.text, fontWeight: '800' },
  note: { fontSize: 11, color: theme.colors.textMuted, marginTop: 12 },
  spotsCenter: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  errText: { color: theme.colors.danger, padding: 20, textAlign: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.text, marginTop: 8 },
  emptyHint: { color: theme.colors.textMuted, textAlign: 'center', fontSize: 12, lineHeight: 17, marginTop: 4 },
  spotRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.card, borderRadius: theme.radius.md,
    padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: theme.colors.border, ...theme.shadow.sm,
  },
  spotIcon: { fontSize: 26 },
  spotName: { fontSize: 14, fontWeight: '800', color: theme.colors.text },
  spotAddr: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2, lineHeight: 16 },
  spotMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 3, textTransform: 'capitalize' },
  spotSendBtn: {
    backgroundColor: theme.colors.primary, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: theme.radius.pill,
  },
  spotSendText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  spotMapBtn: {
    borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: theme.radius.pill, alignItems: 'center',
  },
  spotMapText: { color: theme.colors.textMuted, fontSize: 11, fontWeight: '700' },
});
