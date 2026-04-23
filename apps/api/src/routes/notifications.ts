import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const notificationRouter = Router();

notificationRouter.get('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.user!.userId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.notification.count({ where: { userId: req.user!.userId, readAt: null } }),
    ]);
    res.json({ notifications: items, unread });
  } catch (e) { next(e); }
});

notificationRouter.post('/read', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.userId, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

notificationRouter.post('/:id/read', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await prisma.notification.updateMany({
      where: { id: req.params.id, userId: req.user!.userId },
      data: { readAt: new Date() },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
