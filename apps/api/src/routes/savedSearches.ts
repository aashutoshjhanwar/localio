import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { encodeGeohash, distanceKm } from '../utils/geo.js';
import { pushToUser } from '../realtime/push.js';

export const savedSearchRouter = Router();

const createSchema = z.object({
  label: z.string().min(2).max(60),
  q: z.string().optional(),
  category: z.string().optional(),
  kind: z.enum(['listing', 'service', 'both']).default('both'),
  lat: z.number(),
  lng: z.number(),
  radiusKm: z.number().min(1).max(5000).default(10),
});

savedSearchRouter.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const d = createSchema.parse(req.body);
    const existing = await prisma.savedSearch.findFirst({
      where: {
        userId: req.user!.userId,
        label: d.label,
        kind: d.kind,
        q: d.q ?? null,
        category: d.category ?? null,
      },
    });
    if (existing) return res.json({ savedSearch: existing });
    const saved = await prisma.savedSearch.create({
      data: {
        userId: req.user!.userId,
        label: d.label,
        q: d.q ?? null,
        category: d.category ?? null,
        kind: d.kind,
        lat: d.lat, lng: d.lng,
        geohash: encodeGeohash(d.lat, d.lng),
        radiusKm: d.radiusKm,
      },
    });
    res.json({ savedSearch: saved });
  } catch (e) { next(e); }
});

savedSearchRouter.get('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const rows = await prisma.savedSearch.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
    });

    const annotated = await Promise.all(rows.map(async (s) => {
      const since = s.lastNotifiedAt ?? s.createdAt;
      const lookup: any = { createdAt: { gt: since } };
      if (s.q) lookup.OR = [
        { title: { contains: s.q } },
        { description: { contains: s.q } },
      ];
      if (s.category) lookup.category = s.category;
      const [listings, services] = await Promise.all([
        s.kind === 'service' ? Promise.resolve([]) : prisma.listing.findMany({
          where: lookup, select: { id: true, lat: true, lng: true }, take: 200,
        }),
        s.kind === 'listing' ? Promise.resolve([]) : prisma.service.findMany({
          where: lookup, select: { id: true, lat: true, lng: true }, take: 200,
        }),
      ]);
      const inRadius = [...listings, ...services].filter((i) => distanceKm(s.lat, s.lng, i.lat, i.lng) <= s.radiusKm);
      return { ...s, newMatchCount: inRadius.length };
    }));

    res.json({ savedSearches: annotated });
  } catch (e) { next(e); }
});

// Mark a saved search as seen — clears its unread count
savedSearchRouter.post('/:id/seen', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await prisma.savedSearch.updateMany({
      where: { id: req.params.id, userId: req.user!.userId },
      data: { lastNotifiedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

savedSearchRouter.delete('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await prisma.savedSearch.deleteMany({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Check saved searches against a newly created item and notify matches.
// Called from listings + services routes after a successful create.
export async function notifySavedSearchMatches(params: {
  kind: 'listing' | 'service';
  title: string;
  description: string;
  category: string;
  lat: number;
  lng: number;
  id: string;
  ownerId: string;
}): Promise<void> {
  const text = `${params.title} ${params.description}`.toLowerCase();
  const searches = await prisma.savedSearch.findMany({
    where: {
      userId: { not: params.ownerId },
      OR: [{ kind: params.kind }, { kind: 'both' }],
    },
    take: 500,
  });

  for (const s of searches) {
    if (s.category && s.category !== params.category) continue;
    if (s.q && !text.includes(s.q.toLowerCase())) continue;
    const d = distanceKm(s.lat, s.lng, params.lat, params.lng);
    if (d > s.radiusKm) continue;

    await pushToUser(s.userId, {
      title: `New match: ${s.label}`,
      body: `${params.title} · ${d.toFixed(1)} km away`,
      type: 'saved_search',
      data: { kind: params.kind, id: params.id, savedSearchId: s.id },
    });
    await prisma.savedSearch.update({
      where: { id: s.id },
      data: { lastNotifiedAt: new Date() },
    });
  }
}
