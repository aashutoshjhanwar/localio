import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Image, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { Api } from '../api/client';
import { useAuth } from '../state/auth';
import { theme } from '../theme';
import { ReportModal } from '../components/ReportModal';
import type { RootStackParamList } from '../nav/RootNav';

type R = RouteProp<RootStackParamList, 'PostDetail'>;

export function PostDetailScreen() {
  const { params } = useRoute<R>();
  const nav = useNavigation<any>();
  const me = useAuth((s) => s.user);
  const [post, setPost] = useState<any>(null);
  const [upvoted, setUpvoted] = useState(false);
  const [likedSet, setLikedSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const load = async () => {
    try {
      const r = await Api.post(params.id);
      setPost(r.post); setUpvoted(r.upvoted);
      setLikedSet(new Set(r.likedCommentIds ?? []));
    } catch {} finally { setLoading(false); }
  };

  const toggleCommentLike = async (cId: string) => {
    const liked = likedSet.has(cId);
    const next = new Set(likedSet);
    if (liked) next.delete(cId); else next.add(cId);
    setLikedSet(next);
    setPost((p: any) => ({
      ...p,
      comments: p.comments.map((c: any) =>
        c.id === cId ? { ...c, likes: (c.likes ?? 0) + (liked ? -1 : 1) } : c,
      ),
    }));
    try {
      if (liked) await Api.unlikeComment(cId); else await Api.likeComment(cId);
    } catch {
      setLikedSet(likedSet);
    }
  };
  useEffect(() => { load(); }, [params.id]);

  const toggleVote = async () => {
    try {
      if (upvoted) { await Api.unvotePost(params.id); }
      else { await Api.upvotePost(params.id); }
      await load();
    } catch {}
  };
  const submit = async () => {
    if (!reply.trim() || sending) return;
    setSending(true);
    try {
      await Api.commentPost(params.id, reply.trim());
      setReply('');
      await load();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSending(false); }
  };
  const del = async () => {
    Alert.alert('Delete post?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try { await Api.deletePost(params.id); nav.goBack(); } catch (e: any) { Alert.alert('Error', e.message); }
      }},
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>;
  if (!post) return <View style={styles.center}><Text style={styles.meta}>Post not found.</Text></View>;

  const isAuthor = me?.id === post.authorId;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }} contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.kind}>{kindLabel(post.kind)}</Text>
        <Text style={styles.title}>{post.title}</Text>
        <Text style={styles.body}>{post.body}</Text>
        {Array.isArray(post.images) && post.images.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
            {post.images.map((u: string) => (
              <Image key={u} source={{ uri: u }} style={styles.photo} />
            ))}
          </ScrollView>
        )}

        <TouchableOpacity style={styles.author} onPress={() => nav.navigate('UserProfile', { id: post.author.id })}>
          {post.author.avatarUrl ? <Image source={{ uri: post.author.avatarUrl }} style={styles.avatar} /> : <View style={[styles.avatar, styles.avatarPh]}><Text>👤</Text></View>}
          <Text style={styles.authorName}>{post.author.name ?? 'Someone'}</Text>
          <Text style={styles.meta}>  · {new Date(post.createdAt).toLocaleString('en-IN')}</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
          <TouchableOpacity style={[styles.voteBtn, upvoted && styles.voteBtnOn]} onPress={toggleVote}>
            <Text style={[styles.voteText, upvoted && { color: '#fff' }]}>👍  {post.upvotes}</Text>
          </TouchableOpacity>
          {isAuthor ? (
            <TouchableOpacity style={[styles.voteBtn, { borderColor: theme.colors.danger }]} onPress={del}>
              <Text style={[styles.voteText, { color: theme.colors.danger }]}>Delete</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.voteBtn, { borderColor: theme.colors.textMuted }]} onPress={() => setReportOpen(true)}>
              <Text style={[styles.voteText, { color: theme.colors.textMuted }]}>🚩 Report</Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.section}>{post.comments?.length ?? 0} replies</Text>
        {post.comments?.map((c: any) => (
          <View key={c.id} style={styles.comment}>
            <TouchableOpacity onPress={() => nav.navigate('UserProfile', { id: c.author.id })}>
              {c.author.avatarUrl ? <Image source={{ uri: c.author.avatarUrl }} style={styles.avatarSm} /> : <View style={[styles.avatarSm, styles.avatarPh]}><Text style={{ fontSize: 12 }}>👤</Text></View>}
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.authorName}>{c.author.name ?? 'Someone'} <Text style={styles.meta}>· {new Date(c.createdAt).toLocaleString('en-IN')}</Text></Text>
              <Text style={styles.body}>{c.body}</Text>
              <TouchableOpacity onPress={() => toggleCommentLike(c.id)} style={{ marginTop: 6, alignSelf: 'flex-start' }}>
                <Text style={[styles.meta, likedSet.has(c.id) && { color: theme.colors.primary, fontWeight: '800' }]}>
                  {likedSet.has(c.id) ? '❤' : '🤍'}  {c.likes ?? 0}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>
      <ReportModal visible={reportOpen} onClose={() => setReportOpen(false)} targetType="post" targetId={post.id} />
      <View style={styles.replyRow}>
        <TextInput
          style={styles.replyInput}
          value={reply}
          onChangeText={setReply}
          placeholder="Write a reply…"
          placeholderTextColor={theme.colors.textMuted}
          multiline
        />
        <TouchableOpacity style={styles.sendBtn} onPress={submit} disabled={sending || !reply.trim()}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>{sending ? '…' : 'Send'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function kindLabel(k: string) {
  switch (k) {
    case 'question': return '❓ Question';
    case 'recommendation': return '⭐ Recommendation';
    case 'lost_found': return '🔎 Lost / Found';
    case 'announcement': return '📣 Announcement';
    case 'safety': return '⚠️ Safety alert';
    default: return k;
  }
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  meta: { color: theme.colors.textMuted, fontSize: 12 },
  kind: { color: theme.colors.primary, fontWeight: '800', fontSize: 13 },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.text, marginTop: 4 },
  body: { color: theme.colors.text, marginTop: 6, lineHeight: 21 },
  author: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.border },
  avatarSm: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.colors.border },
  avatarPh: { justifyContent: 'center', alignItems: 'center' },
  authorName: { fontWeight: '700', color: theme.colors.text, marginLeft: 8 },
  voteBtn: { borderWidth: 1, borderColor: theme.colors.primary, borderRadius: theme.radius.md, paddingHorizontal: 18, paddingVertical: 10 },
  voteBtnOn: { backgroundColor: theme.colors.primary },
  voteText: { color: theme.colors.primary, fontWeight: '800' },
  section: { marginTop: 22, marginBottom: 10, fontWeight: '800', color: theme.colors.text },
  comment: { flexDirection: 'row', backgroundColor: theme.colors.surface, borderRadius: theme.radius.md, padding: 10, marginBottom: 8 },
  replyRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 10, borderTopWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.bg, gap: 8 },
  replyInput: { flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: 10, maxHeight: 120, backgroundColor: theme.colors.surface, color: theme.colors.text },
  sendBtn: { backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: theme.radius.md },
  photo: { width: 200, height: 200, borderRadius: theme.radius.md, marginRight: 8, backgroundColor: theme.colors.surface },
});
