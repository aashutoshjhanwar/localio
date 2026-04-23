import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const favoriteRouter = Router();

favoriteRouter.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { listingId } = z.object({ listingId: z.string() }).parse(req.body);
    const fav = await prisma.favorite.upsert({
      where: { userId_listingId: { userId: req.user!.userId, listingId } },
      update: {},
      create: { userId: req.user!.userId, listingId },
    });
    res.json({ favorite: fav });
  } catch (e) { next(e); }
});

favoriteRouter.delete('/:listingId', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await prisma.favorite.deleteMany({
      where: { userId: req.user!.userId, listingId: req.params.listingId },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

favoriteRouter.get('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const favs = await prisma.favorite.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
    });
    const listingIds = favs.map((f) => f.listingId);
    const listings = await prisma.listing.findMany({
      where: { id: { in: listingIds } },
      include: { seller: { select: { id: true, name: true, avatarUrl: true } } },
    });
    const hydrated = listings.map((l: any) => ({ ...l, images: safeArr(l.images) }));
    res.json({ favorites: hydrated });
  } catch (e) { next(e); }
});

favoriteRouter.post('/service', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { serviceId } = z.object({ serviceId: z.string() }).parse(req.body);
    const fav = await prisma.serviceFavorite.upsert({
      where: { userId_serviceId: { userId: req.user!.userId, serviceId } },
      update: {},
      create: { userId: req.user!.userId, serviceId },
    });
    res.json({ favorite: fav });
  } catch (e) { next(e); }
});

favoriteRouter.delete('/service/:serviceId', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await prisma.serviceFavorite.deleteMany({
      where: { userId: req.user!.userId, serviceId: req.params.serviceId },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

favoriteRouter.get('/services', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const favs = await prisma.serviceFavorite.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
    });
    const serviceIds = favs.map((f) => f.serviceId);
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds } },
      include: { provider: { select: { id: true, name: true, avatarUrl: true } } },
    });
    res.json({ favorites: services });
  } catch (e) { next(e); }
});

function safeArr(s: string): string[] {
  try { const x = JSON.parse(s); return Array.isArray(x) ? x : []; } catch { return []; }
}
