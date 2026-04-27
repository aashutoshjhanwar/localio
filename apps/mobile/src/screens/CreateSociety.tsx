import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import { Api } from '../api/client';
import { useLocationOverride } from '../state/location';
import { theme } from '../theme';

export function CreateSocietyScreen() {
  const nav = useNavigation<any>();
  const { setOverride } = useLocationOverride();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [pincode, setPincode] = useState('');
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') { setLocating(false); return; }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        const places = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude }).catch(() => []);
        const p = places[0] as any;
        if (p) {
          if (!city) setCity(p.city ?? p.region ?? '');
          if (!pincode) setPincode(p.postalCode ?? '');
          if (!address) setAddress([p.subLocality ?? p.district, p.street].filter(Boolean).join(', '));
        }
      } finally { setLocating(false); }
    })();
  }, []);

  async function refreshLocation() {
    setLocating(true);
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch { /* noop */ } finally { setLocating(false); }
  }

  async function save() {
    if (!coords) return Alert.alert('Location needed', 'Allow location access — society needs accurate coordinates so neighbors find it.');
    if (name.trim().length < 2) return Alert.alert('Name required');
    if (city.trim().length < 2) return Alert.alert('City required');
    if (!/^[0-9]{4,10}$/.test(pincode.trim())) return Alert.alert('Valid pincode required');

    setSaving(true);
    try {
      const r = await Api.createSociety({
        name: name.trim(), city: city.trim(), pincode: pincode.trim(),
        address: address.trim() || undefined,
        lat: coords.lat, lng: coords.lng,
      });
      // Pin app-wide location to the new society right away.
      await setOverride({
        label: `${r.society.name}, ${r.society.city}`,
        lat: r.society.lat, lng: r.society.lng,
        societyId: r.society.id, pincode: r.society.pincode,
      });
      Alert.alert(
        r.duplicate ? 'Joined existing society' : '🎉 Society created',
        r.duplicate
          ? 'A society with the same name already exists at this address. We added you to it.'
          : `You're the OWNER of "${r.society.name}". Manage members from the Group screen.`,
        [{ text: 'OK', onPress: () => nav.navigate('GroupDetail', { id: r.groupId, title: r.society.name }) }],
      );
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Failed to create');
    } finally { setSaving(false); }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: theme.spacing(4) }}>
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>🏘️ Create your society</Text>
        <Text style={styles.bannerBody}>
          You'll automatically become the OWNER and can manage members, channels, announcements and SOS.
          No platform admin needed.
        </Text>
      </View>

      <Label>Society name</Label>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. DLF Phase 2 RWA" placeholderTextColor={theme.colors.textMuted} />

      <Label>City</Label>
      <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="e.g. Gurgaon" placeholderTextColor={theme.colors.textMuted} />

      <Label>Pincode</Label>
      <TextInput style={styles.input} value={pincode} onChangeText={setPincode} keyboardType="number-pad" maxLength={10} placeholder="e.g. 122002" placeholderTextColor={theme.colors.textMuted} />

      <Label>Address (optional)</Label>
      <TextInput
        style={[styles.input, { minHeight: 70, textAlignVertical: 'top' }]}
        value={address} onChangeText={setAddress} multiline
        placeholder="Block / street / landmark"
        placeholderTextColor={theme.colors.textMuted}
      />

      <Label>Location pin</Label>
      <View style={styles.locBox}>
        {locating ? (
          <ActivityIndicator color={theme.colors.primary} />
        ) : coords ? (
          <Text style={styles.locText}>📍 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</Text>
        ) : (
          <Text style={[styles.locText, { color: theme.colors.danger }]}>Location not detected</Text>
        )}
        <TouchableOpacity onPress={refreshLocation}>
          <Text style={styles.locBtn}>Refresh</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.help}>Stand inside or near the society gate when tapping refresh — accurate coordinates help neighbors find it.</Text>

      <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Create society</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  banner: { backgroundColor: theme.colors.primarySoft, padding: theme.spacing(3), borderRadius: theme.radius.md, marginBottom: theme.spacing(4) },
  bannerTitle: { fontWeight: '800', color: theme.colors.primaryDark, fontSize: theme.font.size.md },
  bannerBody: { color: theme.colors.text, marginTop: 4, lineHeight: 20 },
  label: { fontWeight: '700', color: theme.colors.text, marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: theme.spacing(3), backgroundColor: theme.colors.card, color: theme.colors.text, fontSize: 15 },
  locBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: theme.spacing(3), borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, backgroundColor: theme.colors.card },
  locText: { color: theme.colors.text, fontWeight: '600' },
  locBtn: { color: theme.colors.primary, fontWeight: '800' },
  help: { color: theme.colors.textMuted, fontSize: 12, marginTop: 6, lineHeight: 17 },
  saveBtn: { backgroundColor: theme.colors.primary, padding: theme.spacing(4), borderRadius: theme.radius.md, alignItems: 'center', marginTop: theme.spacing(5) },
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: theme.font.size.md },
});
