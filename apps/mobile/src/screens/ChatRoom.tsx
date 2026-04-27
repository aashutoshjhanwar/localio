import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Modal, Alert, Image, Linking, ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Location from 'expo-location';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { TrustBadge } from '../components/TrustBadge';
import { Api } from '../api/client';
import { getSocket } from '../api/socket';
import { useAuth } from '../state/auth';
import { theme } from '../theme';
import { OfferCard } from '../components/OfferCard';
import { LocationShareModal } from '../components/LocationShareModal';
import { RatingModal } from '../components/RatingModal';
import { ScamShieldBanner } from '../components/ScamShieldBanner';
import { loadCachedMessages, saveCachedMessages } from '../api/chatCache';
import type { RootStackParamList } from '../nav/RootNav';

type R = RouteProp<RootStackParamList, 'ChatRoom'>;

const QUICK_REPLIES = [
  'Hi! Is it still available?',
  'Can you come down on the price?',
  'When can we meet?',
  'Where are you located?',
  'Can you share more photos?',
  'Thanks!',
  '👍',
];

export function ChatRoomScreen() {
  const { params } = useRoute<R>();
  const me = useAuth((s) => s.user);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [reactFor, setReactFor] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ id: string; body: string; type: string; senderName?: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customReplies, setCustomReplies] = useState<Array<{ id: string; text: string }>>([]);
  const [repliesMgrOpen, setRepliesMgrOpen] = useState(false);
  const [newReplyText, setNewReplyText] = useState('');
  const [forwardMsg, setForwardMsg] = useState<any | null>(null);
  const [forwardConvs, setForwardConvs] = useState<any[]>([]);
  const [forwardLoading, setForwardLoading] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const listRef = useRef<FlatList>(null);
  const liveRef = useRef<{
    clientId: string;
    serverId?: string;
    sub?: Location.LocationSubscription;
    timer?: ReturnType<typeof setTimeout>;
    expiresAtMs: number;
  } | null>(null);

  const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

  const [convInfo, setConvInfo] = useState<{ listingId: string | null; peer: any; listing: any } | null>(null);
  const [pinned, setPinned] = useState<{ id: string; body: string; type: string; sender: { id: string; name: string } } | null>(null);
  const [peerLastReadAt, setPeerLastReadAt] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [rated, setRated] = useState(false);

  const nav = useNavigation<any>();
  const [peerDetails, setPeerDetails] = useState<any>(null);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: 'user' | 'message'; id: string; label: string } | null>(null);
  const [reportReason, setReportReason] = useState<'spam' | 'scam' | 'offensive' | 'unsafe' | 'other'>('spam');
  const [reportNotes, setReportNotes] = useState('');
  const REPORT_REASONS: Array<{ key: 'spam' | 'scam' | 'offensive' | 'unsafe' | 'other'; label: string }> = [
    { key: 'spam', label: 'Spam' },
    { key: 'scam', label: 'Scam / Fraud' },
    { key: 'offensive', label: 'Offensive / Abusive' },
    { key: 'unsafe', label: 'Unsafe / Harmful' },
    { key: 'other', label: 'Other' },
  ];

  useEffect(() => {
    Api.conversation(params.conversationId)
      .then(async (r) => {
        setConvInfo({ listingId: r.conversation.listingId, peer: r.conversation.peer, listing: r.conversation.listing });
        setPeerLastReadAt(r.conversation.peerLastReadAt);
        setMuted(r.conversation.muted);
        setPinned(r.conversation.pinned ? { id: r.conversation.pinned.id, body: r.conversation.pinned.body, type: r.conversation.pinned.type, sender: r.conversation.pinned.sender } : null);
        Api.quickReplies().then((qr) => setCustomReplies(qr.replies.map((r) => ({ id: r.id, text: r.text })))).catch(() => {});
        if (r.conversation.peer?.id) {
          try {
            const u = await Api.user(r.conversation.peer.id);
            setPeerDetails(u.user);
          } catch {}
        }
      })
      .catch(() => {});
  }, [params.conversationId]);

  useEffect(() => {
    const peer = convInfo?.peer;
    if (!peer) return;
    const ratingAvg = peerDetails?.stats?.ratingAvg as number | undefined;
    nav.setOptions({
      headerTitle: () => (
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center' }}
          onPress={() => nav.navigate('UserProfile', { id: peer.id })}
        >
          {peer.avatarUrl ? (
            <Image source={{ uri: peer.avatarUrl }} style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10 }} />
          ) : (
            <View style={{ width: 32, height: 32, borderRadius: 16, marginRight: 10, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 16 }}>👤</Text>
            </View>
          )}
          <View>
            <Text style={{ fontSize: 15, fontWeight: '800', color: theme.colors.text }} numberOfLines={1}>
              {peer.name ?? 'User'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 }}>
              {(() => {
                const presence = formatPresence(peerDetails?.lastSeenAt);
                if (!presence) return null;
                return (
                  <Text style={{ fontSize: 11, color: presence.online ? theme.colors.success ?? '#2E7D32' : theme.colors.textMuted, fontWeight: presence.online ? '800' : '600' }}>
                    {presence.label}
                  </Text>
                );
              })()}
              {ratingAvg ? (
                <Text style={{ fontSize: 11, color: theme.colors.textMuted }}>⭐ {ratingAvg.toFixed(1)}</Text>
              ) : null}
              {peerDetails ? (
                <TrustBadge score={peerDetails.trustScore} kycVerified={peerDetails.kycVerified} size="sm" />
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity onPress={() => { setSearchOpen(true); setSearchQuery(''); setSearchResults([]); }} style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
            <Text style={{ fontSize: 18, color: theme.colors.text }}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSafetyOpen(true)} style={{ paddingHorizontal: 12, paddingVertical: 6 }}>
            <Text style={{ fontSize: 22, color: theme.colors.text }}>⋯</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [convInfo?.peer, peerDetails, nav]);

  function confirmBlock() {
    const peer = convInfo?.peer;
    if (!peer?.id) return;
    setSafetyOpen(false);
    Alert.alert(
      `Block ${peer.name ?? 'user'}?`,
      'They won\'t be able to message you or see your listings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await Api.block(peer.id);
              Alert.alert('Blocked', `${peer.name ?? 'User'} has been blocked.`);
              nav.goBack();
            } catch (e: any) {
              Alert.alert('Could not block', e.message ?? 'try again');
            }
          },
        },
      ],
    );
  }

  async function toggleMute() {
    setSafetyOpen(false);
    const next = !muted;
    setMuted(next);
    try {
      await Api.muteConversation(params.conversationId, next ? null : 0);
    } catch (e: any) {
      setMuted(!next);
      Alert.alert('Could not update', e.message ?? 'try again');
    }
  }

  function openReportPeer() {
    const peer = convInfo?.peer;
    if (!peer?.id) return;
    setSafetyOpen(false);
    setReportReason('spam');
    setReportNotes('');
    setReportTarget({ type: 'user', id: peer.id, label: peer.name ?? 'this user' });
  }

  function openReportMessage(msg: any) {
    setReactFor(null);
    setReportReason('spam');
    setReportNotes('');
    setReportTarget({ type: 'message', id: msg.id, label: 'this message' });
  }

  async function runSearch(q: string) {
    setSearchQuery(q);
    const trimmed = q.trim();
    if (!trimmed) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const r = await Api.searchMessages(params.conversationId, trimmed);
      setSearchResults(r.messages);
    } catch { /* noop */ }
    finally { setSearching(false); }
  }

  function jumpToResult(msg: any) {
    setSearchOpen(false);
    setTimeout(() => scrollToMessage(msg.id), 100);
  }

  async function submitReport() {
    if (!reportTarget) return;
    const t = reportTarget;
    setReportTarget(null);
    try {
      await Api.report({
        targetType: t.type,
        targetId: t.id,
        reason: reportReason,
        notes: reportNotes.trim() || undefined,
      });
      Alert.alert('Report submitted', 'Thanks — our team will review it.');
    } catch (e: any) {
      Alert.alert('Could not submit report', e.message ?? 'try again');
    }
  }

  useEffect(() => {
    let cancelled = false;
    loadCachedMessages(params.conversationId).then((cached) => {
      if (!cancelled && cached.length) { setMessages(cached); setLoading(false); }
    });
    Api.messages(params.conversationId)
      .then((r) => {
        if (cancelled) return;
        setMessages(r.messages);
        saveCachedMessages(params.conversationId, r.messages);
      })
      .catch(() => { /* offline — keep cache */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    Api.markRead(params.conversationId).catch(() => {});

    const s = getSocket();
    s.emit('conversation:join', params.conversationId);
    const onNew = (msg: any) => {
      if (msg.conversationId !== params.conversationId) return;
      setMessages((prev) => {
        if (msg.clientId && prev.some((m) => m.clientId === msg.clientId)) {
          return prev.map((m) => (m.clientId === msg.clientId ? { ...msg, clientId: msg.clientId } : m));
        }
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    };
    s.on('message:new', onNew);
    const onTyping = (evt: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (evt.conversationId !== params.conversationId) return;
      if (evt.userId === me?.id) return;
      setPeersTyping((prev) => {
        const next = new Set(prev);
        if (evt.isTyping) next.add(evt.userId); else next.delete(evt.userId);
        return next;
      });
    };
    s.on('typing', onTyping);
    const onReaction = (evt: { conversationId: string; messageId: string; reactions: Array<{ emoji: string; userId: string }> }) => {
      if (evt.conversationId !== params.conversationId) return;
      setMessages((prev) => prev.map((m) => m.id === evt.messageId ? { ...m, reactions: evt.reactions } : m));
    };
    s.on('message:reaction', onReaction);
    const onUpdated = (evt: { conversationId: string; messageId: string; metadata: any; body?: string; editedAt?: string | null }) => {
      if (evt.conversationId !== params.conversationId) return;
      setMessages((prev) => prev.map((m) =>
        m.id === evt.messageId
          ? { ...m, metadata: evt.metadata ? JSON.stringify(evt.metadata) : m.metadata, body: evt.body ?? m.body, editedAt: evt.editedAt ?? m.editedAt }
          : m,
      ));
    };
    s.on('message:updated', onUpdated);
    const onDeleted = (evt: { conversationId: string; messageId: string }) => {
      if (evt.conversationId !== params.conversationId) return;
      setMessages((prev) => prev.map((m) =>
        m.id === evt.messageId
          ? { ...m, deletedAt: new Date().toISOString(), body: '', mediaUrl: null, metadata: null, reactions: [] }
          : m,
      ));
    };
    s.on('message:deleted', onDeleted);
    const onRead = (evt: { conversationId: string; userId: string; lastReadAt: string }) => {
      if (evt.conversationId !== params.conversationId) return;
      if (evt.userId === me?.id) return;
      setPeerLastReadAt(evt.lastReadAt);
    };
    s.on('conversation:read', onRead);
    return () => {
      cancelled = true;
      s.off('message:new', onNew);
      s.off('typing', onTyping);
      s.off('message:reaction', onReaction);
      s.off('message:updated', onUpdated);
      s.off('message:deleted', onDeleted);
      s.off('conversation:read', onRead);
      stopLiveShare();
    };
  }, [params.conversationId]);

  useEffect(() => {
    if (messages.length) saveCachedMessages(params.conversationId, messages);
  }, [messages, params.conversationId]);

  function sendPayload(body: string, type: 'text' | 'offer' | 'image' | 'location' | 'system' = 'text', metadata?: any, mediaUrl?: string) {
    const clientId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const reply = replyingTo;
    const optimistic = {
      id: clientId, clientId, conversationId: params.conversationId,
      senderId: me!.id, type, body, mediaUrl,
      metadata: metadata ? JSON.stringify(metadata) : null,
      createdAt: new Date().toISOString(),
      sender: { id: me!.id, name: me!.name, avatarUrl: me!.avatarUrl ?? null }, pending: true,
      replyToId: reply?.id,
      replyTo: reply ? { id: reply.id, body: reply.body, type: reply.type, sender: { id: '', name: reply.senderName ?? '' } } : null,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    setReplyingTo(null);

    const s = getSocket();
    s.emit('message:send', { conversationId: params.conversationId, body, type, metadata, mediaUrl, clientId, replyToId: reply?.id }, (resp: any) => {
      if (!resp?.ok) {
        setMessages((prev) => prev.map((m) => m.clientId === clientId ? { ...m, failed: true, pending: false } : m));
      }
    });
  }

  function startReply(item: any) {
    setReactFor(null);
    const snippet = item.type === 'image' ? '📷 Photo'
      : item.type === 'location' ? '📍 Location'
      : item.type === 'offer' ? '💰 Offer'
      : (item.body ?? '');
    setReplyingTo({
      id: item.id,
      body: snippet.length > 120 ? snippet.slice(0, 120) + '…' : snippet,
      type: item.type ?? 'text',
      senderName: item.senderId === me?.id ? 'You' : (item.sender?.name ?? 'Them'),
    });
  }

  function startEdit(item: any) {
    setReactFor(null);
    if (item.type !== 'text') return Alert.alert('Cannot edit', 'Only text messages can be edited.');
    const ageMs = Date.now() - new Date(item.createdAt).getTime();
    if (ageMs > 15 * 60 * 1000) return Alert.alert('Too late', 'Edit window (15 min) has passed.');
    setReplyingTo(null);
    setEditingId(item.id);
    setText(item.body ?? '');
  }

  function cancelEdit() {
    setEditingId(null);
    setText('');
  }

  async function saveEdit() {
    const body = text.trim();
    if (!body || !editingId) return;
    const id = editingId;
    setEditingId(null);
    setText('');
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, body, editedAt: new Date().toISOString() } : m));
    try {
      await Api.updateMessage(id, { body });
    } catch (e: any) {
      Alert.alert('Could not save edit', e.message ?? 'try again');
    }
  }

  function confirmDelete(item: any) {
    setReactFor(null);
    const ageMs = Date.now() - new Date(item.createdAt).getTime();
    if (ageMs > 60 * 60 * 1000) return Alert.alert('Too late', 'Delete window (1 hour) has passed.');
    Alert.alert('Delete message?', 'This removes it for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setMessages((prev) => prev.map((m) => m.id === item.id ? { ...m, deletedAt: new Date().toISOString(), body: '', mediaUrl: null, reactions: [] } : m));
        try { await Api.deleteMessage(item.id); }
        catch (e: any) { Alert.alert('Could not delete', e.message ?? 'try again'); }
      }},
    ]);
  }

  async function saveCustomReply(txt: string) {
    const t = txt.trim();
    if (!t) return;
    if (customReplies.some((r) => r.text === t)) return;
    try {
      const r = await Api.addQuickReply(t);
      setCustomReplies((prev) => [{ id: r.reply.id, text: r.reply.text }, ...prev]);
    } catch (e: any) {
      if (e.code === 'limit_reached') Alert.alert('Limit reached', 'You already have 30 saved replies.');
      else Alert.alert('Could not save', e.message ?? 'try again');
    }
  }

  async function deleteCustomReply(id: string) {
    try {
      await Api.deleteQuickReply(id);
      setCustomReplies((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      Alert.alert('Could not delete', e.message ?? 'try again');
    }
  }

  async function pinMessage(item: any) {
    setReactFor(null);
    try {
      await Api.pinMessage(params.conversationId, item.id);
      setPinned({ id: item.id, body: item.body ?? '', type: item.type ?? 'text', sender: { id: item.senderId, name: item.sender?.name ?? 'User' } });
    } catch (e: any) {
      Alert.alert('Could not pin', e.message ?? 'try again');
    }
  }

  async function unpinMessage() {
    try {
      await Api.unpinMessage(params.conversationId);
      setPinned(null);
    } catch (e: any) {
      Alert.alert('Could not unpin', e.message ?? 'try again');
    }
  }

  async function openForward(item: any) {
    setReactFor(null);
    setForwardMsg(item);
    setForwardLoading(true);
    try {
      const r = await Api.conversations();
      setForwardConvs(r.conversations.filter((c: any) => c.id !== params.conversationId));
    } catch (e: any) {
      Alert.alert('Could not load chats', e.message ?? 'try again');
      setForwardMsg(null);
    } finally { setForwardLoading(false); }
  }

  function sendForward(conversationId: string) {
    const src = forwardMsg;
    if (!src) return;
    const parsedMeta = parseMeta(src.metadata) ?? {};
    const metadata = { ...parsedMeta, _forwarded: true };
    const clientId = `c_${Date.now()}_fwd`;
    getSocket().emit('message:send', {
      conversationId,
      body: src.body ?? '',
      type: src.type ?? 'text',
      mediaUrl: src.mediaUrl,
      metadata,
      clientId,
    });
    setForwardMsg(null);
    Alert.alert('Forwarded', 'Message sent.');
  }

  function scrollToMessage(id: string) {
    const idx = messages.findIndex((m) => m.id === id);
    if (idx >= 0) {
      try { listRef.current?.scrollToIndex({ index: idx, viewPosition: 0.5, animated: true }); } catch {}
    }
  }

  const [uploading, setUploading] = useState(false);
  const [peersTyping, setPeersTyping] = useState<Set<string>>(new Set());
  const typingSentRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  async function attachImage() {
    if (uploading) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow photo library access in Settings.');
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setUploading(true);
    try {
      const shrunk = await ImageManipulator.manipulateAsync(
        a.uri,
        [{ resize: { width: 1280 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      if (!shrunk.base64) throw new Error('Could not read image');
      const { url } = await Api.upload('photo.jpg', 'image/jpeg', shrunk.base64);
      sendPayload('📷 Photo', 'image', undefined, url);
    } catch (e: any) {
      Alert.alert('Upload failed', e.message ?? 'try again');
    } finally { setUploading(false); }
  }

  function onChangeText(v: string) {
    setText(v);
    const s = getSocket();
    if (v.length > 0 && !typingSentRef.current) {
      typingSentRef.current = true;
      s.emit('typing', { conversationId: params.conversationId, isTyping: true });
    }
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      if (typingSentRef.current) {
        typingSentRef.current = false;
        s.emit('typing', { conversationId: params.conversationId, isTyping: false });
      }
    }, 2000);
  }

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    sendPayload(body, 'text');
    setText('');
    if (typingSentRef.current) {
      typingSentRef.current = false;
      getSocket().emit('typing', { conversationId: params.conversationId, isTyping: false });
    }
    setSending(false);
  }

  function submitOffer() {
    const n = parseInt(offerAmount || '0', 10);
    if (!n || n <= 0) return Alert.alert('Enter a valid amount in rupees');
    sendPayload(`₹${n.toLocaleString('en-IN')} offer`, 'offer', { amountInPaise: n * 100, status: 'pending' });
    setOfferOpen(false); setOfferAmount('');
  }

  async function react(messageId: string, emoji: string) {
    setReactFor(null);
    try {
      const r = await Api.reactMessage(messageId, emoji);
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, reactions: r.reactions } : m));
    } catch (e: any) { Alert.alert('Error', e.message ?? 'try again'); }
  }

  function groupReactions(raw?: Array<{ emoji: string; userId: string }>): Array<{ emoji: string; count: number; mine: boolean }> {
    if (!raw?.length) return [];
    const map = new Map<string, { count: number; mine: boolean }>();
    for (const r of raw) {
      const cur = map.get(r.emoji) ?? { count: 0, mine: false };
      cur.count += 1;
      if (r.userId === me?.id) cur.mine = true;
      map.set(r.emoji, cur);
    }
    return Array.from(map.entries()).map(([emoji, v]) => ({ emoji, ...v }));
  }

  function respondToOffer(
    msg: any,
    status: 'accepted' | 'declined' | 'countered' | 'withdrawn',
    extra?: { counterAmountInPaise?: number; counterMessage?: string; finalAmountInPaise?: number },
  ) {
    const meta: any = { offerResponseTo: msg.id, status, ...extra };
    let body = `Offer ${status}`;
    if (status === 'countered' && extra?.counterAmountInPaise) {
      body = `Counter: ₹${(extra.counterAmountInPaise / 100).toLocaleString('en-IN')}`;
    } else if (status === 'accepted' && extra?.finalAmountInPaise) {
      body = `Offer accepted at ₹${(extra.finalAmountInPaise / 100).toLocaleString('en-IN')}`;
    }
    sendPayload(body, 'text', meta);
    if (status === 'accepted') {
      const amt = extra?.finalAmountInPaise ?? parseMeta(msg.metadata)?.amountInPaise ?? 0;
      sendPayload(
        `✅ Deal confirmed at ₹${(amt / 100).toLocaleString('en-IN')}. Coordinate pickup below.`,
        'system',
      );
    }
  }

  const [counterOpen, setCounterOpen] = useState(false);
  const [counterForOffer, setCounterForOffer] = useState<any>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterMsg, setCounterMsg] = useState('');

  function openCounter(offerMsg: any) {
    setCounterForOffer(offerMsg);
    setCounterAmount('');
    setCounterMsg('');
    setCounterOpen(true);
  }

  function submitCounter() {
    const n = parseInt(counterAmount || '0', 10);
    if (!n || n <= 0) return Alert.alert('Enter a valid amount in rupees');
    if (!counterForOffer) return;
    respondToOffer(counterForOffer, 'countered', {
      counterAmountInPaise: n * 100,
      counterMessage: counterMsg.trim() || undefined,
    });
    setCounterOpen(false);
    setCounterForOffer(null);
    setCounterAmount('');
    setCounterMsg('');
  }

  function stopLiveShare() {
    const state = liveRef.current;
    if (!state) return;
    try { state.sub?.remove(); } catch {}
    if (state.timer) clearTimeout(state.timer);
    const id = state.serverId;
    if (id) {
      setMessages((prev) => prev.map((m) => {
        if (m.id !== id) return m;
        const meta = parseMeta(m.metadata) ?? {};
        const next = { ...meta, live: false };
        Api.updateMessage(id, { metadata: next }).catch(() => {});
        return { ...m, metadata: JSON.stringify(next) };
      }));
    }
    liveRef.current = null;
  }

  async function startLiveShare(
    clientId: string,
    expiresAt: string,
    durationMin: number,
    initial: { lat: number; lng: number; accuracyM?: number },
  ) {
    const initialMeta = {
      lat: initial.lat, lng: initial.lng, accuracyM: initial.accuracyM,
      live: true, expiresAt, startedAt: new Date().toISOString(),
    };
    // Seed with a one-shot send — reuse sendPayload. We pass clientId via a manual path:
    const optimistic = {
      id: clientId, clientId, conversationId: params.conversationId,
      senderId: me!.id, type: 'location' as const, body: '📍 Sharing live location',
      metadata: JSON.stringify(initialMeta),
      createdAt: new Date().toISOString(),
      sender: { id: me!.id, name: me!.name, avatarUrl: me!.avatarUrl ?? null }, pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);

    liveRef.current = { clientId, expiresAtMs: new Date(expiresAt).getTime() };

    const s = getSocket();
    s.emit(
      'message:send',
      {
        conversationId: params.conversationId,
        body: '📍 Sharing live location',
        type: 'location',
        metadata: initialMeta,
        clientId,
      },
      (resp: any) => {
        if (resp?.ok && resp.message?.id && liveRef.current?.clientId === clientId) {
          liveRef.current.serverId = resp.message.id;
        }
      },
    );

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Location permission required');
      stopLiveShare();
      return;
    }

    try {
      const sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 20 },
        (loc) => {
          const state = liveRef.current;
          if (!state) return;
          if (Date.now() > state.expiresAtMs) { stopLiveShare(); return; }
          if (!state.serverId) return;
          const meta = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
            accuracyM: loc.coords.accuracy ?? undefined,
            live: true,
            expiresAt,
          };
          setMessages((prev) => prev.map((m) => m.id === state.serverId ? { ...m, metadata: JSON.stringify(meta) } : m));
          Api.updateMessage(state.serverId, { metadata: meta }).catch(() => {});
        },
      );
      if (liveRef.current) liveRef.current.sub = sub;
    } catch {
      Alert.alert('Could not start location updates');
      stopLiveShare();
      return;
    }

    if (liveRef.current) {
      liveRef.current.timer = setTimeout(() => stopLiveShare(), durationMin * 60_000);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      {pinned && (
        <View style={styles.pinBar}>
          <Text style={{ fontSize: 16, marginRight: 8 }}>📌</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.pinLabel}>Pinned · {pinned.sender?.name ?? 'User'}</Text>
            <Text style={styles.pinBody} numberOfLines={1}>
              {pinned.type === 'image' ? '📷 Photo' : pinned.type === 'location' ? '📍 Location' : pinned.type === 'offer' ? '💰 Offer' : pinned.body}
            </Text>
          </View>
          <TouchableOpacity onPress={unpinMessage} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.pinClose}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
      {convInfo?.listing && (
        <TouchableOpacity
          style={styles.listingBar}
          onPress={() => nav.navigate('ListingDetail', { id: convInfo.listing.id })}
          activeOpacity={0.85}
        >
          {convInfo.listing.images?.[0] ? (
            <Image source={{ uri: convInfo.listing.images[0] }} style={styles.listingThumb} />
          ) : (
            <View style={[styles.listingThumb, { alignItems: 'center', justifyContent: 'center' }]}>
              <Text>📦</Text>
            </View>
          )}
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.listingTitle} numberOfLines={1}>{convInfo.listing.title}</Text>
            {typeof convInfo.listing.priceInPaise === 'number' && (
              <Text style={styles.listingPrice}>
                ₹{(convInfo.listing.priceInPaise / 100).toLocaleString('en-IN')}
                {convInfo.listing.status && convInfo.listing.status !== 'active' ? ` · ${convInfo.listing.status}` : ''}
              </Text>
            )}
          </View>
          <Text style={styles.listingChev}>›</Text>
        </TouchableOpacity>
      )}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 12 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const mine = item.senderId === me?.id;
          if (item.deletedAt) {
            return (
              <View style={[styles.bubbleRow, mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
                <View style={[styles.bubble, styles.deletedBubble]}>
                  <Text style={styles.deletedText}>🚫 Message deleted</Text>
                </View>
              </View>
            );
          }
          if (item.type === 'offer') {
            const meta = parseMeta(item.metadata);
            const responses = messages
              .filter((m) => parseMeta(m.metadata)?.offerResponseTo === item.id)
              .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
            const latest = responses[responses.length - 1];
            const latestMeta = parseMeta(latest?.metadata) ?? {};
            const status = latestMeta.status ?? meta?.status ?? 'pending';
            const counterAmountPaise = latestMeta.counterAmountInPaise ?? null;
            const counterMessage = latestMeta.counterMessage ?? null;
            return (
              <View style={[styles.bubbleRow, mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
                <OfferCard
                  amountInPaise={meta?.amountInPaise ?? 0}
                  status={status}
                  mine={mine}
                  counterAmountPaise={counterAmountPaise}
                  counterMessage={counterMessage}
                  onAccept={() => { respondToOffer(item, 'accepted', { finalAmountInPaise: meta?.amountInPaise }); return Promise.resolve(); }}
                  onDecline={() => { respondToOffer(item, 'declined'); return Promise.resolve(); }}
                  onCounter={() => openCounter(item)}
                  onAcceptCounter={() => {
                    respondToOffer(item, 'accepted', { finalAmountInPaise: counterAmountPaise ?? meta?.amountInPaise });
                    return Promise.resolve();
                  }}
                  onWithdraw={() => { respondToOffer(item, 'withdrawn'); return Promise.resolve(); }}
                />
              </View>
            );
          }
          if (item.type === 'system') {
            return (
              <View style={styles.sysWrap}>
                <View style={styles.sysPill}>
                  <Text style={styles.sysText}>{item.body}</Text>
                </View>
              </View>
            );
          }
          const rx = groupReactions(item.reactions);
          const reactionsRow = rx.length > 0 ? (
            <View style={[styles.reactRow, mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
              {rx.map((r) => (
                <TouchableOpacity key={r.emoji} onPress={() => react(item.id, r.emoji)}
                  style={[styles.reactPill, r.mine && styles.reactPillMine]}>
                  <Text style={styles.reactEmoji}>{r.emoji}</Text>
                  <Text style={[styles.reactCount, r.mine && { color: '#fff' }]}>{r.count}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null;

          if (item.type === 'location') {
            const meta = parseMeta(item.metadata) ?? {};
            const isLive = !!meta.live && (!meta.expiresAt || new Date(meta.expiresAt).getTime() > Date.now());
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${meta.lat},${meta.lng}`;
            return (
              <View>
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => meta.lat && Linking.openURL(mapsUrl)}
                  onLongPress={() => item.id && !String(item.id).startsWith('c_') && setReactFor(item.id)}
                  style={[styles.bubbleRow, mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}
                >
                  <View style={[styles.locCard, mine && { borderColor: theme.colors.primary }]}>
                    <View style={styles.locHeader}>
                      <Text style={styles.locBadge}>
                        {meta.meetup ? '🛡 Safe meetup spot' : isLive ? '🟢 Live location' : '📍 Location'}
                      </Text>
                      {isLive && meta.expiresAt && (
                        <Text style={styles.locExpiry}>
                          until {new Date(meta.expiresAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      )}
                    </View>
                    {meta.meetup && meta.meetupName && (
                      <Text style={styles.locMeetupName}>{String(meta.meetupName)}</Text>
                    )}
                    {meta.meetup && meta.meetupAddress && (
                      <Text style={styles.locMeetupAddr}>{String(meta.meetupAddress)}</Text>
                    )}
                    {!meta.meetup && meta.lat && meta.lng && (
                      <Text style={styles.locCoords}>
                        {Number(meta.lat).toFixed(5)}, {Number(meta.lng).toFixed(5)}
                      </Text>
                    )}
                    {!meta.meetup && meta.accuracyM && <Text style={styles.locMeta}>±{Math.round(meta.accuracyM)}m accuracy</Text>}
                    <Text style={styles.locOpen}>Tap to open in Maps ›</Text>
                  </View>
                </TouchableOpacity>
                {reactionsRow}
              </View>
            );
          }
          const fwdTag = parseMeta(item.metadata)?._forwarded ? (
            <Text style={[styles.fwdTag, mine && { color: '#FFE7DF' }]}>↪️ Forwarded</Text>
          ) : null;
          const storyMeta = parseMeta(item.metadata);
          const storyReplyChip = storyMeta?.storyReply ? (
            <View style={[styles.storyReplyChip, mine && styles.storyReplyChipMine]}>
              <Text style={[styles.storyReplyLabel, mine && { color: '#FFE7DF' }]} numberOfLines={1}>
                ↪ Replied to {storyMeta.storyAuthorName ?? 'their'} story
              </Text>
              {storyMeta.storyBody ? (
                <Text style={[styles.storyReplyBody, mine && { color: '#FFF' }]} numberOfLines={2}>
                  {storyMeta.storyMediaUrl ? '📷 ' : ''}{storyMeta.storyBody}
                </Text>
              ) : null}
            </View>
          ) : null;
          const quoted = item.replyTo ? (
            <TouchableOpacity onPress={() => scrollToMessage(item.replyTo.id)} style={[styles.quote, mine && styles.quoteMine]}>
              <Text style={[styles.quoteName, mine && { color: '#FFE7DF' }]} numberOfLines={1}>
                {item.replyTo.sender?.name || 'User'}
              </Text>
              <Text style={[styles.quoteBody, mine && { color: '#FFF' }]} numberOfLines={2}>
                {item.replyTo.type === 'image' ? '📷 Photo'
                  : item.replyTo.type === 'location' ? '📍 Location'
                  : item.replyTo.type === 'offer' ? '💰 Offer'
                  : (item.replyTo.body ?? '')}
              </Text>
            </TouchableOpacity>
          ) : null;

          if (item.type === 'image' && item.mediaUrl) {
            return (
              <View>
                <TouchableOpacity activeOpacity={0.9} onLongPress={() => item.id && !String(item.id).startsWith('c_') && setReactFor(item.id)}
                  style={[styles.bubbleRow, mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
                  <View style={[styles.imageBubble, mine ? styles.imageMine : styles.imageTheirs]}>
                    {!mine && item.sender && <Text style={styles.senderName}>{item.sender.name}</Text>}
                    {fwdTag}
                    {storyReplyChip}
                    {quoted}
                    <Image source={{ uri: item.mediaUrl }} style={styles.chatImage} />
                    {item.pending && <Text style={styles.status}>uploading…</Text>}
                    {item.failed && <Text style={[styles.status, { color: theme.colors.danger }]}>failed</Text>}
                    {mine && !item.pending && !item.failed && (
                      <Text style={[styles.ticks, isMsgRead(item, peerLastReadAt) && styles.ticksRead]}>
                        {isMsgRead(item, peerLastReadAt) ? '✓✓' : '✓'}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
                {reactionsRow}
              </View>
            );
          }
          return (
            <View>
              <TouchableOpacity activeOpacity={0.9} onLongPress={() => item.id && !String(item.id).startsWith('c_') && setReactFor(item.id)}
                style={[styles.bubbleRow, mine ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' }]}>
                <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                  {!mine && item.sender && <Text style={styles.senderName}>{item.sender.name}</Text>}
                  {fwdTag}
                  {quoted}
                  <Text style={[styles.msgText, mine && { color: '#fff' }]}>{item.body}</Text>
                  {item.editedAt && <Text style={[styles.editedTag, mine && { color: '#FFD2C4' }]}>edited</Text>}
                  {item.pending && <Text style={[styles.status, mine && { color: '#FFD2C4' }]}>sending…</Text>}
                  {item.failed && <Text style={[styles.status, { color: theme.colors.danger }]}>failed</Text>}
                  {mine && !item.pending && !item.failed && (
                    <Text style={[styles.ticks, { color: '#FFD2C4' }, isMsgRead(item, peerLastReadAt) && styles.ticksRead]}>
                      {isMsgRead(item, peerLastReadAt) ? '✓✓' : '✓'}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
              {reactionsRow}
              {(() => {
                const shield = parseMeta(item.metadata)?.shield;
                if (!mine && shield && shield.risk && shield.risk !== 'clean') {
                  return <ScamShieldBanner shield={shield} />;
                }
                return null;
              })()}
            </View>
          );
        }}
      />
      {(() => {
        const hasDeal = messages.some((m) => m.type === 'system' && typeof m.body === 'string' && m.body.includes('Deal confirmed'));
        if (!hasDeal || rated || !convInfo?.peer?.id || !convInfo?.listing?.id) return null;
        return (
          <TouchableOpacity style={styles.ratePrompt} onPress={() => setRateOpen(true)}>
            <Text style={styles.ratePromptText}>⭐ Rate your deal with {convInfo.peer.name ?? 'this user'}</Text>
          </TouchableOpacity>
        );
      })()}
      {peersTyping.size > 0 && (
        <View style={styles.typingRow}>
          <Text style={styles.typingText}>{params.title ?? 'Someone'} is typing…</Text>
        </View>
      )}
      {convInfo?.peer?.id && convInfo?.listing?.id && (
        <RatingModal
          visible={rateOpen}
          onClose={() => setRateOpen(false)}
          onSubmitted={() => setRated(true)}
          toUserId={convInfo.peer.id}
          toUserName={convInfo.peer.name}
          context="listing"
          contextId={convInfo.listing.id}
        />
      )}
      {editingId && (
        <View style={styles.replyPreview}>
          <View style={{ flex: 1 }}>
            <Text style={styles.replyPreviewName}>✏️ Editing message</Text>
            <Text style={styles.replyPreviewBody} numberOfLines={1}>Tap ✓ to save, ✕ to cancel</Text>
          </View>
          <TouchableOpacity onPress={cancelEdit} style={styles.replyPreviewClose}>
            <Text style={{ fontSize: 18, color: theme.colors.textMuted }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
      {replyingTo && !editingId && (
        <View style={styles.replyPreview}>
          <View style={{ flex: 1 }}>
            <Text style={styles.replyPreviewName}>Replying to {replyingTo.senderName}</Text>
            <Text style={styles.replyPreviewBody} numberOfLines={1}>{replyingTo.body}</Text>
          </View>
          <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.replyPreviewClose}>
            <Text style={{ fontSize: 18, color: theme.colors.textMuted }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
      {!text.trim() && !editingId && messages.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.quickReplyRow}
        >
          {customReplies.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.quickReplyChip, styles.quickReplyChipSaved]}
              onPress={() => setText(r.text)}
              onLongPress={() => Alert.alert('Delete saved reply?', r.text, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteCustomReply(r.id) },
              ])}
            >
              <Text style={styles.quickReplyText}>{r.text}</Text>
            </TouchableOpacity>
          ))}
          {QUICK_REPLIES.map((q) => (
            <TouchableOpacity key={q} style={styles.quickReplyChip} onPress={() => setText(q)}>
              <Text style={styles.quickReplyText}>{q}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={[styles.quickReplyChip, styles.quickReplyAddChip]} onPress={() => setRepliesMgrOpen(true)}>
            <Text style={styles.quickReplyText}>➕ Save</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
      <View style={styles.inputBar}>
        <TouchableOpacity style={styles.offerBtn} onPress={attachImage} disabled={uploading}>
          {uploading ? <ActivityIndicator color={theme.colors.primary} /> : <Text style={{ fontSize: 18 }}>📷</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.offerBtn} onPress={() => setOfferOpen(true)}>
          <Text style={{ fontSize: 18 }}>💰</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.offerBtn} onPress={() => setLocationOpen(true)}>
          <Text style={{ fontSize: 18 }}>📍</Text>
        </TouchableOpacity>
        <TextInput
          value={text}
          onChangeText={onChangeText}
          placeholder="Message"
          placeholderTextColor={theme.colors.textMuted}
          style={styles.input}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={editingId ? saveEdit : send} disabled={!text.trim() || sending}>
          <Text style={styles.sendText}>{editingId ? '✓' : '➤'}</Text>
        </TouchableOpacity>
      </View>

      <LocationShareModal
        visible={locationOpen}
        onClose={() => setLocationOpen(false)}
        onSendCurrent={(coords) => {
          setLocationOpen(false);
          sendPayload(
            '📍 Shared location',
            'location',
            { lat: coords.lat, lng: coords.lng, accuracyM: coords.accuracyM, live: false },
          );
        }}
        onStartLive={(coords, durationMin) => {
          setLocationOpen(false);
          const expiresAt = new Date(Date.now() + durationMin * 60_000).toISOString();
          const clientId = `c_${Date.now()}_live`;
          startLiveShare(clientId, expiresAt, durationMin, coords);
        }}
        onSendMeetup={(spot) => {
          setLocationOpen(false);
          sendPayload(
            `🛡 Safe meetup: ${spot.name}`,
            'location',
            {
              lat: spot.lat,
              lng: spot.lng,
              live: false,
              meetup: true,
              meetupName: spot.name,
              meetupAddress: spot.address,
              meetupKind: spot.kind,
            },
          );
        }}
      />

      <Modal visible={!!reactFor} transparent animationType="fade" onRequestClose={() => setReactFor(null)}>
        <TouchableOpacity style={[styles.backdrop, { justifyContent: 'center' }]} activeOpacity={1} onPress={() => setReactFor(null)}>
          <View style={styles.reactPicker}>
            {REACTIONS.map((e) => (
              <TouchableOpacity key={e} style={styles.reactPickItem} onPress={() => reactFor && react(reactFor, e)}>
                <Text style={{ fontSize: 28 }}>{e}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.replyPickItem}
              onPress={() => {
                const msg = messages.find((m) => m.id === reactFor);
                if (msg) startReply(msg);
              }}
            >
              <Text style={{ fontSize: 20 }}>↩️</Text>
              <Text style={styles.replyPickText}>Reply</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.replyPickItem}
              onPress={() => {
                const msg = messages.find((m) => m.id === reactFor);
                if (msg) openForward(msg);
              }}
            >
              <Text style={{ fontSize: 18 }}>↪️</Text>
              <Text style={styles.replyPickText}>Forward</Text>
            </TouchableOpacity>
            {(() => {
              const msg = messages.find((m) => m.id === reactFor);
              if (!msg || msg.deletedAt) return null;
              const isPinned = pinned?.id === msg.id;
              return (
                <TouchableOpacity
                  style={styles.replyPickItem}
                  onPress={() => isPinned ? (setReactFor(null), unpinMessage()) : pinMessage(msg)}
                >
                  <Text style={{ fontSize: 18 }}>📌</Text>
                  <Text style={styles.replyPickText}>{isPinned ? 'Unpin' : 'Pin'}</Text>
                </TouchableOpacity>
              );
            })()}
            {(() => {
              const msg = messages.find((m) => m.id === reactFor);
              if (!msg) return null;
              if (msg.senderId === me?.id) {
                const ageMs = Date.now() - new Date(msg.createdAt).getTime();
                const canEdit = msg.type === 'text' && ageMs <= 15 * 60 * 1000;
                const canDelete = ageMs <= 60 * 60 * 1000;
                return (
                  <>
                    {canEdit && (
                      <TouchableOpacity style={styles.replyPickItem} onPress={() => startEdit(msg)}>
                        <Text style={{ fontSize: 18 }}>✏️</Text>
                        <Text style={styles.replyPickText}>Edit</Text>
                      </TouchableOpacity>
                    )}
                    {canDelete && (
                      <TouchableOpacity style={styles.replyPickItem} onPress={() => confirmDelete(msg)}>
                        <Text style={{ fontSize: 18 }}>🗑️</Text>
                        <Text style={[styles.replyPickText, { color: theme.colors.danger }]}>Delete</Text>
                      </TouchableOpacity>
                    )}
                  </>
                );
              }
              return (
                <TouchableOpacity style={styles.replyPickItem} onPress={() => openReportMessage(msg)}>
                  <Text style={{ fontSize: 18 }}>🚩</Text>
                  <Text style={[styles.replyPickText, { color: theme.colors.danger }]}>Report</Text>
                </TouchableOpacity>
              );
            })()}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!forwardMsg} transparent animationType="slide" onRequestClose={() => setForwardMsg(null)}>
        <View style={styles.backdrop}>
          <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={() => setForwardMsg(null)} />
          <View style={styles.offerSheet}>
            <Text style={styles.offerTitle}>Forward to…</Text>
            {forwardLoading ? (
              <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 20 }} />
            ) : forwardConvs.length === 0 ? (
              <Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginVertical: 20 }}>
                No other chats yet.
              </Text>
            ) : (
              <FlatList
                data={forwardConvs}
                keyExtractor={(c) => c.id}
                style={{ maxHeight: 320 }}
                renderItem={({ item }) => {
                  const peer = item.members?.find((m: any) => m.userId !== me?.id)?.user;
                  const title = item.group?.name ?? peer?.name ?? 'Chat';
                  return (
                    <TouchableOpacity style={styles.fwdRow} onPress={() => sendForward(item.id)}>
                      {peer?.avatarUrl ? (
                        <Image source={{ uri: peer.avatarUrl }} style={styles.fwdAvatar} />
                      ) : (
                        <View style={[styles.fwdAvatar, { backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
                          <Text>👤</Text>
                        </View>
                      )}
                      <Text style={styles.fwdName} numberOfLines={1}>{title}</Text>
                    </TouchableOpacity>
                  );
                }}
              />
            )}
            <TouchableOpacity style={[styles.sheetBtn, styles.sheetGhost, { marginTop: 10 }]} onPress={() => setForwardMsg(null)}>
              <Text style={[styles.sheetText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={counterOpen} transparent animationType="slide" onRequestClose={() => setCounterOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.backdrop}
        >
          <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={() => setCounterOpen(false)} />
          <View style={styles.offerSheet}>
            <Text style={styles.offerTitle}>Counter offer</Text>
            {counterForOffer && (
              <Text style={{ color: theme.colors.textMuted, marginBottom: 10 }}>
                Buyer offered ₹{((parseMeta(counterForOffer.metadata)?.amountInPaise ?? 0) / 100).toLocaleString('en-IN')}
              </Text>
            )}
            <TextInput
              style={styles.offerInput}
              keyboardType="number-pad"
              value={counterAmount}
              onChangeText={setCounterAmount}
              placeholder="Your price in ₹"
              placeholderTextColor={theme.colors.textMuted}
              autoFocus
            />
            <TextInput
              style={[styles.offerInput, { marginTop: 8, fontSize: 14 }]}
              value={counterMsg}
              onChangeText={setCounterMsg}
              placeholder="Note (optional) — e.g. best I can do"
              placeholderTextColor={theme.colors.textMuted}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity style={[styles.sheetBtn, styles.sheetGhost]} onPress={() => setCounterOpen(false)}>
                <Text style={[styles.sheetText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetBtn, { flex: 1 }]} onPress={submitCounter}>
                <Text style={styles.sheetText}>Send counter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={searchOpen} transparent animationType="slide" onRequestClose={() => setSearchOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
          <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={() => setSearchOpen(false)} />
          <View style={styles.offerSheet}>
            <Text style={styles.offerTitle}>Search messages</Text>
            <TextInput
              style={styles.offerInput}
              value={searchQuery}
              onChangeText={runSearch}
              placeholder="Type to search…"
              placeholderTextColor={theme.colors.textMuted}
              autoFocus
            />
            <View style={{ marginTop: 10, maxHeight: 340 }}>
              {searching ? (
                <ActivityIndicator color={theme.colors.primary} style={{ marginVertical: 16 }} />
              ) : searchQuery.trim() && searchResults.length === 0 ? (
                <Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginVertical: 16 }}>No matches.</Text>
              ) : (
                <FlatList
                  data={searchResults}
                  keyExtractor={(m) => m.id}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.searchResult} onPress={() => jumpToResult(item)}>
                      <Text style={styles.searchResultSender} numberOfLines={1}>
                        {item.senderId === me?.id ? 'You' : (item.sender?.name ?? 'User')} · {formatResultDate(item.createdAt)}
                      </Text>
                      <Text style={styles.searchResultBody} numberOfLines={2}>{item.body}</Text>
                    </TouchableOpacity>
                  )}
                />
              )}
            </View>
            <TouchableOpacity style={[styles.sheetBtn, styles.sheetGhost, { marginTop: 10 }]} onPress={() => setSearchOpen(false)}>
              <Text style={[styles.sheetText, { color: theme.colors.text }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={safetyOpen} transparent animationType="fade" onRequestClose={() => setSafetyOpen(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setSafetyOpen(false)}>
          <View style={styles.offerSheet}>
            <Text style={styles.offerTitle}>Safety</Text>
            <TouchableOpacity style={styles.safetyRow} onPress={toggleMute}>
              <Text style={styles.safetyIcon}>{muted ? '🔔' : '🔕'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.safetyLabel}>{muted ? 'Unmute notifications' : 'Mute notifications'}</Text>
                <Text style={styles.safetyHint}>
                  {muted ? 'Resume push alerts for this chat.' : 'Stop push alerts — messages still arrive in the app.'}
                </Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.safetyRow} onPress={openReportPeer}>
              <Text style={styles.safetyIcon}>🚩</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.safetyLabel}>Report {convInfo?.peer?.name ?? 'user'}</Text>
                <Text style={styles.safetyHint}>Flag spam, scam, or abusive behavior.</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.safetyRow} onPress={confirmBlock}>
              <Text style={styles.safetyIcon}>🚫</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.safetyLabel, { color: theme.colors.danger }]}>Block {convInfo?.peer?.name ?? 'user'}</Text>
                <Text style={styles.safetyHint}>Stop all messages and hide their listings.</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sheetBtn, styles.sheetGhost, { marginTop: 10 }]} onPress={() => setSafetyOpen(false)}>
              <Text style={[styles.sheetText, { color: theme.colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!reportTarget} transparent animationType="slide" onRequestClose={() => setReportTarget(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
          <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={() => setReportTarget(null)} />
          <View style={styles.offerSheet}>
            <Text style={styles.offerTitle}>Report {reportTarget?.label ?? ''}</Text>
            <Text style={{ color: theme.colors.textMuted, marginBottom: 10, fontSize: 13 }}>
              Pick a reason — add a note if it helps our team.
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {REPORT_REASONS.map((r) => (
                <TouchableOpacity
                  key={r.key}
                  onPress={() => setReportReason(r.key)}
                  style={[styles.reasonChip, reportReason === r.key && styles.reasonChipActive]}
                >
                  <Text style={[styles.reasonText, reportReason === r.key && { color: '#fff' }]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.offerInput, { fontSize: 14, minHeight: 70 }]}
              value={reportNotes}
              onChangeText={setReportNotes}
              placeholder="Additional details (optional)"
              placeholderTextColor={theme.colors.textMuted}
              multiline
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity style={[styles.sheetBtn, styles.sheetGhost]} onPress={() => setReportTarget(null)}>
                <Text style={[styles.sheetText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetBtn, { flex: 1 }]} onPress={submitReport}>
                <Text style={styles.sheetText}>Submit report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={offerOpen} transparent animationType="slide" onRequestClose={() => setOfferOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.backdrop}
        >
          <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={() => setOfferOpen(false)} />
          <View style={styles.offerSheet}>
            <Text style={styles.offerTitle}>Send an offer</Text>
            <TextInput
              style={styles.offerInput}
              keyboardType="number-pad"
              value={offerAmount}
              onChangeText={setOfferAmount}
              placeholder="Amount in ₹"
              placeholderTextColor={theme.colors.textMuted}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submitOffer}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity style={[styles.sheetBtn, styles.sheetGhost]} onPress={() => setOfferOpen(false)}>
                <Text style={[styles.sheetText, { color: theme.colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetBtn, { flex: 1 }]} onPress={submitOffer}>
                <Text style={styles.sheetText}>Send offer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={repliesMgrOpen} transparent animationType="slide" onRequestClose={() => setRepliesMgrOpen(false)}>
        <View style={styles.backdrop}>
          <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={() => setRepliesMgrOpen(false)} />
          <View style={styles.offerSheet}>
            <Text style={styles.offerTitle}>Saved quick replies</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              <TextInput
                style={[styles.offerInput, { flex: 1 }]}
                value={newReplyText}
                onChangeText={setNewReplyText}
                placeholder="Type a reply to save…"
                placeholderTextColor={theme.colors.textMuted}
                maxLength={280}
              />
              <TouchableOpacity
                style={[styles.sheetBtn, { paddingHorizontal: 20 }]}
                onPress={async () => { await saveCustomReply(newReplyText); setNewReplyText(''); }}
              >
                <Text style={styles.sheetText}>Save</Text>
              </TouchableOpacity>
            </View>
            {customReplies.length === 0 ? (
              <Text style={{ color: theme.colors.textMuted, textAlign: 'center', paddingVertical: 16 }}>
                No saved replies yet. Save common phrases here to send them in one tap.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 260 }}>
                {customReplies.map((r) => (
                  <View key={r.id} style={styles.savedReplyRow}>
                    <Text style={{ flex: 1, color: theme.colors.text }}>{r.text}</Text>
                    <TouchableOpacity onPress={() => deleteCustomReply(r.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={{ color: theme.colors.danger, fontWeight: '800', fontSize: 16 }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity style={{ alignItems: 'center', paddingVertical: 12 }} onPress={() => setRepliesMgrOpen(false)}>
              <Text style={{ color: theme.colors.textMuted, fontWeight: '700' }}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function formatResultDate(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const day = 86_400_000;
  if (diff < day) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  if (diff < 7 * day) return d.toLocaleDateString('en-IN', { weekday: 'short' });
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

function isMsgRead(msg: any, peerLastReadAt: string | null): boolean {
  if (!peerLastReadAt) return false;
  const sent = new Date(msg.createdAt).getTime();
  return sent <= new Date(peerLastReadAt).getTime();
}

function formatPresence(iso?: string | null): { online: boolean; label: string } | null {
  if (!iso) return null;
  const seen = new Date(iso).getTime();
  const diff = Date.now() - seen;
  if (diff < 2 * 60_000) return { online: true, label: '🟢 online' };
  const min = 60_000, hr = 60 * min, day = 24 * hr;
  if (diff < hr) return { online: false, label: `last seen ${Math.floor(diff / min)}m ago` };
  if (diff < day) return { online: false, label: `last seen ${Math.floor(diff / hr)}h ago` };
  if (diff < 7 * day) return { online: false, label: `last seen ${Math.floor(diff / day)}d ago` };
  return { online: false, label: `last seen ${new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` };
}

function parseMeta(raw?: string | null): any {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bubbleRow: { flexDirection: 'row', marginVertical: 3 },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12 },
  mine: { backgroundColor: theme.colors.primary, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: theme.colors.surface, borderBottomLeftRadius: 4 },
  senderName: { fontSize: 11, fontWeight: '700', color: theme.colors.accent, marginBottom: 2 },
  msgText: { color: theme.colors.text, fontSize: 15 },
  status: { fontSize: 10, color: theme.colors.textMuted, marginTop: 3, textAlign: 'right' },
  inputBar: {
    flexDirection: 'row', padding: 8, borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border, backgroundColor: theme.colors.bg, alignItems: 'flex-end',
  },
  offerBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surface,
    justifyContent: 'center', alignItems: 'center', marginRight: 4,
  },
  input: {
    flex: 1, backgroundColor: theme.colors.surface, borderRadius: 20, paddingHorizontal: 14,
    paddingVertical: 10, maxHeight: 120, color: theme.colors.text, fontSize: 15,
  },
  sendBtn: {
    marginLeft: 8, width: 40, height: 40, borderRadius: 20,
    backgroundColor: theme.colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  sendText: { color: '#fff', fontSize: 18, fontWeight: '900' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  offerSheet: {
    backgroundColor: theme.colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 20, paddingBottom: 32,
  },
  offerTitle: { fontSize: 18, fontWeight: '800', color: theme.colors.text, marginBottom: 12 },
  offerInput: {
    borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
    padding: 14, fontSize: 18, color: theme.colors.text, backgroundColor: theme.colors.surface,
  },
  sheetBtn: { backgroundColor: theme.colors.primary, padding: 14, borderRadius: theme.radius.md, alignItems: 'center' },
  sheetGhost: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 20 },
  sheetText: { color: '#fff', fontWeight: '800' },
  imageBubble: { maxWidth: '70%', borderRadius: 16, padding: 4, overflow: 'hidden' },
  imageMine: { backgroundColor: theme.colors.primary, borderBottomRightRadius: 4 },
  imageTheirs: { backgroundColor: theme.colors.surface, borderBottomLeftRadius: 4 },
  chatImage: { width: 220, height: 220, borderRadius: 12, backgroundColor: '#DDD' },
  typingRow: { paddingHorizontal: 14, paddingVertical: 4 },
  sysWrap: { alignItems: 'center', marginVertical: 8 },
  sysPill: {
    backgroundColor: theme.colors.successSoft ?? '#E8F5E9',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: theme.radius.pill,
    borderWidth: 1, borderColor: theme.colors.success ?? '#4CAF50',
  },
  sysText: { color: theme.colors.success ?? '#2E7D32', fontWeight: '700', fontSize: 12 },
  ratePrompt: {
    marginHorizontal: 12, marginBottom: 6, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: theme.radius.pill, backgroundColor: '#FFF6E0',
    borderWidth: 1, borderColor: '#F5A623', alignItems: 'center',
  },
  ratePromptText: { color: '#8a6500', fontWeight: '800', fontSize: 13 },
  typingText: { color: theme.colors.textMuted, fontSize: 12, fontStyle: 'italic' },
  reactRow: { flexDirection: 'row', gap: 4, marginTop: -4, marginBottom: 6, paddingHorizontal: 4 },
  reactPill: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.surface,
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: theme.colors.border,
  },
  reactPillMine: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  reactEmoji: { fontSize: 14 },
  reactCount: { fontSize: 12, fontWeight: '700', color: theme.colors.text, marginLeft: 4 },
  reactPicker: {
    flexDirection: 'row', backgroundColor: '#fff', borderRadius: 30,
    paddingVertical: 10, paddingHorizontal: 12, gap: 6,
    alignSelf: 'center', marginTop: 'auto', marginBottom: 'auto',
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  reactPickItem: { padding: 6 },
  replyPickItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6,
    borderLeftWidth: 1, borderLeftColor: theme.colors.border, marginLeft: 4,
  },
  replyPickText: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  quote: {
    borderLeftWidth: 3, borderLeftColor: theme.colors.accent,
    backgroundColor: 'rgba(0,0,0,0.04)', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, marginBottom: 4,
  },
  quoteMine: { backgroundColor: 'rgba(255,255,255,0.18)', borderLeftColor: '#FFE7DF' },
  storyReplyChip: {
    borderLeftWidth: 3, borderLeftColor: theme.colors.primary,
    backgroundColor: 'rgba(255,90,60,0.08)', paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 6, marginBottom: 4,
  },
  storyReplyChipMine: { backgroundColor: 'rgba(255,255,255,0.18)', borderLeftColor: '#FFE7DF' },
  storyReplyLabel: { fontSize: 11, fontWeight: '800', color: theme.colors.primary },
  storyReplyBody: { fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
  quoteName: { fontSize: 11, fontWeight: '800', color: theme.colors.accent },
  quoteBody: { fontSize: 12, color: theme.colors.textMuted, marginTop: 1 },
  replyPreview: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.surface, paddingHorizontal: 12, paddingVertical: 8,
    borderLeftWidth: 3, borderLeftColor: theme.colors.accent,
    marginHorizontal: 8, marginBottom: 4, borderRadius: 8,
  },
  replyPreviewName: { fontSize: 12, fontWeight: '800', color: theme.colors.accent },
  replyPreviewBody: { fontSize: 13, color: theme.colors.textMuted, marginTop: 1 },
  replyPreviewClose: { padding: 6, marginLeft: 8 },
  editedTag: { fontSize: 10, color: theme.colors.textMuted, fontStyle: 'italic', marginTop: 2, textAlign: 'right' },
  ticks: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2, textAlign: 'right', fontWeight: '700' },
  ticksRead: { color: '#4FC3F7' },
  deletedBubble: {
    backgroundColor: theme.colors.surface, borderWidth: 1, borderStyle: 'dashed',
    borderColor: theme.colors.border,
  },
  deletedText: { color: theme.colors.textMuted, fontStyle: 'italic', fontSize: 13 },
  fwdTag: { fontSize: 11, fontWeight: '700', fontStyle: 'italic', color: theme.colors.accent, marginBottom: 2 },
  fwdRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border,
  },
  fwdAvatar: { width: 40, height: 40, borderRadius: 20, marginRight: 12 },
  fwdName: { fontSize: 15, fontWeight: '700', color: theme.colors.text, flex: 1 },
  listingBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.primarySoft,
    paddingHorizontal: 10, paddingVertical: 8, marginHorizontal: 8, marginTop: 6,
    borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.primary,
  },
  listingThumb: { width: 44, height: 44, borderRadius: theme.radius.sm, backgroundColor: '#EEE' },
  listingTitle: { fontSize: 14, fontWeight: '800', color: theme.colors.text },
  listingPrice: { fontSize: 12, fontWeight: '700', color: theme.colors.primaryDark, marginTop: 2 },
  listingChev: { fontSize: 22, color: theme.colors.primaryDark, marginLeft: 6 },
  pinBar: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.card,
    paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 8, marginTop: 6,
    borderRadius: theme.radius.md, borderLeftWidth: 3, borderLeftColor: theme.colors.accent,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  pinLabel: { fontSize: 11, fontWeight: '800', color: theme.colors.accent, textTransform: 'uppercase', letterSpacing: 0.4 },
  pinBody: { fontSize: 13, color: theme.colors.text, marginTop: 2 },
  pinClose: { fontSize: 16, color: theme.colors.textMuted, fontWeight: '700', paddingHorizontal: 6 },
  locCard: {
    maxWidth: '78%', backgroundColor: theme.colors.card,
    borderRadius: 16, padding: 12, borderWidth: 1, borderColor: theme.colors.border, minWidth: 220,
  },
  locHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  locBadge: { fontSize: 12, fontWeight: '800', color: theme.colors.accent },
  locExpiry: { fontSize: 11, color: theme.colors.textMuted },
  locCoords: { fontSize: 13, color: theme.colors.text, fontWeight: '700', marginTop: 6 },
  locMeta: { fontSize: 11, color: theme.colors.textMuted, marginTop: 2 },
  locOpen: { fontSize: 12, color: theme.colors.primary, fontWeight: '700', marginTop: 8 },
  locMeetupName: { fontSize: 15, fontWeight: '800', color: theme.colors.text, marginTop: 6 },
  locMeetupAddr: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2, lineHeight: 16 },
  quickReplyRow: { paddingHorizontal: 10, paddingVertical: 6, gap: 6, flexDirection: 'row' },
  quickReplyChip: {
    backgroundColor: theme.colors.primarySoft, borderWidth: 1, borderColor: theme.colors.primary,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, marginRight: 6,
  },
  quickReplyText: { color: theme.colors.primaryDark, fontWeight: '700', fontSize: 13 },
  quickReplyChipSaved: { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.primary, borderWidth: 1 },
  quickReplyAddChip: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderStyle: 'dashed' },
  savedReplyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: theme.colors.surface, borderRadius: theme.radius.md,
    padding: 12, marginBottom: 6,
  },
  safetyRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border,
  },
  safetyIcon: { fontSize: 24, marginRight: 14 },
  safetyLabel: { fontSize: 15, fontWeight: '800', color: theme.colors.text },
  safetyHint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 2 },
  reasonChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
  },
  reasonChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  reasonText: { fontSize: 13, fontWeight: '700', color: theme.colors.text },
  searchResult: {
    paddingVertical: 10, paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.border,
  },
  searchResultSender: { fontSize: 11, fontWeight: '800', color: theme.colors.accent, marginBottom: 2 },
  searchResultBody: { fontSize: 14, color: theme.colors.text },
});
