import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { encodeGeohash } from '../utils/geo.js';

export const userRouter = Router();

// Update own profile
userRouter.patch('/me', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const d = z.object({
      name: z.string().min(1).max(80).optional(),
      bio: z.string().max(500).optional(),
      avatarUrl: z.string().url().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      societyId: z.string().nullable().optional(),
    }).parse(req.body);

    const data: any = { ...d };
    if (d.lat !== undefined && d.lng !== undefined) {
      data.geohash = encodeGeohash(d.lat, d.lng);
    }
    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data,
      include: { society: true },
    });
    res.json({ user });
  } catch (e) { next(e); }
});

// Notification preferences
const PREF_KEYS = ['chat', 'offer', 'wanted_match', 'wanted_lead', 'price_drop', 'saved_search_hit', 'follow', 'system'] as const;
type PrefKey = typeof PREF_KEYS[number];
const DEFAULT_PREFS: Record<PrefKey, boolean> = Object.fromEntries(PREF_KEYS.map((k) => [k, true])) as any;

userRouter.get('/me/prefs', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const u = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { notificationPrefs: true } });
    let prefs: Record<string, boolean> = { ...DEFAULT_PREFS };
    if (u?.notificationPrefs) {
      try { prefs = { ...prefs, ...JSON.parse(u.notificationPrefs) }; } catch { /* noop */ }
    }
    res.json({ prefs });
  } catch (e) { next(e); }
});

userRouter.patch('/me/prefs', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const d = z.record(z.string(), z.boolean()).parse(req.body);
    const existing = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { notificationPrefs: true } });
    let current: Record<string, boolean> = {};
    if (existing?.notificationPrefs) {
      try { current = JSON.parse(existing.notificationPrefs); } catch { /* noop */ }
    }
    const next = { ...current, ...d };
    await prisma.user.update({ where: { id: req.user!.userId }, data: { notificationPrefs: JSON.stringify(next) } });
    res.json({ prefs: { ...DEFAULT_PREFS, ...next } });
  } catch (e) { next(e); }
});

userRouter.get('/me/items', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const uid = req.user!.userId;
    const [listings, services] = await Promise.all([
      prisma.listing.findMany({
        where: { sellerId: uid },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.service.findMany({
        where: { providerId: uid },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const hydrated = listings.map((l) => {
      let images: string[] = [];
      try { const x = JSON.parse(l.images); if (Array.isArray(x)) images = x; } catch { /* noop */ }
      return { ...l, images };
    });
    res.json({ listings: hydrated, services });
  } catch (e) { next(e); }
});

userRouter.get('/:id/items', async (req, res, next) => {
  try {
    const [listings, services] = await Promise.all([
      prisma.listing.findMany({
        where: { sellerId: req.params.id, status: 'active' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.service.findMany({
        where: { providerId: req.params.id, available: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);
    const hydrated = listings.map((l) => {
      let images: string[] = [];
      try { const x = JSON.parse(l.images); if (Array.isArray(x)) images = x; } catch { /* noop */ }
      return { ...l, images };
    });
    res.json({ listings: hydrated, services });
  } catch (e) { next(e); }
});

userRouter.get('/:id', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true, name: true, avatarUrl: true, bio: true,
        trustScore: true, kycVerified: true, phoneVerified: true,
        createdAt: true, societyId: true, lastSeenAt: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'not_found' });

    const [listingCount, serviceCount, ratingAgg, soldCount, lastListing, lastMsg, recentMsgs] = await Promise.all([
      prisma.listing.count({ where: { sellerId: user.id, status: 'active' } }),
      prisma.service.count({ where: { providerId: user.id } }),
      prisma.rating.aggregate({
        where: { toId: user.id },
        _avg: { stars: true },
        _count: { stars: true },
      }),
      prisma.listing.count({ where: { sellerId: user.id, status: 'sold' } }),
      prisma.listing.findFirst({ where: { sellerId: user.id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      prisma.message.findFirst({ where: { senderId: user.id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
      prisma.message.findMany({
        where: { conversation: { members: { some: { userId: user.id } } } },
        orderBy: [{ conversationId: 'asc' }, { createdAt: 'asc' }],
        take: 500,
        select: { conversationId: true, senderId: true, createdAt: true },
      }),
    ]);

    const deltas: number[] = [];
    let prev: typeof recentMsgs[number] | null = null;
    for (const m of recentMsgs) {
      if (prev && prev.conversationId === m.conversationId && prev.senderId !== user.id && m.senderId === user.id) {
        const d = m.createdAt.getTime() - prev.createdAt.getTime();
        if (d > 0 && d < 72 * 3600 * 1000) deltas.push(d);
      }
      prev = m;
    }
    const avgResponseMins = deltas.length >= 3
      ? Math.round(deltas.reduce((a, b) => a + b, 0) / deltas.length / 60000)
      : null;

    const lastActiveAt = [lastListing?.createdAt, lastMsg?.createdAt, user.createdAt]
      .filter(Boolean)
      .sort((a, b) => (b!.getTime() - a!.getTime()))[0] ?? null;

    res.json({
      user: {
        ...user,
        stats: {
          listings: listingCount,
          services: serviceCount,
          listingsSold: soldCount,
          ratingAvg: ratingAgg._avg.stars ?? 0,
          ratingCount: ratingAgg._count.stars ?? 0,
          avgResponseMins,
          lastActiveAt,
        },
      },
    });
  } catch (e) { next(e); }
});
