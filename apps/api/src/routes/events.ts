import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, optionalAuth, type AuthedRequest } from '../middleware/auth.js';
import { encodeGeohash, distanceKm, neighborGeohashes } from '../utils/geo.js';

export const eventRouter = Router();

const createSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(5).max(4000),
  locationText: z.string().min(2).max(200),
  lat: z.number(),
  lng: z.number(),
  startsAt: z.string(),
  endsAt: z.string().optional(),
  capacity: z.number().int().positive().optional(),
});

eventRouter.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const d = createSchema.parse(req.body);
    const ev = await prisma.event.create({
      data: {
        creatorId: req.user!.userId,
        title: d.title,
        description: d.description,
        locationText: d.locationText,
        lat: d.lat,
        lng: d.lng,
        geohash: encodeGeohash(d.lat, d.lng),
        startsAt: new Date(d.startsAt),
        endsAt: d.endsAt ? new Date(d.endsAt) : null,
        capacity: d.capacity ?? null,
      },
    });
    // creator auto-RSVPs as going
    await prisma.eventRsvp.create({
      data: { eventId: ev.id, userId: req.user!.userId, status: 'going' },
    });
    res.json({ event: ev });
  } catch (e) { next(e); }
});

eventRouter.get('/', optionalAuth, async (req: AuthedRequest, res, next) => {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
    const radiusKm = parseFloat((req.query.radiusKm as string) ?? '15');

    const where: any = { startsAt: { gte: new Date() } };
    if (lat !== undefined && lng !== undefined) {
      where.geohash = { in: neighborGeohashes(encodeGeohash(lat, lng)) };
    }

    const rows = await prisma.event.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      take: 100,
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { rsvps: true } },
      },
    });

    let out: any[] = rows;
    if (lat !== undefined && lng !== undefined) {
      out = rows
        .map((e) => ({ ...e, distanceKm: distanceKm(lat, lng, e.lat, e.lng) }))
        .filter((e: any) => e.distanceKm <= radiusKm);
    }
    res.json({ events: out });
  } catch (e) { next(e); }
});

eventRouter.get('/:id', optionalAuth, async (req: AuthedRequest, res, next) => {
  try {
    const ev = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { id: true, name: true, avatarUrl: true, trustScore: true } },
        rsvps: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, name: true, avatarUrl: true } } },
        },
        _count: { select: { rsvps: true } },
      },
    });
    if (!ev) return res.status(404).json({ error: 'not_found' });
    const myRsvp = req.user
      ? await prisma.eventRsvp.findUnique({
          where: { eventId_userId: { eventId: ev.id, userId: req.user.userId } },
        })
      : null;
    res.json({ event: ev, myRsvp });
  } catch (e) { next(e); }
});

eventRouter.post('/:id/rsvp', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { status } = z.object({ status: z.enum(['going', 'interested']) }).parse(req.body);
    const ev = await prisma.event.findUnique({ where: { id: req.params.id }, include: { _count: { select: { rsvps: true } } } });
    if (!ev) return res.status(404).json({ error: 'not_found' });
    if (ev.capacity && ev._count.rsvps >= ev.capacity) {
      const existing = await prisma.eventRsvp.findUnique({
        where: { eventId_userId: { eventId: ev.id, userId: req.user!.userId } },
      });
      if (!existing) return res.status(400).json({ error: 'event_full' });
    }
    const rsvp = await prisma.eventRsvp.upsert({
      where: { eventId_userId: { eventId: ev.id, userId: req.user!.userId } },
      update: { status },
      create: { eventId: ev.id, userId: req.user!.userId, status },
    });
    res.json({ rsvp });
  } catch (e) { next(e); }
});

eventRouter.delete('/:id/rsvp', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await prisma.eventRsvp.deleteMany({
      where: { eventId: req.params.id, userId: req.user!.userId },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

eventRouter.delete('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const ev = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!ev) return res.status(404).json({ error: 'not_found' });
    if (ev.creatorId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });
    await prisma.eventRsvp.deleteMany({ where: { eventId: ev.id } });
    await prisma.event.delete({ where: { id: ev.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
