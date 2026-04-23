import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, optionalAuth, type AuthedRequest } from '../middleware/auth.js';
import { encodeGeohash, distanceKm, neighborGeohashes } from '../utils/geo.js';
import { blockedUserIds } from './blocks.js';

export const pollRouter = Router();

const createSchema = z.object({
  question: z.string().min(3).max(300),
  options: z.array(z.string().min(1).max(120)).min(2).max(6),
  lat: z.number(),
  lng: z.number(),
  closesAt: z.string().optional(),
});

pollRouter.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const d = createSchema.parse(req.body);
    const poll = await prisma.poll.create({
      data: {
        authorId: req.user!.userId,
        question: d.question,
        lat: d.lat, lng: d.lng, geohash: encodeGeohash(d.lat, d.lng),
        closesAt: d.closesAt ? new Date(d.closesAt) : undefined,
        options: { create: d.options.map((label, idx) => ({ label, idx })) },
      },
      include: { options: { orderBy: { idx: 'asc' } } },
    });
    res.json({ poll });
  } catch (e) { next(e); }
});

pollRouter.get('/', optionalAuth, async (req: AuthedRequest, res, next) => {
  try {
    const lat = req.query.lat ? parseFloat(req.query.lat as string) : undefined;
    const lng = req.query.lng ? parseFloat(req.query.lng as string) : undefined;
    const radiusKm = parseFloat((req.query.radiusKm as string) ?? '15');
    const where: any = {};
    if (lat !== undefined && lng !== undefined) {
      where.geohash = { in: neighborGeohashes(encodeGeohash(lat, lng)) };
    }
    if (req.user) {
      const blocked = await blockedUserIds(req.user.userId);
      if (blocked.length) where.authorId = { notIn: blocked };
    }
    const rows = await prisma.poll.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        options: { orderBy: { idx: 'asc' }, include: { _count: { select: { votes: true } } } },
        _count: { select: { votes: true } },
      },
    });
    let out: any[] = rows;
    if (lat !== undefined && lng !== undefined) {
      out = rows
        .map((p) => ({ ...p, distanceKm: distanceKm(lat, lng, p.lat, p.lng) }))
        .filter((p: any) => p.distanceKm <= radiusKm);
    }
    res.json({ polls: out });
  } catch (e) { next(e); }
});

pollRouter.get('/:id', optionalAuth, async (req: AuthedRequest, res, next) => {
  try {
    const poll = await prisma.poll.findUnique({
      where: { id: req.params.id },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        options: { orderBy: { idx: 'asc' }, include: { _count: { select: { votes: true } } } },
        _count: { select: { votes: true } },
      },
    });
    if (!poll) return res.status(404).json({ error: 'not_found' });
    const myVote = req.user
      ? await prisma.pollVote.findUnique({ where: { pollId_userId: { pollId: poll.id, userId: req.user.userId } } })
      : null;
    res.json({ poll, myOptionId: myVote?.optionId ?? null });
  } catch (e) { next(e); }
});

pollRouter.post('/:id/vote', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { optionId } = z.object({ optionId: z.string() }).parse(req.body);
    const poll = await prisma.poll.findUnique({ where: { id: req.params.id }, include: { options: true } });
    if (!poll) return res.status(404).json({ error: 'not_found' });
    if (poll.closesAt && poll.closesAt.getTime() < Date.now()) return res.status(400).json({ error: 'poll_closed' });
    if (!poll.options.find((o) => o.id === optionId)) return res.status(400).json({ error: 'bad_option' });
    await prisma.pollVote.upsert({
      where: { pollId_userId: { pollId: poll.id, userId: req.user!.userId } },
      update: { optionId },
      create: { pollId: poll.id, optionId, userId: req.user!.userId },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

pollRouter.delete('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const poll = await prisma.poll.findUnique({ where: { id: req.params.id } });
    if (!poll) return res.status(404).json({ error: 'not_found' });
    if (poll.authorId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });
    await prisma.poll.delete({ where: { id: poll.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
