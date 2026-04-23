import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { encodeGeohash, distanceKm, neighborGeohashes } from '../utils/geo.js';
import { optionalAuth, type AuthedRequest } from '../middleware/auth.js';
import { blockedUserIds } from './blocks.js';

export const feedRouter = Router();

// Unified hyperlocal feed: listings + services interleaved, ranked by distance + recency
feedRouter.get('/', optionalAuth, async (req: AuthedRequest, res, next) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radiusKm = parseFloat((req.query.radiusKm as string) ?? '10');
    const category = (req.query.category as string | undefined)?.trim() || undefined;
    if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: 'lat_lng_required' });

    // For wide scopes (city / country), skip geohash pre-filter so we can reach listings
    // anywhere — the distance filter below still clips to radiusKm.
    const skipGeoFilter = radiusKm >= 150;
    const hashes = skipGeoFilter ? null : neighborGeohashes(encodeGeohash(lat, lng));
    const blocked = req.user ? await blockedUserIds(req.user.userId) : [];
    const excludeUsers = blocked.length ? { notIn: blocked } : undefined;
    const hidden = req.user
      ? (await prisma.hiddenListing.findMany({ where: { userId: req.user.userId }, select: { listingId: true } })).map((r) => r.listingId)
      : [];

    const geoWhere = hashes ? { geohash: { in: hashes } } : {};
    const take = skipGeoFilter ? 300 : 100;
    const listingCutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const [listings, services] = await Promise.all([
      prisma.listing.findMany({
        where: {
          status: 'active', createdAt: { gte: listingCutoff }, ...geoWhere,
          ...(excludeUsers ? { sellerId: excludeUsers } : {}),
          ...(hidden.length ? { id: { notIn: hidden } } : {}),
          ...(category ? { category } : {}),
        },
        take,
        orderBy: { createdAt: 'desc' },
        include: { seller: { select: { id: true, name: true, avatarUrl: true, trustScore: true } } },
      }),
      prisma.service.findMany({
        where: {
          available: true, ...geoWhere,
          ...(excludeUsers ? { providerId: excludeUsers } : {}),
          ...(category ? { category } : {}),
        },
        take,
        orderBy: { createdAt: 'desc' },
        include: { provider: { select: { id: true, name: true, avatarUrl: true, trustScore: true } } },
      }),
    ]);

    const now = Date.now();
    const score = (d: number, createdAt: Date, rating = 0) => {
      const recencyHours = (now - createdAt.getTime()) / 3_600_000;
      // lower distance = better; fresher = better; rating boost
      return -d * 1.5 - Math.log1p(recencyHours) * 0.5 + rating * 0.3;
    };

    const items = [
      ...listings.map((l: any) => ({
        kind: 'listing' as const,
        id: l.id,
        data: { ...l, images: safeArr(l.images) },
        distanceKm: distanceKm(lat, lng, l.lat, l.lng),
        createdAt: l.createdAt,
        _score: 0,
      })),
      ...services.map((s: any) => ({
        kind: 'service' as const,
        id: s.id,
        data: s,
        distanceKm: distanceKm(lat, lng, s.lat, s.lng),
        createdAt: s.createdAt,
        _score: 0,
      })),
    ]
      .filter((i) => i.distanceKm <= radiusKm)
      .map((i) => ({
        ...i,
        _score: score(i.distanceKm, i.createdAt, (i.data as any).ratingAvg ?? 0),
      }))
      .sort((a, b) => b._score - a._score)
      .slice(0, 80);

    res.json({ feed: items });
  } catch (e) { next(e); }
});

function safeArr(s: string): string[] {
  try { const x = JSON.parse(s); return Array.isArray(x) ? x : []; } catch { return []; }
}
