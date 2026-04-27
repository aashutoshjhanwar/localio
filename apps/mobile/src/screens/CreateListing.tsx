import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Image, Alert, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { compressToBase64 } from '../utils/image';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Api } from '../api/client';
import { useLocation } from '../hooks/useLocation';
import { secureStorage } from '../state/secureStorage';
import { theme } from '../theme';
import { attrFields } from '../utils/listingAttributes';
import type { RootStackParamList } from '../nav/RootNav';

const DRAFT_KEY = 'localio.listingDraft';

type AttrMap = Record<string, string>;
type Draft = { title: string; desc: string; price: string; category: string; images: string[]; attributes?: AttrMap };

export function CreateListingScreen() {
  const { coords } = useLocation();
  const nav = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'CreateListing'>>();
  const dupeFromId = route.params?.dupeFromId;
  const [dupedFrom, setDupedFrom] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('other');
  const [cats, setCats] = useState<any[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const [attributes, setAttributes] = useState<AttrMap>({});
  const [saving, setSaving] = useState(false);
  const [priceHint, setPriceHint] = useState<{ p25: number; p50: number; p75: number; sampleSize: number } | null>(null);
  const [qualityReport, setQualityReport] = useState<any | null>(null);
  const [draftBanner, setDraftBanner] = useState<Draft | null>(null);
  const restoredRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!category || !coords.lat) { setPriceHint(null); return; }
    let cancelled = false;
    Api.priceHint(category, coords.lat, coords.lng).then((r) => { if (!cancelled) setPriceHint(r.hint); }).catch(() => {});
    return () => { cancelled = true; };
  }, [category, coords.lat, coords.lng]);

  // Live listing quality coach — debounced to avoid spamming the API while typing.
  useEffect(() => {
    if (!coords.lat || title.length < 2) { setQualityReport(null); return; }
    let cancelled = false;
    const h = setTimeout(() => {
      const priceNum = Number(price);
      Api.gradeListing({
        title, description: desc, category,
        priceInPaise: (isFinite(priceNum) ? priceNum : 0) * 100,
        images, attributes: attributes as any,
        lat: coords.lat, lng: coords.lng,
      }).then((r) => { if (!cancelled) setQualityReport(r.report); }).catch(() => {});
    }, 600);
    return () => { cancelled = true; clearTimeout(h); };
  }, [title, desc, price, category, images, attributes, coords.lat, coords.lng]);

  useEffect(() => {
    Api.categories().then((r) => setCats(r.listings)).catch(() => {});
    (async () => {
      if (dupeFromId) {
        try {
          const r = await Api.listing(dupeFromId);
          const l = r.listing;
          restoredRef.current = true;
          setTitle(l.title ?? '');
          setDesc(l.description ?? '');
          setPrice(String(Math.round((l.priceInPaise ?? 0) / 100)));
          if (l.category) setCategory(l.category);
          if (l.attributes && typeof l.attributes === 'object') {
            const attrs: AttrMap = {};
            for (const [k, v] of Object.entries(l.attributes)) attrs[k] = String(v);
            setAttributes(attrs);
          }
          setDupedFrom(l.title ?? '');
          return;
        } catch { /* fall through to draft restore */ }
      }
      const raw = await secureStorage.get(DRAFT_KEY);
      if (!raw) return;
      try {
        const d = JSON.parse(raw) as Draft;
        if (d.title || d.desc || d.price || d.images?.length) setDraftBanner(d);
      } catch {}
    })();
  }, [dupeFromId]);

  // Autosave — every 1.2s after a change, persist the current form state.
  useEffect(() => {
    if (!restoredRef.current && !title && !desc && !price && images.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const d: Draft = { title, desc, price, category, images, attributes };
      secureStorage.set(DRAFT_KEY, JSON.stringify(d)).catch(() => {});
    }, 1200);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [title, desc, price, category, images, attributes]);

  function restoreDraft() {
    if (!draftBanner) return;
    restoredRef.current = true;
    setTitle(draftBanner.title);
    setDesc(draftBanner.desc);
    setPrice(draftBanner.price);
    setCategory(draftBanner.category || 'other');
    setImages(draftBanner.images ?? []);
    setAttributes(draftBanner.attributes ?? {});
    setDraftBanner(null);
  }
  function discardDraft() {
    secureStorage.set(DRAFT_KEY, '').catch(() => {});
    setDraftBanner(null);
  }

  async function pick() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    try {
      const base64 = await compressToBase64(a.uri);
      const { url } = await Api.upload('photo.jpg', 'image/jpeg', base64);
      setImages((prev) => [...prev, url]);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'try again');
    }
  }

  async function submit() {
    if (title.length < 3) return Alert.alert('Title too short');
    if (desc.length < 5) return Alert.alert('Description too short');
    const priceNum = parseInt(price || '0', 10);
    if (!priceNum || priceNum < 0) return Alert.alert('Enter a valid price in rupees');

    try {
      setSaving(true);
      const cleanAttrs = Object.fromEntries(Object.entries(attributes).filter(([, v]) => v && String(v).trim()));
      const { listing } = await Api.createListing({
        title, description: desc, category,
        priceInPaise: priceNum * 100,
        lat: coords.lat, lng: coords.lng,
        images,
        ...(Object.keys(cleanAttrs).length ? { attributes: cleanAttrs } : {}),
      });
      secureStorage.set(DRAFT_KEY, '').catch(() => {});
      nav.replace('ListingDetail', { id: listing.id });
    } catch (e: any) {
      Alert.alert('Could not post', e.message ?? 'try again');
    } finally { setSaving(false); }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: 16 }}>
      {dupedFrom && (
        <View style={styles.dupeBanner}>
          <Text style={styles.dupeBannerTitle}>📋 Posting similar to "{dupedFrom}"</Text>
          <Text style={styles.dupeBannerSub}>Details were copied — add fresh photos and adjust anything that changed.</Text>
        </View>
      )}
      {draftBanner && (
        <View style={styles.draft}>
          <Text style={styles.draftTitle}>📝 You have an unsaved draft</Text>
          <Text style={styles.draftSub} numberOfLines={2}>
            {draftBanner.title || 'Untitled'} · {draftBanner.images.length} photo{draftBanner.images.length === 1 ? '' : 's'}
          </Text>
          <View style={styles.draftRow}>
            <TouchableOpacity style={[styles.draftBtn, styles.draftDiscard]} onPress={discardDraft}>
              <Text style={styles.draftDiscardText}>Discard</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.draftBtn, styles.draftRestore]} onPress={restoreDraft}>
              <Text style={styles.draftRestoreText}>Continue draft</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {qualityReport && (
        <View style={[styles.quality, qualityReport.grade === 'A' && styles.qualityA, qualityReport.grade === 'B' && styles.qualityB, (qualityReport.grade === 'C' || qualityReport.grade === 'D') && styles.qualityLow]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.qualityGrade}>{qualityReport.grade}</Text>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.qualityTitle}>Listing quality · {qualityReport.score}/100</Text>
              <Text style={styles.qualitySub}>
                {qualityReport.grade === 'A' ? 'Excellent — this will rank high.' :
                 qualityReport.grade === 'B' ? 'Good. A small fix would make it great.' :
                 'Fix the items below to get more chats.'}
              </Text>
            </View>
          </View>
          {qualityReport.issues.slice(0, 5).map((it: any, i: number) => (
            <View key={i} style={styles.issueRow}>
              <Text style={styles.issueIcon}>
                {it.severity === 'blocker' ? '🛑' : it.severity === 'warn' ? '⚠️' : '💡'}
              </Text>
              <Text style={styles.issueText}>{it.message}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.label}>Title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Sofa 3-seater" placeholderTextColor={theme.colors.textMuted} />

      <Text style={styles.label}>Price (₹)</Text>
      <TextInput style={styles.input} keyboardType="number-pad" value={price} onChangeText={setPrice} placeholder="0" placeholderTextColor={theme.colors.textMuted} />
      {priceHint && (() => {
        const rupees = (p: number) => `₹${Math.round(p / 100).toLocaleString('en-IN')}`;
        const priceNum = parseInt(price || '0', 10);
        const paise = priceNum * 100;
        const flag = priceNum > 0 && (paise < priceHint.p25 * 0.6 || paise > priceHint.p75 * 1.6);
        return (
          <View style={[styles.hint, flag && styles.hintWarn]}>
            <Text style={styles.hintTitle}>
              📊 Nearby {category}s sell for {rupees(priceHint.p25)}–{rupees(priceHint.p75)}
            </Text>
            <Text style={styles.hintSub}>
              Median {rupees(priceHint.p50)} · {priceHint.sampleSize} listings
              {flag ? ' · your price looks off' : ''}
            </Text>
          </View>
        );
      })()}

      <Text style={styles.label}>Category</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {cats.map((c) => (
          <TouchableOpacity
            key={c.key}
            onPress={() => setCategory(c.key)}
            style={[styles.chip, category === c.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, category === c.key && { color: '#fff' }]}>{c.icon} {c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {attrFields(category).length > 0 && (
        <View>
          <Text style={styles.label}>Details</Text>
          {attrFields(category).map((f) => {
            const val = attributes[f.key] ?? '';
            if (f.type === 'choice') {
              return (
                <View key={f.key} style={{ marginBottom: 10 }}>
                  <Text style={styles.attrLabel}>{f.label}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {f.options.map((opt) => (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.attrChip, val === opt && styles.attrChipActive]}
                        onPress={() => setAttributes((a) => ({ ...a, [f.key]: val === opt ? '' : opt }))}
                      >
                        <Text style={[styles.attrChipText, val === opt && { color: '#fff' }]}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              );
            }
            return (
              <View key={f.key} style={{ marginBottom: 10 }}>
                <Text style={styles.attrLabel}>{f.label}{f.type === 'number' && f.suffix ? ` (${f.suffix})` : ''}</Text>
                <TextInput
                  style={styles.input}
                  value={val}
                  onChangeText={(v) => setAttributes((a) => ({ ...a, [f.key]: v }))}
                  placeholder={f.placeholder ?? ''}
                  placeholderTextColor={theme.colors.textMuted}
                  keyboardType={f.type === 'number' ? 'number-pad' : 'default'}
                />
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.label}>Description</Text>
      <TextInput
        style={[styles.input, { minHeight: 100, textAlignVertical: 'top' }]}
        multiline value={desc} onChangeText={setDesc}
        placeholder="Condition, reason for sale, pickup preferences…"
        placeholderTextColor={theme.colors.textMuted}
      />

      <Text style={styles.label}>Photos</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {images.map((u) => (
          <View key={u} style={styles.imgWrap}>
            <Image source={{ uri: u }} style={styles.img} />
            <TouchableOpacity style={styles.imgRm} onPress={() => setImages((p) => p.filter((x) => x !== u))}>
              <Text style={styles.imgRmText}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
        {images.length < 6 && (
          <TouchableOpacity onPress={pick} style={[styles.img, styles.imgAdd]}>
            <Text style={{ fontSize: 28, color: theme.colors.textMuted }}>+</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={styles.btn} onPress={submit} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Post listing</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: '700', color: theme.colors.text, marginTop: 14, marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg,
    padding: 14, backgroundColor: theme.colors.card, color: theme.colors.text, fontSize: 16,
    ...theme.shadow.sm,
  },
  chip: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.pill,
    paddingHorizontal: 14, paddingVertical: 9, marginRight: 8, backgroundColor: theme.colors.card,
  },
  chipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  chipText: { color: theme.colors.text, fontWeight: '600' },
  imgWrap: { position: 'relative', marginRight: 8, marginBottom: 8 },
  img: { width: 80, height: 80, borderRadius: theme.radius.lg, backgroundColor: '#EEE' },
  imgAdd: { justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: theme.colors.border, borderStyle: 'dashed', backgroundColor: theme.colors.surface },
  imgRm: {
    position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11,
    backgroundColor: theme.colors.danger, justifyContent: 'center', alignItems: 'center',
  },
  imgRmText: { color: '#fff', fontWeight: '900', marginTop: -2 },
  btn: {
    backgroundColor: theme.colors.primary, padding: 16, borderRadius: theme.radius.lg,
    alignItems: 'center', marginTop: 24, ...theme.shadow.md,
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  draft: {
    backgroundColor: theme.colors.primarySoft, borderRadius: theme.radius.lg,
    padding: 14, marginBottom: 4, borderWidth: 1, borderColor: theme.colors.primary,
  },
  draftTitle: { fontWeight: '800', color: theme.colors.primaryDark, fontSize: 15 },
  draftSub: { color: theme.colors.text, marginTop: 4 },
  draftRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  dupeBanner: {
    backgroundColor: theme.colors.primarySoft, borderRadius: theme.radius.md,
    padding: 12, marginBottom: 12,
    borderWidth: 1, borderColor: theme.colors.primary,
  },
  dupeBannerTitle: { fontWeight: '800', color: theme.colors.primaryDark, fontSize: 14 },
  dupeBannerSub: { color: theme.colors.text, marginTop: 4, fontSize: 12, lineHeight: 16 },
  draftBtn: { flex: 1, paddingVertical: 10, borderRadius: theme.radius.md, alignItems: 'center' },
  draftDiscard: { backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border },
  draftDiscardText: { color: theme.colors.textMuted, fontWeight: '700' },
  draftRestore: { backgroundColor: theme.colors.primary },
  draftRestoreText: { color: '#fff', fontWeight: '800' },
  hint: {
    marginTop: 8, backgroundColor: theme.colors.primarySoft, borderRadius: theme.radius.md,
    padding: 10, borderWidth: 1, borderColor: theme.colors.primary,
  },
  hintWarn: {
    backgroundColor: (theme.colors as any).warningSoft ?? '#FFF4E5',
    borderColor: theme.colors.accent ?? '#F5A623',
  },
  hintTitle: { fontWeight: '800', color: theme.colors.primaryDark, fontSize: 13 },
  quality: { marginTop: 12, marginBottom: 4, padding: 12, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.card },
  qualityA: { borderColor: '#16A34A', backgroundColor: '#DCFCE7' },
  qualityB: { borderColor: '#D97706', backgroundColor: '#FEF3C7' },
  qualityLow: { borderColor: '#DC2626', backgroundColor: '#FEE2E2' },
  qualityGrade: { fontSize: 38, fontWeight: '900', color: theme.colors.text, minWidth: 42, textAlign: 'center' },
  qualityTitle: { fontWeight: '800', color: theme.colors.text, fontSize: 14 },
  qualitySub: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  issueRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 6, gap: 6 },
  issueIcon: { fontSize: 14, width: 18 },
  issueText: { flex: 1, color: theme.colors.text, fontSize: 13, lineHeight: 18 },
  hintSub: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  attrLabel: { color: theme.colors.textMuted, fontSize: 12, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase' },
  attrChip: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.pill,
    paddingHorizontal: 12, paddingVertical: 7, marginRight: 6, backgroundColor: theme.colors.card,
  },
  attrChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  attrChipText: { color: theme.colors.text, fontWeight: '600', fontSize: 13 },
});
