import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireAdmin, type AuthedRequest } from '../middleware/auth.js';
import { encodeGeohash, distanceKm, neighborGeohashes } from '../utils/geo.js';

export const meetupSpotRouter = Router();

// Nearby safe-meetup spots — any signed-in user can fetch.
meetupSpotRouter.get('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radiusKm = parseFloat((req.query.radiusKm as string) ?? '10');
    if (Number.isNaN(lat) || Number.isNaN(lng)) return res.status(400).json({ error: 'lat_lng_required' });

    const spots = await prisma.meetupSpot.findMany({
      where: { geohash: { in: neighborGeohashes(encodeGeohash(lat, lng)) } },
      take: 100,
    });
    const near = spots
      .map((s) => ({ ...s, distanceKm: distanceKm(lat, lng, s.lat, s.lng) }))
      .filter((s) => s.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 20);
    res.json({ spots: near });
  } catch (e) { next(e); }
});

meetupSpotRouter.post('/', requireAdmin, async (req: AuthedRequest, res, next) => {
  try {
    const d = z.object({
      name: z.string().min(2).max(120),
      address: z.string().min(3).max(300),
      lat: z.number(),
      lng: z.number(),
      kind: z.enum(['mall', 'police', 'metro', 'park', 'cafe', 'public']).default('public'),
    }).parse(req.body);
    const spot = await prisma.meetupSpot.create({
      data: { ...d, geohash: encodeGeohash(d.lat, d.lng), addedById: req.user!.userId },
    });
    res.json({ spot });
  } catch (e) { next(e); }
});

meetupSpotRouter.delete('/:id', requireAdmin, async (_req, res, next) => {
  try {
    await prisma.meetupSpot.delete({ where: { id: _req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
