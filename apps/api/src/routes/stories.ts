import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, optionalAuth, type AuthedRequest } from '../middleware/auth.js';
import { encodeGeohash, distanceKm, neighborGeohashes } from '../utils/geo.js';
import { blockedUserIds } from './blocks.js';

export const storyRouter = Router();

const STORY_TTL_MS = 24 * 3600 * 1000;

storyRouter.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const body = z.object({
      body: z.string().min(1).max(500),
      mediaUrl: z.string().url().optional(),
      lat: z.number(),
      lng: z.number(),
      societyId: z.string().optional(),
    }).parse(req.body);
    const story = await prisma.story.create({
      data: {
        userId: req.user!.userId,
        body: body.body,
        mediaUrl: body.mediaUrl,
        lat: body.lat,
        lng: body.lng,
        geohash: encodeGeohash(body.lat, body.lng),
        societyId: body.societyId,
        expiresAt: new Date(Date.now() + STORY_TTL_MS),
      },
    });
    res.json({ story });
  } catch (e) { next(e); }
});

// GET /api/stories?lat=..&lng=..&radiusKm=10  — grouped by user
storyRouter.get('/', optionalAuth, async (req: AuthedRequest, res, next) => {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
    const radiusKm = parseFloat((req.query.radiusKm as string) ?? '15');
    const blocked = req.user ? await blockedUserIds(req.user.userId) : [];

    const where: any = {
      expiresAt: { gt: new Date() },
    };
    if (lat !== undefined && lng !== undefined) {
      where.geohash = { in: neighborGeohashes(encodeGeohash(lat, lng)) };
    }
    if (blocked.length) where.userId = { notIn: blocked };

    const stories = await prisma.story.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });

    let filtered = stories;
    if (lat !== undefined && lng !== undefined) {
      filtered = stories.filter((s) => distanceKm(lat, lng, s.lat, s.lng) <= radiusKm);
    }

    const seen = req.user
      ? new Set((await prisma.storyView.findMany({
          where: { userId: req.user.userId, storyId: { in: filtered.map((s) => s.id) } },
          select: { storyId: true },
        })).map((v) => v.storyId))
      : new Set<string>();

    const byUser = new Map<string, { user: any; stories: any[]; hasUnseen: boolean; latestAt: string }>();
    for (const s of filtered) {
      const key = s.userId;
      if (!byUser.has(key)) {
        byUser.set(key, { user: s.user, stories: [], hasUnseen: false, latestAt: s.createdAt.toISOString() });
      }
      const grp = byUser.get(key)!;
      grp.stories.push({
        id: s.id,
        body: s.body,
        mediaUrl: s.mediaUrl,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        seen: seen.has(s.id),
      });
      if (!seen.has(s.id)) grp.hasUnseen = true;
    }

    const groups = Array.from(byUser.values()).sort((a, b) => {
      if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
      return new Date(b.latestAt).getTime() - new Date(a.latestAt).getTime();
    });

    res.json({ groups });
  } catch (e) { next(e); }
});

storyRouter.post('/:id/view', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await prisma.storyView.upsert({
      where: { storyId_userId: { storyId: req.params.id, userId: req.user!.userId } },
      update: {},
      create: { storyId: req.params.id, userId: req.user!.userId },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

storyRouter.delete('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const s = await prisma.story.findUnique({ where: { id: req.params.id } });
    if (!s) return res.status(404).json({ error: 'not_found' });
    if (s.userId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });
    await prisma.story.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

storyRouter.get('/:id/views', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const s = await prisma.story.findUnique({ where: { id: req.params.id } });
    if (!s) return res.status(404).json({ error: 'not_found' });
    if (s.userId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });
    const views = await prisma.storyView.findMany({
      where: { storyId: req.params.id },
      orderBy: { viewedAt: 'desc' },
      include: { story: false },
    });
    const userIds = views.map((v) => v.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, avatarUrl: true },
    });
    const map = new Map(users.map((u) => [u.id, u]));
    res.json({ views: views.map((v) => ({ user: map.get(v.userId) ?? null, viewedAt: v.viewedAt })) });
  } catch (e) { next(e); }
});
