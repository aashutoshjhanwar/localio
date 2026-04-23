import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, optionalAuth, type AuthedRequest } from '../middleware/auth.js';
import { encodeGeohash, distanceKm, neighborGeohashes } from '../utils/geo.js';
import { blockedUserIds } from './blocks.js';
import { pushToUser } from '../realtime/push.js';
import { notifyListingMatchesForWanted } from '../services/wantedMatch.js';

export const wantedRouter = Router();

const createSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(5).max(2000),
  category: z.string().min(2),
  maxBudgetPaise: z.number().int().nonnegative().optional(),
  lat: z.number(),
  lng: z.number(),
});

wantedRouter.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const d = createSchema.parse(req.body);
    const w = await prisma.wanted.create({
      data: {
        buyerId: req.user!.userId,
        title: d.title,
        description: d.description,
        category: d.category,
        maxBudgetPaise: d.maxBudgetPaise,
        lat: d.lat,
        lng: d.lng,
        geohash: encodeGeohash(d.lat, d.lng),
      },
    });
    res.json({ wanted: w });
    notifyListingMatchesForWanted({
      id: w.id, buyerId: w.buyerId, title: w.title, category: w.category,
      maxBudgetPaise: w.maxBudgetPaise, lat: w.lat, lng: w.lng, geohash: w.geohash,
    }).catch(() => {});
  } catch (e) { next(e); }
});

wantedRouter.get('/', optionalAuth, async (req: AuthedRequest, res, next) => {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
    const radiusKm = parseFloat((req.query.radiusKm as string) ?? '15');
    const category = req.query.category as string | undefined;

    const where: any = { status: 'open' };
    if (category) where.category = category;
    if (lat !== undefined && lng !== undefined) {
      where.geohash = { in: neighborGeohashes(encodeGeohash(lat, lng)) };
    }
    if (req.user) {
      const blocked = await blockedUserIds(req.user.userId);
      if (blocked.length) where.buyerId = { notIn: blocked };
    }

    const rows = await prisma.wanted.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { buyer: { select: { id: true, name: true, avatarUrl: true, trustScore: true, kycVerified: true } } },
    });
    let out: any[] = rows;
    if (lat !== undefined && lng !== undefined) {
      out = out
        .map((w) => ({ ...w, distanceKm: distanceKm(lat, lng, w.lat, w.lng) }))
        .filter((w) => w.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    }
    res.json({ wanted: out });
  } catch (e) { next(e); }
});

wantedRouter.get('/mine', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const rows = await prisma.wanted.findMany({
      where: { buyerId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ wanted: rows });
  } catch (e) { next(e); }
});

wantedRouter.get('/:id', async (req, res, next) => {
  try {
    const w = await prisma.wanted.findUnique({
      where: { id: req.params.id },
      include: { buyer: { select: { id: true, name: true, avatarUrl: true, trustScore: true, kycVerified: true } } },
    });
    if (!w) return res.status(404).json({ error: 'not_found' });
    res.json({ wanted: w });
  } catch (e) { next(e); }
});

wantedRouter.post('/:id/respond', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const w = await prisma.wanted.findUnique({ where: { id: req.params.id } });
    if (!w) return res.status(404).json({ error: 'not_found' });
    if (w.status !== 'open') return res.status(400).json({ error: 'closed' });
    if (w.buyerId === req.user!.userId) return res.status(400).json({ error: 'cannot_respond_own' });

    const existing = await prisma.conversation.findFirst({
      where: {
        type: 'direct',
        members: { every: { userId: { in: [req.user!.userId, w.buyerId] } } },
      },
      include: { members: true },
    });
    const conv = existing && existing.members.length === 2
      ? existing
      : await prisma.conversation.create({
          data: {
            type: 'direct',
            members: { create: [{ userId: req.user!.userId }, { userId: w.buyerId }] },
          },
        });

    const seed = `Re: your request "${w.title.slice(0, 60)}" — I can help.`;
    await prisma.message.create({
      data: { conversationId: conv.id, senderId: req.user!.userId, type: 'text', body: seed },
    });

    pushToUser(w.buyerId, {
      title: 'Someone can help with your request',
      body: w.title.slice(0, 80),
      type: 'wanted_reply',
      data: { conversationId: conv.id, wantedId: w.id },
    }).catch(() => {});

    res.json({ conversation: { id: conv.id } });
  } catch (e) { next(e); }
});

wantedRouter.post('/:id/close', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const w = await prisma.wanted.findUnique({ where: { id: req.params.id } });
    if (!w) return res.status(404).json({ error: 'not_found' });
    if (w.buyerId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });
    const updated = await prisma.wanted.update({ where: { id: w.id }, data: { status: 'closed' } });
    res.json({ wanted: updated });
  } catch (e) { next(e); }
});
