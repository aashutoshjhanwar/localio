import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, optionalAuth, type AuthedRequest } from '../middleware/auth.js';
import { encodeGeohash, distanceKm, neighborGeohashes } from '../utils/geo.js';
import { blockedUserIds } from './blocks.js';
import { notifySavedSearchMatches } from './savedSearches.js';
import { pushToFollowers, pushToUser } from '../realtime/push.js';
import { notifyWantedMatchesForListing } from '../services/wantedMatch.js';

export const listingRouter = Router();

export const LISTING_TTL_DAYS = 30;
const listingTtlCutoff = () => new Date(Date.now() - LISTING_TTL_DAYS * 24 * 3600 * 1000);

async function hiddenListingIds(userId: string): Promise<string[]> {
  const rows = await prisma.hiddenListing.findMany({ where: { userId }, select: { listingId: true } });
  return rows.map((r) => r.listingId);
}

const createSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(5).max(4000),
  category: z.string().min(2),
  priceInPaise: z.number().int().nonnegative(),
  negotiable: z.boolean().optional(),
  lat: z.number(),
  lng: z.number(),
  societyId: z.string().optional(),
  images: z.array(z.string().url()).max(10).default([]),
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

listingRouter.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const d = createSchema.parse(req.body);
    const geohash = encodeGeohash(d.lat, d.lng);
    const listing = await prisma.listing.create({
      data: {
        sellerId: req.user!.userId,
        title: d.title,
        description: d.description,
        category: d.category,
        priceInPaise: d.priceInPaise,
        negotiable: d.negotiable ?? true,
        lat: d.lat,
        lng: d.lng,
        geohash,
        societyId: d.societyId,
        images: JSON.stringify(d.images),
        attributes: d.attributes ? JSON.stringify(d.attributes) : null,
      },
    });
    res.json({ listing: hydrate(listing) });
    pushToFollowers(req.user!.userId, {
      title: 'New listing from someone you follow',
      body: listing.title.slice(0, 80),
      type: 'follow_listing',
      data: { listingId: listing.id },
    }).catch(() => {});
    notifySavedSearchMatches({
      kind: 'listing', id: listing.id, title: listing.title, description: listing.description,
      category: listing.category, lat: listing.lat, lng: listing.lng, ownerId: listing.sellerId,
    }).catch(() => {});
    notifyWantedMatchesForListing({
      id: listing.id, sellerId: listing.sellerId, title: listing.title, category: listing.category,
      priceInPaise: listing.priceInPaise, lat: listing.lat, lng: listing.lng, geohash: listing.geohash,
    }).catch(() => {});
  } catch (e) { next(e); }
});

// GET /api/listings?lat=..&lng=..&radiusKm=5&category=&q=&societyId=
listingRouter.get('/', optionalAuth, async (req: AuthedRequest, res, next) => {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
    const radiusKm = parseFloat((req.query.radiusKm as string) ?? '10');
    const category = req.query.category as string | undefined;
    const q = req.query.q as string | undefined;
    const societyId = req.query.societyId as string | undefined;

    const where: any = { status: { in: ['active', 'reserved'] }, createdAt: { gte: listingTtlCutoff() } };
    if (category) where.category = category;
    if (societyId) where.societyId = societyId;
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { description: { contains: q } },
      ];
    }
    if (lat !== undefined && lng !== undefined) {
      where.geohash = { in: neighborGeohashes(encodeGeohash(lat, lng)) };
    }
    if (req.user) {
      const [blocked, hidden] = await Promise.all([
        blockedUserIds(req.user.userId),
        hiddenListingIds(req.user.userId),
      ]);
      if (blocked.length) where.sellerId = { notIn: blocked };
      if (hidden.length) where.id = { notIn: hidden };
    }

    const items = await prisma.listing.findMany({
      where,
      orderBy: [{ featured: 'desc' }, { bumpedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 100,
      include: { seller: { select: { id: true, name: true, avatarUrl: true, trustScore: true, kycVerified: true } } },
    });

    const now = new Date();
    const expired = items.filter((i) => i.featured && i.featuredUntil && i.featuredUntil < now).map((i) => i.id);
    if (expired.length) {
      prisma.listing.updateMany({ where: { id: { in: expired } }, data: { featured: false } }).catch(() => {});
    }
    const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const recentDrops = await prisma.listingPriceChange.findMany({
      where: { listingId: { in: items.map((i) => i.id) }, changedAt: { gte: since7d } },
      orderBy: { changedAt: 'desc' },
    });
    const dropMap = new Map<string, { oldPriceInPaise: number; newPriceInPaise: number; changedAt: Date }>();
    for (const r of recentDrops) {
      if (!dropMap.has(r.listingId) && r.newPriceInPaise < r.oldPriceInPaise) {
        dropMap.set(r.listingId, { oldPriceInPaise: r.oldPriceInPaise, newPriceInPaise: r.newPriceInPaise, changedAt: r.changedAt });
      }
    }
    let out = items.map((i) => {
      const drop = dropMap.get(i.id);
      return hydrate({
        ...i,
        featured: expired.includes(i.id) ? false : i.featured,
        recentlyReduced: !!drop,
        previousPriceInPaise: drop?.oldPriceInPaise,
      });
    });
    if (lat !== undefined && lng !== undefined) {
      out = out
        .map((l: any) => ({ ...l, distanceKm: distanceKm(lat, lng, l.lat, l.lng) }))
        .filter((l: any) => l.distanceKm <= radiusKm)
        .sort((a: any, b: any) => a.distanceKm - b.distanceKm);
    }
    res.json({ listings: out });
  } catch (e) { next(e); }
});

// Price hint for a category near a point — surfaces p25/p50/p75 so sellers price well.
listingRouter.get('/price-hint', async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const category = req.query.category as string | undefined;
    const radiusKm = parseFloat((req.query.radiusKm as string) ?? '25');
    if (!category || Number.isNaN(lat) || Number.isNaN(lng)) return res.status(400).json({ error: 'bad_params' });

    const candidates = await prisma.listing.findMany({
      where: {
        category,
        status: { in: ['active', 'sold'] },
        geohash: { in: neighborGeohashes(encodeGeohash(lat, lng)) },
      },
      select: { priceInPaise: true, lat: true, lng: true },
      take: 500,
    });
    const prices = candidates
      .filter((l) => distanceKm(lat, lng, l.lat, l.lng) <= radiusKm)
      .map((l) => l.priceInPaise)
      .filter((p) => p > 0)
      .sort((a, b) => a - b);
    if (prices.length < 5) return res.json({ hint: null });
    const q = (f: number) => prices[Math.min(prices.length - 1, Math.floor(prices.length * f))];
    res.json({ hint: { p25: q(0.25), p50: q(0.5), p75: q(0.75), sampleSize: prices.length } });
  } catch (e) { next(e); }
});

// Hot listings near a point — score mixes views, saves, offers. Must precede /:id.
listingRouter.get('/trending', optionalAuth, async (req: AuthedRequest, res, next) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radiusKm = parseFloat((req.query.radiusKm as string) ?? '15');
    const limit = Math.min(parseInt((req.query.limit as string) ?? '10', 10) || 10, 20);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return res.status(400).json({ error: 'lat_lng_required' });

    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000);
    const where: any = {
      status: 'active',
      createdAt: { gte: since },
      geohash: { in: neighborGeohashes(encodeGeohash(lat, lng)) },
    };
    if (req.user) {
      const [blocked, hidden] = await Promise.all([
        blockedUserIds(req.user.userId),
        hiddenListingIds(req.user.userId),
      ]);
      if (blocked.length) where.sellerId = { notIn: blocked };
      if (hidden.length) where.id = { notIn: hidden };
    }
    const candidates = await prisma.listing.findMany({
      where,
      take: 200,
      include: { seller: { select: { id: true, name: true, avatarUrl: true, trustScore: true, kycVerified: true } } },
    });
    const near = candidates
      .map((l) => ({ ...l, distanceKm: distanceKm(lat, lng, l.lat, l.lng) }))
      .filter((l) => l.distanceKm <= radiusKm);
    if (near.length === 0) return res.json({ listings: [] });

    const ids = near.map((l) => l.id);
    const [favAgg, offerAgg] = await Promise.all([
      prisma.favorite.groupBy({ by: ['listingId'], _count: { _all: true }, where: { listingId: { in: ids } } }),
      prisma.offer.groupBy({ by: ['listingId'], _count: { _all: true }, where: { listingId: { in: ids } } }),
    ]);
    const favMap = new Map(favAgg.map((r) => [r.listingId, r._count._all]));
    const offMap = new Map(offerAgg.map((r) => [r.listingId, r._count._all]));

    const scored = near.map((l) => {
      const favs = favMap.get(l.id) ?? 0;
      const offs = offMap.get(l.id) ?? 0;
      const boost = l.featured && l.featuredUntil && l.featuredUntil > new Date() ? 1.25 : 1;
      const score = (l.views + 3 * favs + 5 * offs) * boost;
      return { ...hydrate(l), distanceKm: l.distanceKm, score, favoritesCount: favs, offersCount: offs };
    }).sort((a, b) => b.score - a.score).slice(0, limit);

    res.json({ listings: scored });
  } catch (e) { next(e); }
});

// Price-drop deals nearby — listings whose price fell in the last 14 days, sorted by % off.
listingRouter.get('/deals', optionalAuth, async (req: AuthedRequest, res, next) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radiusKm = parseFloat((req.query.radiusKm as string) ?? '15');
    const limit = Math.min(parseInt((req.query.limit as string) ?? '30', 10) || 30, 60);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return res.status(400).json({ error: 'lat_lng_required' });

    const since = new Date(Date.now() - 14 * 24 * 3600 * 1000);
    const drops = await prisma.listingPriceChange.findMany({
      where: { changedAt: { gte: since } },
      orderBy: { changedAt: 'desc' },
      take: 500,
    });
    if (drops.length === 0) return res.json({ listings: [] });

    const byListing = new Map<string, { old: number; new: number; changedAt: Date }>();
    for (const d of drops) {
      if (d.newPriceInPaise >= d.oldPriceInPaise) continue;
      if (!byListing.has(d.listingId)) {
        byListing.set(d.listingId, { old: d.oldPriceInPaise, new: d.newPriceInPaise, changedAt: d.changedAt });
      }
    }
    if (byListing.size === 0) return res.json({ listings: [] });

    const where: any = {
      id: { in: Array.from(byListing.keys()) },
      status: 'active',
      geohash: { in: neighborGeohashes(encodeGeohash(lat, lng)) },
    };
    if (req.user) {
      const [blocked, hidden] = await Promise.all([
        blockedUserIds(req.user.userId),
        hiddenListingIds(req.user.userId),
      ]);
      if (blocked.length) where.sellerId = { notIn: blocked };
      if (hidden.length) where.id = { in: Array.from(byListing.keys()).filter((id) => !hidden.includes(id)) };
    }
    const candidates = await prisma.listing.findMany({
      where,
      include: { seller: { select: { id: true, name: true, avatarUrl: true, trustScore: true, kycVerified: true } } },
      take: 200,
    });
    const scored = candidates
      .map((l) => {
        const d = byListing.get(l.id)!;
        return {
          ...hydrate(l),
          distanceKm: distanceKm(lat, lng, l.lat, l.lng),
          previousPriceInPaise: d.old,
          droppedAt: d.changedAt,
          percentOff: Math.round(((d.old - d.new) / d.old) * 100),
        };
      })
      .filter((l) => l.distanceKm <= radiusKm)
      .sort((a, b) => b.percentOff - a.percentOff)
      .slice(0, limit);

    res.json({ listings: scored });
  } catch (e) { next(e); }
});

listingRouter.get('/:id', async (req, res, next) => {
  try {
    const l = await prisma.listing.findUnique({
      where: { id: req.params.id },
      include: { seller: { select: { id: true, name: true, avatarUrl: true, trustScore: true, kycVerified: true } } },
    });
    if (!l) return res.status(404).json({ error: 'not_found' });
    await prisma.listing.update({ where: { id: l.id }, data: { views: { increment: 1 } } });
    const since7d = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const lastDrop = await prisma.listingPriceChange.findFirst({
      where: { listingId: l.id, changedAt: { gte: since7d } },
      orderBy: { changedAt: 'desc' },
    });
    const recentlyReduced = !!lastDrop && lastDrop.newPriceInPaise < lastDrop.oldPriceInPaise;
    res.json({ listing: hydrate({ ...l, recentlyReduced, previousPriceInPaise: recentlyReduced ? lastDrop!.oldPriceInPaise : undefined }) });
  } catch (e) { next(e); }
});

listingRouter.patch('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'not_found' });
    if (existing.sellerId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });

    const patch = z.object({
      title: z.string().min(3).max(120).optional(),
      description: z.string().min(5).max(4000).optional(),
      priceInPaise: z.number().int().nonnegative().optional(),
      status: z.enum(['active', 'reserved', 'sold', 'closed']).optional(),
      negotiable: z.boolean().optional(),
      images: z.array(z.string().url()).max(10).optional(),
      attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    }).parse(req.body);

    const data: any = { ...patch };
    if (patch.images) data.images = JSON.stringify(patch.images);
    if (patch.attributes !== undefined) data.attributes = JSON.stringify(patch.attributes);

    const updated = await prisma.listing.update({ where: { id: existing.id }, data });
    res.json({ listing: hydrate(updated) });

    if (patch.priceInPaise !== undefined && patch.priceInPaise !== existing.priceInPaise) {
      prisma.listingPriceChange.create({
        data: {
          listingId: existing.id,
          oldPriceInPaise: existing.priceInPaise,
          newPriceInPaise: patch.priceInPaise,
        },
      }).catch(() => {});
    }
    if (patch.priceInPaise !== undefined && patch.priceInPaise < existing.priceInPaise) {
      const drop = existing.priceInPaise - patch.priceInPaise;
      const pct = Math.round((drop / existing.priceInPaise) * 100);
      const favs = await prisma.favorite.findMany({
        where: { listingId: existing.id },
        select: { userId: true },
      });
      const newPrice = `₹${(patch.priceInPaise / 100).toLocaleString('en-IN')}`;
      for (const f of favs) {
        if (f.userId === existing.sellerId) continue;
        pushToUser(f.userId, {
          title: `Price drop: ${existing.title.slice(0, 40)}`,
          body: `Now ${newPrice} (${pct}% off)`,
          type: 'price_drop',
          data: { listingId: existing.id },
        }).catch(() => {});
      }
    }
  } catch (e) { next(e); }
});

// Renew an expiring/expired active listing — resets createdAt so buyers see it again.
listingRouter.post('/:id/renew', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'not_found' });
    if (existing.sellerId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });
    if (existing.status !== 'active') return res.status(400).json({ error: 'not_active' });
    const updated = await prisma.listing.update({
      where: { id: existing.id },
      data: { createdAt: new Date(), bumpedAt: null },
    });
    res.json({ listing: hydrate(updated) });
  } catch (e) { next(e); }
});

// Bump a listing to top of feed — free, but once per 24h.
listingRouter.post('/:id/bump', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'not_found' });
    if (existing.sellerId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });
    if (existing.status !== 'active') return res.status(400).json({ error: 'not_active' });
    const now = Date.now();
    if (existing.bumpedAt && now - existing.bumpedAt.getTime() < 24 * 3600 * 1000) {
      const nextAt = new Date(existing.bumpedAt.getTime() + 24 * 3600 * 1000);
      return res.status(429).json({ error: 'cooldown', nextAllowedAt: nextAt.toISOString() });
    }
    const updated = await prisma.listing.update({
      where: { id: existing.id },
      data: { bumpedAt: new Date(now) },
    });
    res.json({ listing: hydrate(updated) });
  } catch (e) { next(e); }
});

// Reserve / unreserve a listing — soft hold while seller meets a buyer.
listingRouter.post('/:id/reserve', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'not_found' });
    if (existing.sellerId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });
    if (existing.status !== 'active') return res.status(400).json({ error: 'not_active' });
    const updated = await prisma.listing.update({ where: { id: existing.id }, data: { status: 'reserved' } });
    res.json({ listing: hydrate(updated) });
  } catch (e) { next(e); }
});

listingRouter.post('/:id/unreserve', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'not_found' });
    if (existing.sellerId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });
    if (existing.status !== 'reserved') return res.status(400).json({ error: 'not_reserved' });
    const updated = await prisma.listing.update({ where: { id: existing.id }, data: { status: 'active' } });
    res.json({ listing: hydrate(updated) });
  } catch (e) { next(e); }
});

// Boost a listing to top of feed/search for N hours (default 24).
listingRouter.post('/:id/boost', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'not_found' });
    if (existing.sellerId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });
    const hours = Math.min(Math.max(parseInt(String(req.body?.hours ?? '24'), 10) || 24, 1), 24 * 30);
    const featuredUntil = new Date(Date.now() + hours * 3600 * 1000);
    const updated = await prisma.listing.update({
      where: { id: existing.id },
      data: { featured: true, featuredUntil },
    });
    res.json({ listing: hydrate(updated) });
  } catch (e) { next(e); }
});

// Hot listings near a point — score mixes views, saves, offers.

// Seller-only per-listing stats
listingRouter.get('/:id/stats', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const l = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!l) return res.status(404).json({ error: 'not_found' });
    if (l.sellerId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });

    const [favorites, offers, pendingOffers, chats] = await Promise.all([
      prisma.favorite.count({ where: { listingId: l.id } }),
      prisma.offer.count({ where: { listingId: l.id } }),
      prisma.offer.count({ where: { listingId: l.id, status: { in: ['pending', 'countered'] } } }),
      prisma.conversation.count({ where: { listingId: l.id } }),
    ]);
    res.json({
      stats: {
        views: l.views,
        favorites,
        offers,
        pendingOffers,
        chats,
      },
    });
  } catch (e) { next(e); }
});

// People who've chatted with the seller about this listing — used for "Who did you sell to?"
listingRouter.get('/:id/chatters', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const l = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!l) return res.status(404).json({ error: 'not_found' });
    if (l.sellerId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });

    const convs = await prisma.conversation.findMany({
      where: { listingId: l.id, type: 'direct' },
      include: { members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } } },
    });
    const seen = new Set<string>();
    const users: Array<{ id: string; name: string | null; avatarUrl: string | null }> = [];
    for (const c of convs) {
      for (const m of c.members) {
        if (m.userId === l.sellerId || seen.has(m.userId)) continue;
        seen.add(m.userId);
        users.push({ id: m.user.id, name: m.user.name, avatarUrl: m.user.avatarUrl });
      }
    }
    res.json({ chatters: users });
  } catch (e) { next(e); }
});

listingRouter.post('/:id/mark-sold', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const buyerId = z.object({ buyerId: z.string().optional() }).parse(req.body ?? {}).buyerId;
    const l = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!l) return res.status(404).json({ error: 'not_found' });
    if (l.sellerId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });

    const updated = await prisma.listing.update({
      where: { id: l.id },
      data: { status: 'sold', soldToId: buyerId ?? null, soldAt: new Date() },
    });
    res.json({ listing: hydrate(updated) });

    if (buyerId && buyerId !== l.sellerId) {
      pushToUser(buyerId, {
        title: `How was ${l.title.slice(0, 40)}?`,
        body: 'Leave a quick rating for the seller.',
        type: 'rate_prompt',
        data: { listingId: l.id, kind: 'seller' },
      }).catch(() => {});
    }
  } catch (e) { next(e); }
});

// Revive a sold or closed listing — resets sold state and bumps createdAt so
// it sorts fresh in the feed. Boost state is cleared (seller re-boosts if they want).
listingRouter.post('/:id/relist', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'not_found' });
    if (existing.sellerId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });
    if (existing.status === 'active') return res.status(400).json({ error: 'already_active' });

    const updated = await prisma.listing.update({
      where: { id: existing.id },
      data: {
        status: 'active',
        soldToId: null,
        soldAt: null,
        featured: false,
        featuredUntil: null,
        createdAt: new Date(),
      },
    });
    res.json({ listing: hydrate(updated) });
  } catch (e) { next(e); }
});

// Public price history for a listing (drops + raises).
listingRouter.get('/:id/price-history', async (req, res, next) => {
  try {
    const rows = await prisma.listingPriceChange.findMany({
      where: { listingId: req.params.id },
      orderBy: { changedAt: 'desc' },
      take: 30,
    });
    res.json({ history: rows });
  } catch (e) { next(e); }
});

// Hide a listing from my feed (toggle off via DELETE).
listingRouter.post('/:id/hide', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const l = await prisma.listing.findUnique({ where: { id: req.params.id }, select: { id: true, sellerId: true } });
    if (!l) return res.status(404).json({ error: 'not_found' });
    if (l.sellerId === req.user!.userId) return res.status(400).json({ error: 'cannot_hide_own' });
    await prisma.hiddenListing.upsert({
      where: { userId_listingId: { userId: req.user!.userId, listingId: l.id } },
      update: {},
      create: { userId: req.user!.userId, listingId: l.id },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

listingRouter.delete('/:id/hide', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await prisma.hiddenListing.deleteMany({
      where: { userId: req.user!.userId, listingId: req.params.id },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Listings similar to a given one — same category, nearby, active, excluding self and sold.
listingRouter.get('/:id/similar', optionalAuth, async (req: AuthedRequest, res, next) => {
  try {
    const base = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!base) return res.status(404).json({ error: 'not_found' });
    const limit = Math.min(parseInt((req.query.limit as string) ?? '10', 10) || 10, 20);

    const where: any = {
      id: { not: base.id },
      status: 'active',
      category: base.category,
      geohash: { in: neighborGeohashes(base.geohash) },
    };
    if (req.user) {
      const [blocked, hidden] = await Promise.all([
        blockedUserIds(req.user.userId),
        hiddenListingIds(req.user.userId),
      ]);
      if (blocked.length) where.sellerId = { notIn: blocked };
      const excludeIds = [base.id, ...hidden];
      where.id = { notIn: excludeIds };
    }

    const candidates = await prisma.listing.findMany({
      where,
      take: 60,
      include: { seller: { select: { id: true, name: true, avatarUrl: true, trustScore: true, kycVerified: true } } },
    });
    const priceRef = base.priceInPaise || 1;
    const scored = candidates
      .map((l) => {
        const dKm = distanceKm(base.lat, base.lng, l.lat, l.lng);
        const priceDelta = Math.abs(l.priceInPaise - base.priceInPaise) / priceRef;
        const score = dKm + priceDelta * 3;
        return { ...hydrate(l), distanceKm: dKm, score };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, limit);
    res.json({ listings: scored });
  } catch (e) { next(e); }
});

listingRouter.delete('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const existing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: 'not_found' });
    if (existing.sellerId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });
    await prisma.listing.update({ where: { id: existing.id }, data: { status: 'closed' } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

function hydrate(l: any) {
  return {
    ...l,
    images: safeParseArray(l.images),
    attributes: l.attributes ? safeParseObject(l.attributes) : null,
  };
}
function safeParseObject(s: string): Record<string, any> | null {
  try { const x = JSON.parse(s); return x && typeof x === 'object' ? x : null; } catch { return null; }
}
function safeParseArray(s: string): string[] {
  try { const x = JSON.parse(s); return Array.isArray(x) ? x : []; } catch { return []; }
}
