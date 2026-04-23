import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, optionalAuth, type AuthedRequest } from '../middleware/auth.js';
import { encodeGeohash, distanceKm, neighborGeohashes } from '../utils/geo.js';
import { blockedUserIds } from './blocks.js';
import { pushToUser, pushToUsers, pushToFollowers } from '../realtime/push.js';

export const postRouter = Router();

const KINDS = ['question', 'recommendation', 'lost_found', 'announcement', 'safety'] as const;
const SAFETY_RADIUS_KM = 3;

const createSchema = z.object({
  kind: z.enum(KINDS),
  title: z.string().min(3).max(200),
  body: z.string().min(3).max(4000),
  lat: z.number(),
  lng: z.number(),
  images: z.array(z.string().url()).max(6).optional(),
});

function parseImages(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch { return []; }
}
function withImages<T extends { images?: string | null }>(p: T): T & { images: string[] } {
  return { ...p, images: parseImages(p.images) };
}

postRouter.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const d = createSchema.parse(req.body);
    const post = await prisma.post.create({
      data: {
        authorId: req.user!.userId,
        kind: d.kind, title: d.title, body: d.body,
        images: d.images?.length ? JSON.stringify(d.images) : null,
        lat: d.lat, lng: d.lng, geohash: encodeGeohash(d.lat, d.lng),
      },
    });
    pushToFollowers(req.user!.userId, {
      title: 'New post from someone you follow',
      body: post.title.slice(0, 80),
      type: 'follow_post',
      data: { postId: post.id },
    }).catch(() => {});

    if (post.kind === 'safety') {
      broadcastSafety(post, req.user!.userId).catch(() => {});
    }
    res.json({ post: withImages(post) });
  } catch (e) { next(e); }
});

async function broadcastSafety(post: { id: string; title: string; lat: number; lng: number; geohash: string }, authorId: string) {
  const candidates = await prisma.user.findMany({
    where: {
      id: { not: authorId },
      geohash: { in: neighborGeohashes(post.geohash) },
      lat: { not: null },
      lng: { not: null },
    },
    select: { id: true, lat: true, lng: true },
  });
  const nearIds = candidates
    .filter((u) => distanceKm(post.lat, post.lng, u.lat!, u.lng!) <= SAFETY_RADIUS_KM)
    .map((u) => u.id);
  if (!nearIds.length) return;
  await pushToUsers(nearIds, {
    title: '⚠️ Safety alert near you',
    body: post.title.slice(0, 120),
    type: 'safety_alert',
    data: { postId: post.id },
  });
}

postRouter.get('/', optionalAuth, async (req: AuthedRequest, res, next) => {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
    const radiusKm = parseFloat((req.query.radiusKm as string) ?? '15');
    const kind = req.query.kind as string | undefined;

    const where: any = {};
    if (kind && (KINDS as readonly string[]).includes(kind)) where.kind = kind;
    if (lat !== undefined && lng !== undefined) {
      where.geohash = { in: neighborGeohashes(encodeGeohash(lat, lng)) };
    }
    if (req.user) {
      const blocked = await blockedUserIds(req.user.userId);
      if (blocked.length) where.authorId = { notIn: blocked };
    }

    const rows = await prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, trustScore: true } },
        _count: { select: { comments: true, votes: true } },
      },
    });
    let out: any[] = rows.map(withImages);
    if (lat !== undefined && lng !== undefined) {
      out = out
        .map((p: any) => ({ ...p, distanceKm: distanceKm(lat, lng, p.lat, p.lng) }))
        .filter((p: any) => p.distanceKm <= radiusKm);
    }
    res.json({ posts: out });
  } catch (e) { next(e); }
});

postRouter.get('/:id', optionalAuth, async (req: AuthedRequest, res, next) => {
  try {
    const post = await prisma.post.findUnique({
      where: { id: req.params.id },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true, trustScore: true } },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, name: true, avatarUrl: true } } },
        },
        _count: { select: { votes: true } },
      },
    });
    if (!post) return res.status(404).json({ error: 'not_found' });
    const myVote = req.user
      ? await prisma.postVote.findUnique({ where: { postId_userId: { postId: post.id, userId: req.user.userId } } })
      : null;
    let likedCommentIds: string[] = [];
    if (req.user && post.comments.length) {
      const likes = await prisma.postCommentVote.findMany({
        where: {
          userId: req.user.userId,
          commentId: { in: post.comments.map((c) => c.id) },
        },
        select: { commentId: true },
      });
      likedCommentIds = likes.map((l) => l.commentId);
    }
    res.json({ post: withImages(post), upvoted: !!myVote, likedCommentIds });
  } catch (e) { next(e); }
});

postRouter.post('/:id/comments', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { body } = z.object({ body: z.string().min(1).max(4000) }).parse(req.body);
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'not_found' });

    const comment = await prisma.postComment.create({
      data: { postId: post.id, authorId: req.user!.userId, body },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });

    if (post.authorId !== req.user!.userId) {
      pushToUser(post.authorId, {
        title: 'New reply on your post',
        body: `${comment.author.name ?? 'Someone'} on "${post.title.slice(0, 40)}"`,
        type: 'post_comment',
        data: { postId: post.id },
      }).catch(() => {});
    }
    res.json({ comment });
  } catch (e) { next(e); }
});

postRouter.post('/:id/upvote', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'not_found' });
    await prisma.postVote.upsert({
      where: { postId_userId: { postId: post.id, userId: req.user!.userId } },
      update: {},
      create: { postId: post.id, userId: req.user!.userId },
    });
    await prisma.post.update({
      where: { id: post.id },
      data: { upvotes: await prisma.postVote.count({ where: { postId: post.id } }) },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

postRouter.delete('/:id/upvote', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await prisma.postVote.deleteMany({ where: { postId: req.params.id, userId: req.user!.userId } });
    const count = await prisma.postVote.count({ where: { postId: req.params.id } });
    await prisma.post.update({ where: { id: req.params.id }, data: { upvotes: count } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

postRouter.post('/comments/:id/like', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const comment = await prisma.postComment.findUnique({ where: { id: req.params.id } });
    if (!comment) return res.status(404).json({ error: 'not_found' });
    await prisma.postCommentVote.upsert({
      where: { commentId_userId: { commentId: comment.id, userId: req.user!.userId } },
      update: {},
      create: { commentId: comment.id, userId: req.user!.userId },
    });
    const likes = await prisma.postCommentVote.count({ where: { commentId: comment.id } });
    await prisma.postComment.update({ where: { id: comment.id }, data: { likes } });
    res.json({ likes });
  } catch (e) { next(e); }
});

postRouter.delete('/comments/:id/like', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await prisma.postCommentVote.deleteMany({
      where: { commentId: req.params.id, userId: req.user!.userId },
    });
    const likes = await prisma.postCommentVote.count({ where: { commentId: req.params.id } });
    await prisma.postComment.update({ where: { id: req.params.id }, data: { likes } });
    res.json({ likes });
  } catch (e) { next(e); }
});

postRouter.delete('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const post = await prisma.post.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: 'not_found' });
    if (post.authorId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });
    await prisma.post.delete({ where: { id: post.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
