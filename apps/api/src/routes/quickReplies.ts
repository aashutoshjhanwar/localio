import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const quickReplyRouter = Router();

quickReplyRouter.get('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const replies = await prisma.quickReply.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ replies });
  } catch (e) { next(e); }
});

quickReplyRouter.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { text } = z.object({ text: z.string().min(1).max(280) }).parse(req.body);
    const count = await prisma.quickReply.count({ where: { userId: req.user!.userId } });
    if (count >= 30) return res.status(400).json({ error: 'limit_reached' });
    const reply = await prisma.quickReply.create({
      data: { userId: req.user!.userId, text: text.trim() },
    });
    res.json({ reply });
  } catch (e) { next(e); }
});

quickReplyRouter.delete('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await prisma.quickReply.deleteMany({
      where: { id: req.params.id, userId: req.user!.userId },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
