import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const followRouter = Router();

followRouter.post('/:userId', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const followerId = req.user!.userId;
    const followeeId = req.params.userId;
    if (followerId === followeeId) return res.status(400).json({ error: 'cannot_follow_self' });
    const target = await prisma.user.findUnique({ where: { id: followeeId }, select: { id: true } });
    if (!target) return res.status(404).json({ error: 'user_not_found' });
    await prisma.follow.upsert({
      where: { followerId_followeeId: { followerId, followeeId } },
      update: {},
      create: { followerId, followeeId },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

followRouter.delete('/:userId', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await prisma.follow.deleteMany({
      where: { followerId: req.user!.userId, followeeId: req.params.userId },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

followRouter.get('/me', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const rows = await prisma.follow.findMany({
      where: { followerId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        followee: { select: { id: true, name: true, avatarUrl: true, trustScore: true, kycVerified: true } },
      },
    });
    res.json({ following: rows.map((r) => r.followee) });
  } catch (e) { next(e); }
});

followRouter.get('/user/:userId', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const [followers, following, iFollow] = await Promise.all([
      prisma.follow.count({ where: { followeeId: req.params.userId } }),
      prisma.follow.count({ where: { followerId: req.params.userId } }),
      prisma.follow.findUnique({
        where: { followerId_followeeId: { followerId: req.user!.userId, followeeId: req.params.userId } },
      }),
    ]);
    res.json({ followers, following, iFollow: !!iFollow });
  } catch (e) { next(e); }
});
