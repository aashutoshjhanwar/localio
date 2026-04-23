import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { encodeGeohash, distanceKm, neighborGeohashes } from '../utils/geo.js';
import { optionalAuth, type AuthedRequest } from '../middleware/auth.js';
import { blockedUserIds } from './blocks.js';

export const searchRouter = Router();

// GET /api/search?q=..&lat=..&lng=..&radiusKm=10
searchRouter.get('/', optionalAuth, async (req: AuthedRequest, res, next) => {
  try {
    const q = ((req.query.q as string) ?? '').trim();
    if (q.length < 1) return res.json({ listings: [], services: [], societies: [] });

    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
    const radiusKm = parseFloat((req.query.radiusKm as string) ?? '25');
    const category = ((req.query.category as string) ?? '').trim() || undefined;
    const minPrice = req.query.minPrice ? parseInt(req.query.minPrice as string, 10) : undefined;
    const maxPrice = req.query.maxPrice ? parseInt(req.query.maxPrice as string, 10) : undefined;
    const sort = (req.query.sort as string) ?? 'recent';
    const priceFilter: any = {};
    if (minPrice && !Number.isNaN(minPrice)) priceFilter.gte = minPrice;
    if (maxPrice && !Number.isNaN(maxPrice)) priceFilter.lte = maxPrice;

    // Attribute filters — JSON encoded spec, e.g. { fuel: "Petrol", year: { min: 2020 } }
    let attrFilter: Record<string, any> | null = null;
    if (req.query.attrs) {
      try {
        const parsed = JSON.parse(req.query.attrs as string);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) attrFilter = parsed;
      } catch { /* ignore malformed */ }
    }

    const geoWhere = lat !== undefined && lng !== undefined
      ? { geohash: { in: neighborGeohashes(encodeGeohash(lat, lng)) } }
      : {};

    const blocked = req.user ? await blockedUserIds(req.user.userId) : [];
    const sellerFilter = blocked.length ? { sellerId: { notIn: blocked } } : {};
    const providerFilter = blocked.length ? { providerId: { notIn: blocked } } : {};

    const [listings, services, societies] = await Promise.all([
      prisma.listing.findMany({
        where: {
          status: { in: ['active', 'reserved'] },
          ...geoWhere,
          ...sellerFilter,
          ...(category ? { category } : {}),
          ...(Object.keys(priceFilter).length ? { priceInPaise: priceFilter } : {}),
          OR: [{ title: { contains: q } }, { description: { contains: q } }, { category: { contains: q } }],
        },
        take: 60,
        orderBy: sort === 'priceAsc'
          ? { priceInPaise: 'asc' }
          : sort === 'priceDesc'
            ? { priceInPaise: 'desc' }
            : { createdAt: 'desc' },
        include: { seller: { select: { id: true, name: true, avatarUrl: true } } },
      }),
      prisma.service.findMany({
        where: {
          available: true,
          ...geoWhere,
          ...providerFilter,
          ...(category ? { category } : {}),
          OR: [{ title: { contains: q } }, { description: { contains: q } }, { category: { contains: q } }],
        },
        take: 30,
        orderBy: { ratingAvg: 'desc' },
        include: { provider: { select: { id: true, name: true, avatarUrl: true } } },
      }),
      prisma.society.findMany({
        where: { OR: [{ name: { contains: q } }, { city: { contains: q } }, { pincode: { contains: q } }] },
        take: 10,
      }),
    ]);

    const hydrate = (l: any) => ({ ...l, images: safeArr(l.images), attributes: safeObj(l.attributes) });
    let listingsOut: any[] = listings.map(hydrate);
    let servicesOut: any[] = services;

    if (attrFilter) {
      listingsOut = listingsOut.filter((l) => matchesAttrs(l.attributes, attrFilter!));
    }

    if (lat !== undefined && lng !== undefined) {
      listingsOut = listingsOut
        .map((l) => ({ ...l, distanceKm: distanceKm(lat, lng, l.lat, l.lng) }))
        .filter((l) => l.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);
      servicesOut = servicesOut
        .map((s) => ({ ...s, distanceKm: distanceKm(lat, lng, s.lat, s.lng) }))
        .filter((s) => s.distanceKm <= radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm);
    }

    res.json({ listings: listingsOut, services: servicesOut, societies });
  } catch (e) { next(e); }
});

function safeArr(s: string): string[] {
  try { const x = JSON.parse(s); return Array.isArray(x) ? x : []; } catch { return []; }
}
function safeObj(s: string | null): Record<string, any> | null {
  if (!s) return null;
  try { const x = JSON.parse(s); return x && typeof x === 'object' ? x : null; } catch { return null; }
}
function matchesAttrs(attrs: Record<string, any> | null, filter: Record<string, any>): boolean {
  if (!attrs) return false;
  for (const [key, want] of Object.entries(filter)) {
    const got = attrs[key];
    if (got == null) return false;
    if (want && typeof want === 'object' && !Array.isArray(want)) {
      // numeric range { min, max }
      const n = parseFloat(String(got));
      if (Number.isNaN(n)) return false;
      if (typeof want.min === 'number' && n < want.min) return false;
      if (typeof want.max === 'number' && n > want.max) return false;
    } else if (Array.isArray(want)) {
      // any-of
      if (!want.map(String).includes(String(got))) return false;
    } else {
      if (String(got).toLowerCase() !== String(want).toLowerCase()) return false;
    }
  }
  return true;
}
