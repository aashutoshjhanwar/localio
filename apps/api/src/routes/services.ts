import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, optionalAuth, type AuthedRequest } from '../middleware/auth.js';
import { encodeGeohash, distanceKm, neighborGeohashes } from '../utils/geo.js';
import { blockedUserIds } from './blocks.js';
import { notifySavedSearchMatches } from './savedSearches.js';
import { pushToFollowers } from '../realtime/push.js';

export const serviceRouter = Router();

const createSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(5).max(4000),
  category: z.string().min(2),
  priceFrom: z.number().int().nonnegative().optional(),
  priceUnit: z.enum(['per_visit', 'per_hour', 'per_month', 'per_job']).optional(),
  lat: z.number(),
  lng: z.number(),
  societyId: z.string().optional(),
});

serviceRouter.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const d = createSchema.parse(req.body);
    const geohash = encodeGeohash(d.lat, d.lng);
    const service = await prisma.service.create({
      data: { ...d, providerId: req.user!.userId, geohash },
    });
    res.json({ service });
    pushToFollowers(req.user!.userId, {
      title: 'New service from someone you follow',
      body: service.title.slice(0, 80),
      type: 'follow_service',
      data: { serviceId: service.id },
    }).catch(() => {});
    notifySavedSearchMatches({
      kind: 'service', id: service.id, title: service.title, description: service.description,
      category: service.category, lat: service.lat, lng: service.lng, ownerId: service.providerId,
    }).catch(() => {});
  } catch (e) { next(e); }
});

serviceRouter.get('/', optionalAuth, async (req: AuthedRequest, res, next) => {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
    const radiusKm = parseFloat((req.query.radiusKm as string) ?? '10');
    const category = req.query.category as string | undefined;
    const q = req.query.q as string | undefined;

    const where: any = { available: true };
    if (category) where.category = category;
    if (q) where.OR = [{ title: { contains: q } }, { description: { contains: q } }];
    if (lat !== undefined && lng !== undefined) {
      where.geohash = { in: neighborGeohashes(encodeGeohash(lat, lng)) };
    }
    if (req.user) {
      const blocked = await blockedUserIds(req.user.userId);
      if (blocked.length) where.providerId = { notIn: blocked };
    }

    const items = await prisma.service.findMany({
      where,
      orderBy: [{ ratingAvg: 'desc' }, { createdAt: 'desc' }],
      take: 100,
      include: { provider: { select: { id: true, name: true, avatarUrl: true, trustScore: true, kycVerified: true } } },
    });

    let out: any[] = items;
    if (lat !== undefined && lng !== undefined) {
      out = items
        .map((s) => ({ ...s, distanceKm: distanceKm(lat, lng, s.lat, s.lng) }))
        .filter((s: any) => s.distanceKm <= radiusKm)
        .sort((a: any, b: any) => a.distanceKm - b.distanceKm);
    }
    res.json({ services: out });
  } catch (e) { next(e); }
});

serviceRouter.get('/:id', async (req, res, next) => {
  try {
    const s = await prisma.service.findUnique({
      where: { id: req.params.id },
      include: { provider: { select: { id: true, name: true, avatarUrl: true, trustScore: true, kycVerified: true } } },
    });
    if (!s) return res.status(404).json({ error: 'not_found' });
    res.json({ service: s });
  } catch (e) { next(e); }
});

serviceRouter.patch('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.service.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'not_found' });
    if (existing.providerId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });

    const patch = z.object({
      title: z.string().min(3).max(120).optional(),
      description: z.string().min(5).max(4000).optional(),
      priceFrom: z.number().int().nonnegative().optional(),
      priceUnit: z.string().optional(),
      available: z.boolean().optional(),
    }).parse(req.body);

    const updated = await prisma.service.update({ where: { id: existing.id }, data: patch });
    res.json({ service: updated });
  } catch (e) { next(e); }
});
