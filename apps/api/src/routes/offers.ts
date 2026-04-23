import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { pushToUser } from '../realtime/push.js';

export const offerRouter = Router();

const createSchema = z.object({
  listingId: z.string().min(1),
  amountInPaise: z.number().int().positive(),
  message: z.string().max(400).optional(),
});

offerRouter.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const d = createSchema.parse(req.body);
    const listing = await prisma.listing.findUnique({ where: { id: d.listingId } });
    if (!listing) return res.status(404).json({ error: 'listing_not_found' });
    if (listing.status !== 'active') return res.status(400).json({ error: 'listing_inactive' });
    if (listing.sellerId === req.user!.userId) return res.status(400).json({ error: 'cannot_offer_own' });
    if (!listing.negotiable) return res.status(400).json({ error: 'not_negotiable' });

    const existing = await prisma.offer.findFirst({
      where: { listingId: d.listingId, buyerId: req.user!.userId, status: 'pending' },
    });
    if (existing) return res.status(409).json({ error: 'offer_pending', offer: existing });

    const offer = await prisma.offer.create({
      data: {
        listingId: d.listingId,
        buyerId: req.user!.userId,
        amountInPaise: d.amountInPaise,
        message: d.message,
      },
    });
    res.json({ offer });

    const amt = `₹${(d.amountInPaise / 100).toLocaleString('en-IN')}`;
    pushToUser(listing.sellerId, {
      title: `New offer: ${amt}`,
      body: `${listing.title.slice(0, 60)} — tap to respond`,
      type: 'offer_new',
      data: { listingId: listing.id, offerId: offer.id },
    }).catch(() => {});
  } catch (e) { next(e); }
});

// Seller view — all offers on a listing
offerRouter.get('/listing/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const listing = await prisma.listing.findUnique({ where: { id: req.params.id } });
    if (!listing) return res.status(404).json({ error: 'not_found' });
    if (listing.sellerId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });

    const offers = await prisma.offer.findMany({
      where: { listingId: req.params.id },
      include: { buyer: { select: { id: true, name: true, avatarUrl: true, trustScore: true, kycVerified: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ offers });
  } catch (e) { next(e); }
});

// Seller view — all offers across my listings
offerRouter.get('/received', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const offers = await prisma.offer.findMany({
      where: { listing: { sellerId: req.user!.userId } },
      include: {
        buyer: { select: { id: true, name: true, avatarUrl: true, trustScore: true, kycVerified: true } },
        listing: { select: { id: true, title: true, priceInPaise: true, images: true, status: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });
    res.json({ offers });
  } catch (e) { next(e); }
});

// Buyer view — my offers
offerRouter.get('/mine', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const offers = await prisma.offer.findMany({
      where: { buyerId: req.user!.userId },
      include: {
        listing: { select: { id: true, title: true, priceInPaise: true, images: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json({ offers });
  } catch (e) { next(e); }
});

async function respond(req: AuthedRequest, res: any, action: 'accepted' | 'declined') {
  const offer = await prisma.offer.findUnique({
    where: { id: req.params.id },
    include: { listing: true },
  });
  if (!offer) return res.status(404).json({ error: 'not_found' });
  if (offer.listing.sellerId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });
  if (offer.status !== 'pending') return res.status(400).json({ error: 'already_resolved' });

  const updated = await prisma.offer.update({
    where: { id: offer.id },
    data: { status: action, respondedAt: new Date() },
  });

  if (action === 'accepted') {
    await prisma.offer.updateMany({
      where: { listingId: offer.listingId, id: { not: offer.id }, status: 'pending' },
      data: { status: 'declined', respondedAt: new Date() },
    });
  }

  res.json({ offer: updated });

  const amt = `₹${(offer.amountInPaise / 100).toLocaleString('en-IN')}`;
  pushToUser(offer.buyerId, {
    title: action === 'accepted' ? `Offer accepted: ${amt}` : `Offer declined`,
    body: offer.listing.title.slice(0, 80),
    type: action === 'accepted' ? 'offer_accepted' : 'offer_declined',
    data: { listingId: offer.listingId, offerId: offer.id },
  }).catch(() => {});
}

offerRouter.post('/:id/accept', requireAuth, async (req: AuthedRequest, res, next) => {
  try { await respond(req, res, 'accepted'); } catch (e) { next(e); }
});

offerRouter.post('/:id/decline', requireAuth, async (req: AuthedRequest, res, next) => {
  try { await respond(req, res, 'declined'); } catch (e) { next(e); }
});

// Seller sends a counter offer on a pending buyer offer
offerRouter.post('/:id/counter', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const d = z.object({
      amountInPaise: z.number().int().positive(),
      message: z.string().max(400).optional(),
    }).parse(req.body);
    const offer = await prisma.offer.findUnique({
      where: { id: req.params.id },
      include: { listing: true },
    });
    if (!offer) return res.status(404).json({ error: 'not_found' });
    if (offer.listing.sellerId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });
    if (offer.status !== 'pending') return res.status(400).json({ error: 'already_resolved' });
    if (d.amountInPaise === offer.amountInPaise) return res.status(400).json({ error: 'same_amount' });

    const updated = await prisma.offer.update({
      where: { id: offer.id },
      data: {
        status: 'countered',
        counterAmountPaise: d.amountInPaise,
        counterMessage: d.message,
        counteredAt: new Date(),
      },
    });
    res.json({ offer: updated });

    const amt = `₹${(d.amountInPaise / 100).toLocaleString('en-IN')}`;
    pushToUser(offer.buyerId, {
      title: `Counter offer: ${amt}`,
      body: offer.listing.title.slice(0, 80),
      type: 'offer_counter',
      data: { listingId: offer.listingId, offerId: offer.id },
    }).catch(() => {});
  } catch (e) { next(e); }
});

// Buyer accepts a seller's counter — locks final price at counter amount
offerRouter.post('/:id/accept-counter', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const offer = await prisma.offer.findUnique({
      where: { id: req.params.id },
      include: { listing: true },
    });
    if (!offer) return res.status(404).json({ error: 'not_found' });
    if (offer.buyerId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });
    if (offer.status !== 'countered' || !offer.counterAmountPaise) {
      return res.status(400).json({ error: 'no_counter' });
    }

    const updated = await prisma.offer.update({
      where: { id: offer.id },
      data: {
        status: 'accepted',
        amountInPaise: offer.counterAmountPaise,
        respondedAt: new Date(),
      },
    });
    await prisma.offer.updateMany({
      where: { listingId: offer.listingId, id: { not: offer.id }, status: { in: ['pending', 'countered'] } },
      data: { status: 'declined', respondedAt: new Date() },
    });
    res.json({ offer: updated });

    const amt = `₹${(offer.counterAmountPaise / 100).toLocaleString('en-IN')}`;
    pushToUser(offer.listing.sellerId, {
      title: `Counter accepted: ${amt}`,
      body: offer.listing.title.slice(0, 80),
      type: 'offer_accepted',
      data: { listingId: offer.listingId, offerId: offer.id },
    }).catch(() => {});
  } catch (e) { next(e); }
});

offerRouter.post('/:id/withdraw', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const offer = await prisma.offer.findUnique({ where: { id: req.params.id } });
    if (!offer) return res.status(404).json({ error: 'not_found' });
    if (offer.buyerId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });
    if (offer.status !== 'pending' && offer.status !== 'countered') return res.status(400).json({ error: 'already_resolved' });
    const updated = await prisma.offer.update({
      where: { id: offer.id },
      data: { status: 'withdrawn', respondedAt: new Date() },
    });
    res.json({ offer: updated });
  } catch (e) { next(e); }
});
