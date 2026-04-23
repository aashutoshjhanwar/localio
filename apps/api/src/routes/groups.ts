import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const groupRouter = Router();

groupRouter.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const d = z.object({
      name: z.string().min(2).max(80),
      description: z.string().max(500).optional(),
      societyId: z.string().optional(),
      isPublic: z.boolean().optional(),
    }).parse(req.body);

    const group = await prisma.group.create({
      data: {
        name: d.name,
        description: d.description,
        societyId: d.societyId,
        isPublic: d.isPublic ?? true,
      },
    });
    // create backing conversation
    const conversation = await prisma.conversation.create({
      data: { type: 'group', groupId: group.id },
    });
    await prisma.groupMember.create({
      data: { groupId: group.id, userId: req.user!.userId, role: 'owner' },
    });
    await prisma.conversationMember.create({
      data: { conversationId: conversation.id, userId: req.user!.userId },
    });
    res.json({ group, conversationId: conversation.id });
  } catch (e) { next(e); }
});

groupRouter.get('/', async (req, res, next) => {
  try {
    const societyId = req.query.societyId as string | undefined;
    const groups = await prisma.group.findMany({
      where: { ...(societyId ? { societyId } : {}), isPublic: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { _count: { select: { members: true } } },
    });
    res.json({ groups });
  } catch (e) { next(e); }
});

groupRouter.get('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      include: {
        members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        conversation: true,
      },
    });
    if (!group) return res.status(404).json({ error: 'not_found' });
    res.json({ group });
  } catch (e) { next(e); }
});

groupRouter.post('/:id/join', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      include: { conversation: true },
    });
    if (!group) return res.status(404).json({ error: 'not_found' });

    await prisma.groupMember.upsert({
      where: { groupId_userId: { groupId: group.id, userId: req.user!.userId } },
      update: {},
      create: { groupId: group.id, userId: req.user!.userId },
    });
    if (group.conversation) {
      await prisma.conversationMember.upsert({
        where: {
          conversationId_userId: { conversationId: group.conversation.id, userId: req.user!.userId },
        },
        update: {},
        create: { conversationId: group.conversation.id, userId: req.user!.userId },
      });
    }
    res.json({ ok: true, conversationId: group.conversation?.id });
  } catch (e) { next(e); }
});

groupRouter.post('/:id/leave', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await prisma.groupMember.deleteMany({
      where: { groupId: req.params.id, userId: req.user!.userId },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
