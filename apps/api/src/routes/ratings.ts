import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const ratingRouter = Router();

ratingRouter.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const d = z.object({
      toId: z.string(),
      context: z.enum(['listing', 'service']),
      contextId: z.string(),
      stars: z.number().int().min(1).max(5),
      review: z.string().max(1000).optional(),
      photoUrls: z.array(z.string().url()).max(3).optional(),
    }).parse(req.body);

    if (d.toId === req.user!.userId) return res.status(400).json({ error: 'cannot_rate_self' });

    const photoUrlsJson = d.photoUrls && d.photoUrls.length ? JSON.stringify(d.photoUrls) : null;
    const rating = await prisma.rating.upsert({
      where: { fromId_context_contextId: { fromId: req.user!.userId, context: d.context, contextId: d.contextId } },
      update: { stars: d.stars, review: d.review, photoUrls: photoUrlsJson },
      create: {
        fromId: req.user!.userId,
        toId: d.toId, context: d.context, contextId: d.contextId,
        stars: d.stars, review: d.review, photoUrls: photoUrlsJson,
      },
    });

    // Recompute aggregate for service (if applicable)
    if (d.context === 'service') {
      const agg = await prisma.rating.aggregate({
        where: { context: 'service', contextId: d.contextId },
        _avg: { stars: true },
        _count: { stars: true },
      });
      await prisma.service.update({
        where: { id: d.contextId },
        data: {
          ratingAvg: agg._avg.stars ?? 0,
          ratingCount: agg._count.stars ?? 0,
        },
      });
    }

    // Recompute trust score for the rated user (simple: avg of all ratings)
    const userAgg = await prisma.rating.aggregate({
      where: { toId: d.toId },
      _avg: { stars: true },
      _count: { stars: true },
    });
    const trustScore = (userAgg._avg.stars ?? 0) * Math.min(1, (userAgg._count.stars ?? 0) / 10);
    await prisma.user.update({ where: { id: d.toId }, data: { trustScore } });

    res.json({ rating: hydrate(rating) });
  } catch (e) { next(e); }
});

function hydrate(r: any) {
  let photos: string[] = [];
  if (r.photoUrls) { try { const x = JSON.parse(r.photoUrls); if (Array.isArray(x)) photos = x; } catch {} }
  return { ...r, photoUrls: photos };
}

ratingRouter.get('/service/:id', async (req, res, next) => {
  try {
    const ratings = await prisma.rating.findMany({
      where: { context: 'service', contextId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { from: { select: { id: true, name: true, avatarUrl: true } } },
    });
    res.json({ ratings: ratings.map(hydrate) });
  } catch (e) { next(e); }
});

ratingRouter.get('/listing/:id', async (req, res, next) => {
  try {
    const ratings = await prisma.rating.findMany({
      where: { context: 'listing', contextId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { from: { select: { id: true, name: true, avatarUrl: true } } },
    });
    res.json({ ratings: ratings.map(hydrate) });
  } catch (e) { next(e); }
});

ratingRouter.get('/user/:id', async (req, res, next) => {
  try {
    const ratings = await prisma.rating.findMany({
      where: { toId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { from: { select: { id: true, name: true, avatarUrl: true } } },
    });
    res.json({ ratings: ratings.map(hydrate) });
  } catch (e) { next(e); }
});
