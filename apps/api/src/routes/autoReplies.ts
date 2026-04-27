import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const autoReplyRouter = Router();

const upsertSchema = z.object({
  id: z.string().optional(),
  listingId: z.string().nullable().optional(),
  kind: z.enum(['greeting', 'faq']).default('greeting'),
  triggerText: z.string().min(1).max(120).nullable().optional(),
  response: z.string().min(2).max(2000),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

autoReplyRouter.get('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!.userId;
    const listingId = req.query.listingId as string | undefined;
    const replies = await prisma.autoReply.findMany({
      where: { userId: me, ...(listingId ? { OR: [{ listingId }, { listingId: null }] } : {}) },
      orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }],
    });
    res.json({ replies });
  } catch (e) { next(e); }
});

autoReplyRouter.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!.userId;
    const d = upsertSchema.parse(req.body);
    if (d.kind === 'faq' && !d.triggerText) {
      return res.status(400).json({ error: 'trigger_required_for_faq' });
    }
    const reply = await prisma.autoReply.upsert({
      where: { id: d.id ?? '__new__' },
      update: {
        listingId: d.listingId ?? null,
        kind: d.kind, triggerText: d.triggerText ?? null,
        response: d.response,
        enabled: d.enabled ?? true,
        sortOrder: d.sortOrder ?? 0,
      },
      create: {
        userId: me,
        listingId: d.listingId ?? null,
        kind: d.kind, triggerText: d.triggerText ?? null,
        response: d.response,
        enabled: d.enabled ?? true,
        sortOrder: d.sortOrder ?? 0,
      },
    });
    res.json({ reply });
  } catch (e) { next(e); }
});

autoReplyRouter.delete('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!.userId;
    const r = await prisma.autoReply.findUnique({ where: { id: req.params.id } });
    if (!r || r.userId !== me) return res.status(404).json({ error: 'not_found' });
    await prisma.autoReply.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
