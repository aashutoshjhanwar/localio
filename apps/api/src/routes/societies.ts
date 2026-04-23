import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { encodeGeohash, distanceKm, neighborGeohashes } from '../utils/geo.js';

export const societyRouter = Router();

const createSchema = z.object({
  name: z.string().min(2),
  city: z.string().min(2),
  pincode: z.string().min(4),
  address: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
});

societyRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const d = createSchema.parse(req.body);
    const geohash = encodeGeohash(d.lat, d.lng);
    const society = await prisma.society.create({
      data: { ...d, geohash },
    });
    res.json({ society });
  } catch (e) { next(e); }
});

// GET /api/societies/nearby?lat=..&lng=..&radiusKm=5
societyRouter.get('/nearby', async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radiusKm = parseFloat((req.query.radiusKm as string) ?? '5');
    if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: 'lat_lng_required' });

    const hash = encodeGeohash(lat, lng);
    const candidates = await prisma.society.findMany({
      where: { geohash: { in: neighborGeohashes(hash) } },
      take: 200,
    });
    const results = candidates
      .map((s) => ({ ...s, distanceKm: distanceKm(lat, lng, s.lat, s.lng) }))
      .filter((s) => s.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
    res.json({ societies: results });
  } catch (e) { next(e); }
});

societyRouter.get('/:id', async (req, res, next) => {
  try {
    const society = await prisma.society.findUnique({
      where: { id: req.params.id },
      include: { groups: true },
    });
    if (!society) return res.status(404).json({ error: 'not_found' });
    res.json({ society });
  } catch (e) { next(e); }
});

societyRouter.post('/:id/join', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const society = await prisma.society.findUnique({ where: { id: req.params.id } });
    if (!society) return res.status(404).json({ error: 'not_found' });
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { societyId: society.id },
    });
    await prisma.society.update({
      where: { id: society.id },
      data: { memberCount: { increment: 1 } },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
