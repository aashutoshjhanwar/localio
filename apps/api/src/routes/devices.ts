import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const deviceRouter = Router();

deviceRouter.post('/register', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { token, platform } = z.object({
      token: z.string().min(5),
      platform: z.enum(['ios', 'android', 'web']),
    }).parse(req.body);

    const record = await prisma.deviceToken.upsert({
      where: { token },
      update: { userId: req.user!.userId, platform },
      create: { token, platform, userId: req.user!.userId },
    });
    res.json({ ok: true, id: record.id });
  } catch (e) { next(e); }
});

deviceRouter.post('/unregister', requireAuth, async (req, res, next) => {
  try {
    const { token } = z.object({ token: z.string() }).parse(req.body);
    await prisma.deviceToken.deleteMany({ where: { token } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
