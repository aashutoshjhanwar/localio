import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const blockRouter = Router();

blockRouter.get('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const blocks = await prisma.block.findMany({
      where: { blockerId: req.user!.userId },
      include: { blocked: { select: { id: true, name: true, avatarUrl: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ blocks });
  } catch (e) { next(e); }
});

blockRouter.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { userId } = z.object({ userId: z.string() }).parse(req.body);
    if (userId === req.user!.userId) return res.status(400).json({ error: 'cannot_block_self' });
    await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: req.user!.userId, blockedId: userId } },
      update: {},
      create: { blockerId: req.user!.userId, blockedId: userId },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

blockRouter.delete('/:userId', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await prisma.block.deleteMany({
      where: { blockerId: req.user!.userId, blockedId: req.params.userId },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Helper reusable across feed/search/listings — not mounted.
export async function blockedUserIds(userId: string): Promise<string[]> {
  const rows = await prisma.block.findMany({ where: { blockerId: userId }, select: { blockedId: true } });
  return rows.map((r) => r.blockedId);
}
