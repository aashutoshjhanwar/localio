import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Modal,
  TextInput, ActivityIndicator, Alert, Pressable, Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Api } from '../api/client';
import { theme } from '../theme';
import { useAuth } from '../state/auth';

type StoryItem = { id: string; body: string; mediaUrl: string | null; createdAt: string; expiresAt: string; seen: boolean };
type StoryGroup = { user: { id: string; name: string; avatarUrl: string | null }; stories: StoryItem[]; hasUnseen: boolean; latestAt: string };

export function StoryBar({ lat, lng }: { lat: number; lng: number }) {
  const me = useAuth((s) => s.user);
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [viewerIdx, setViewerIdx] = useState<number | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  const load = useCallback(() => {
    if (!lat || !lng) return;
    Api.stories(lat, lng, 15).then((r) => setGroups(r.groups)).catch(() => {});
  }, [lat, lng]);

  useEffect(() => { load(); }, [load]);

  const myGroup = groups.find((g) => g.user.id === me?.id);
  const othersGroups = groups.filter((g) => g.user.id !== me?.id);

  async function pickImage() {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: true,
    });
    if (!r.canceled && r.assets?.[0]) {
      setImageUri(r.assets[0].uri);
      setImageBase64(r.assets[0].base64 ?? null);
    }
  }

  async function postStory() {
    const body = text.trim();
    if (!body && !imageBase64) return Alert.alert('Say something', 'Add a message or a photo.');
    setPosting(true);
    try {
      let mediaUrl: string | undefined;
      if (imageBase64) {
        const up = await Api.upload(`story-${Date.now()}.jpg`, 'image/jpeg', imageBase64);
        mediaUrl = up.url;
      }
      await Api.createStory({ body: body || ' ', mediaUrl, lat, lng });
      setText(''); setImageUri(null); setImageBase64(null);
      setComposerOpen(false);
      load();
    } catch (e: any) {
      Alert.alert('Could not post', e.message ?? 'try again');
    } finally { setPosting(false); }
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>📸 Neighborhood stories</Text>
        <Text style={styles.sectionSub}>last 24h</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 2, paddingBottom: 10 }}>
        <TouchableOpacity style={styles.item} onPress={() => setComposerOpen(true)} activeOpacity={0.85}>
          <View style={[styles.ring, styles.ringNew]}>
            {myGroup?.user?.avatarUrl ? (
              <Image source={{ uri: myGroup.user.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPh]}><Text style={{ fontSize: 26 }}>📷</Text></View>
            )}
            <View style={styles.plusBadge}><Text style={styles.plusBadgeText}>+</Text></View>
          </View>
          <Text style={[styles.name, styles.nameNew]} numberOfLines={1}>Your story</Text>
        </TouchableOpacity>

        {myGroup && (
          <TouchableOpacity
            style={styles.item}
            onPress={() => setViewerIdx(groups.findIndex((g) => g.user.id === me?.id))}
            activeOpacity={0.85}
          >
            <View style={[styles.ring, myGroup.hasUnseen ? styles.ringUnseen : styles.ringSeen]}>
              {myGroup.user.avatarUrl
                ? <Image source={{ uri: myGroup.user.avatarUrl }} style={styles.avatar} />
                : <View style={[styles.avatar, styles.avatarPh]}><Text style={{ fontSize: 22 }}>👤</Text></View>}
            </View>
            <Text style={styles.name} numberOfLines={1}>You</Text>
          </TouchableOpacity>
        )}

        {othersGroups.map((g) => (
          <TouchableOpacity
            key={g.user.id}
            style={styles.item}
            onPress={() => setViewerIdx(groups.findIndex((x) => x.user.id === g.user.id))}
            activeOpacity={0.85}
          >
            <View style={[styles.ring, g.hasUnseen ? styles.ringUnseen : styles.ringSeen]}>
              {g.user.avatarUrl
                ? <Image source={{ uri: g.user.avatarUrl }} style={styles.avatar} />
                : <View style={[styles.avatar, styles.avatarPh]}><Text style={{ fontSize: 22 }}>👤</Text></View>}
            </View>
            <Text style={styles.name} numberOfLines={1}>{g.user.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={composerOpen} animationType="slide" transparent onRequestClose={() => setComposerOpen(false)}>
        <View style={styles.composerBackdrop}>
          <View style={styles.composerSheet}>
            <Text style={styles.composerTitle}>Share a story · 24h</Text>
            <TextInput
              style={styles.composerInput}
              placeholder="What's happening in your neighborhood?"
              placeholderTextColor={theme.colors.textMuted}
              multiline
              value={text}
              onChangeText={setText}
              maxLength={500}
            />
            {imageUri && (
              <View style={{ marginTop: 10 }}>
                <Image source={{ uri: imageUri }} style={styles.previewImg} />
                <TouchableOpacity onPress={() => { setImageUri(null); setImageBase64(null); }} style={styles.removeImg}>
                  <Text style={{ color: '#fff', fontWeight: '800' }}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TouchableOpacity style={[styles.btn, styles.btnGhost, { flex: 1 }]} onPress={pickImage}>
                <Text style={[styles.btnText, { color: theme.colors.primary }]}>📷 Add photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btn, { flex: 1 }]} onPress={postStory} disabled={posting}>
                {posting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Post</Text>}
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={{ alignItems: 'center', marginTop: 10 }} onPress={() => setComposerOpen(false)}>
              <Text style={{ color: theme.colors.textMuted, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {viewerIdx !== null && groups[viewerIdx] && (
        <StoryViewer
          groups={groups}
          startIndex={viewerIdx}
          meId={me?.id}
          onClose={() => { setViewerIdx(null); load(); }}
          onDeleted={() => { setViewerIdx(null); load(); }}
        />
      )}
    </View>
  );
}

function StoryViewer({ groups, startIndex, meId, onClose, onDeleted }: {
  groups: StoryGroup[];
  startIndex: number;
  meId?: string;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [gi, setGi] = useState(startIndex);
  const [si, setSi] = useState(0);
  const viewedRef = useRef<Set<string>>(new Set());
  const group = groups[gi];
  const story = group?.stories[si];

  useEffect(() => {
    if (!story) return;
    if (viewedRef.current.has(story.id)) return;
    viewedRef.current.add(story.id);
    Api.viewStory(story.id).catch(() => {});
  }, [story]);

  function next() {
    if (!group) return;
    if (si < group.stories.length - 1) setSi(si + 1);
    else if (gi < groups.length - 1) { setGi(gi + 1); setSi(0); }
    else onClose();
  }
  function prev() {
    if (si > 0) setSi(si - 1);
    else if (gi > 0) { setGi(gi - 1); setSi(0); }
  }

  async function remove() {
    if (!story) return;
    Alert.alert('Delete story?', 'This removes it for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await Api.deleteStory(story.id); onDeleted(); }
        catch (e: any) { Alert.alert('Error', e.message ?? 'try again'); }
      } },
    ]);
  }

  if (!group || !story) return null;
  const isMine = group.user.id === meId;
  const w = Dimensions.get('window').width;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerRoot}>
        <View style={styles.progressRow}>
          {group.stories.map((_, i) => (
            <View key={i} style={[styles.progressSeg, i < si && styles.progressDone, i === si && styles.progressCurrent]} />
          ))}
        </View>
        <View style={styles.viewerHeader}>
          {group.user.avatarUrl
            ? <Image source={{ uri: group.user.avatarUrl }} style={styles.vAvatar} />
            : <View style={[styles.vAvatar, { backgroundColor: '#555', alignItems: 'center', justifyContent: 'center' }]}><Text style={{ fontSize: 16 }}>👤</Text></View>}
          <Text style={styles.vName}>{group.user.name}</Text>
          <Text style={styles.vTime}>{timeAgo(story.createdAt)}</Text>
          <View style={{ flex: 1 }} />
          {isMine && (
            <TouchableOpacity onPress={remove} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.vClose}>🗑</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginLeft: 16 }}>
            <Text style={styles.vClose}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flex: 1 }}>
          {story.mediaUrl ? (
            <Image source={{ uri: story.mediaUrl }} style={styles.storyImg} resizeMode="contain" />
          ) : (
            <View style={styles.storyTextWrap}>
              <Text style={styles.storyText}>{story.body}</Text>
            </View>
          )}
          {story.mediaUrl && story.body && story.body.trim() !== '' && (
            <View style={styles.captionBar}>
              <Text style={styles.caption}>{story.body}</Text>
            </View>
          )}
          <Pressable style={[styles.navLeft, { width: w / 3 }]} onPress={prev} />
          <Pressable style={[styles.navRight, { width: w * 2 / 3 }]} onPress={next} />
        </View>
      </View>
    </Modal>
  );
}

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: theme.colors.card, marginHorizontal: 12, marginTop: 10, marginBottom: 6,
    borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border,
    shadowColor: '#1C1A17', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
    paddingTop: 10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 4 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.text },
  sectionSub: { fontSize: 11, fontWeight: '700', color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  item: { alignItems: 'center', marginRight: 14, width: 72 },
  ring: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  ringUnseen: { borderColor: theme.colors.primary },
  ringSeen: { borderColor: theme.colors.borderStrong },
  ringNew: { borderColor: theme.colors.primary, borderStyle: 'dashed', backgroundColor: theme.colors.primarySoft },
  avatar: { width: 58, height: 58, borderRadius: 29 },
  avatarPh: { backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  plusBadge: {
    position: 'absolute', right: -2, bottom: -2,
    backgroundColor: theme.colors.primary, width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.colors.bg,
  },
  plusBadgeText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  name: { fontSize: 11, color: theme.colors.text, marginTop: 6, maxWidth: 70, fontWeight: '600', textAlign: 'center' },
  nameNew: { color: theme.colors.primary, fontWeight: '800' },

  composerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  composerSheet: {
    backgroundColor: theme.colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 18, paddingBottom: 34,
  },
  composerTitle: { fontSize: 16, fontWeight: '800', color: theme.colors.text, marginBottom: 10 },
  composerInput: {
    minHeight: 90, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    padding: 12, color: theme.colors.text, backgroundColor: theme.colors.surface, textAlignVertical: 'top',
  },
  previewImg: { width: '100%', height: 200, borderRadius: theme.radius.md },
  removeImg: {
    position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.6)',
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  btn: { backgroundColor: theme.colors.primary, padding: 12, borderRadius: theme.radius.md, alignItems: 'center' },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: theme.colors.primary },
  btnText: { color: '#fff', fontWeight: '800' },

  viewerRoot: { flex: 1, backgroundColor: '#000' },
  progressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 8, paddingTop: 48 },
  progressSeg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  progressDone: { backgroundColor: '#fff' },
  progressCurrent: { backgroundColor: '#fff' },
  viewerHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  vAvatar: { width: 34, height: 34, borderRadius: 17 },
  vName: { color: '#fff', fontWeight: '800', marginLeft: 10 },
  vTime: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginLeft: 8 },
  vClose: { color: '#fff', fontSize: 18, fontWeight: '700' },
  storyImg: { flex: 1, width: '100%' },
  storyTextWrap: { flex: 1, backgroundColor: theme.colors.primaryDark, alignItems: 'center', justifyContent: 'center', padding: 30 },
  storyText: { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center', lineHeight: 30 },
  captionBar: { position: 'absolute', bottom: 30, left: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 10 },
  caption: { color: '#fff', fontSize: 14 },
  navLeft: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  navRight: { position: 'absolute', right: 0, top: 0, bottom: 0 },
});
