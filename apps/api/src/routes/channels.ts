import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const channelRouter = Router();

async function assertChannelMember(channelId: string, userId: string) {
  const ch = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!ch) return { err: 404 as const };
  const member = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: ch.conversationId, userId } },
  });
  if (!member) return { err: 403 as const };
  const gm = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId: ch.groupId, userId } },
  });
  return { channel: ch, member, groupMember: gm };
}

// List channels for a group
channelRouter.get('/group/:groupId', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const channels = await prisma.channel.findMany({
      where: { groupId: req.params.groupId },
      orderBy: { sortOrder: 'asc' },
    });
    // Decorate with last message + unread count for the user
    const me = req.user!.userId;
    const decorated = await Promise.all(channels.map(async (c) => {
      const last = await prisma.message.findFirst({
        where: { conversationId: c.conversationId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true, body: true, type: true, createdAt: true, senderId: true },
      });
      const mem = await prisma.conversationMember.findUnique({
        where: { conversationId_userId: { conversationId: c.conversationId, userId: me } },
      });
      const since = mem?.lastReadAt ?? new Date(0);
      const unread = await prisma.message.count({
        where: { conversationId: c.conversationId, createdAt: { gt: since }, senderId: { not: me } },
      });
      return { ...c, lastMessage: last, unread };
    }));
    res.json({ channels: decorated });
  } catch (e) { next(e); }
});

// Channel detail + paginated messages
channelRouter.get('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { channel, err } = await assertChannelMember(req.params.id, req.user!.userId);
    if (err === 404) return res.status(404).json({ error: 'not_found' });
    if (err === 403) return res.status(403).json({ error: 'not_a_member' });
    const cursor = req.query.cursor as string | undefined;
    const messages = await prisma.message.findMany({
      where: { conversationId: channel!.conversationId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 30,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
    });
    res.json({ channel, messages: messages.reverse() });
  } catch (e) { next(e); }
});

// Post a message to a channel (REST fallback — primary path is socket 'message:send' with conversationId)
channelRouter.post('/:id/messages', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!.userId;
    const ctx = await assertChannelMember(req.params.id, me);
    if (ctx.err === 404) return res.status(404).json({ error: 'not_found' });
    if (ctx.err === 403) return res.status(403).json({ error: 'not_a_member' });
    const d = z.object({
      body: z.string().min(1).max(4000),
      type: z.enum(['text', 'image', 'location', 'system']).default('text'),
      mediaUrl: z.string().url().optional(),
    }).parse(req.body);

    // Mute check
    if (ctx.groupMember?.mutedUntil && new Date(ctx.groupMember.mutedUntil).getTime() > Date.now()) {
      return res.status(403).json({ error: 'muted' });
    }
    // Read-only channel (#announcements) — admins only
    if (ctx.channel!.readOnly) {
      if (!ctx.groupMember || (ctx.groupMember.role !== 'admin' && ctx.groupMember.role !== 'owner')) {
        return res.status(403).json({ error: 'read_only' });
      }
    }

    const msg = await prisma.message.create({
      data: {
        conversationId: ctx.channel!.conversationId,
        senderId: me,
        type: d.type,
        body: d.body,
        mediaUrl: d.mediaUrl,
      },
      include: { sender: { select: { id: true, name: true, avatarUrl: true } } },
    });
    res.json({ message: msg });
  } catch (e) { next(e); }
});

// Pin a message to the channel's conversation (admin-only)
channelRouter.post('/:id/pin', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!.userId;
    const ctx = await assertChannelMember(req.params.id, me);
    if (ctx.err) return res.status(ctx.err).json({ error: 'forbidden' });
    if (!ctx.groupMember || (ctx.groupMember.role !== 'admin' && ctx.groupMember.role !== 'owner')) {
      return res.status(403).json({ error: 'not_admin' });
    }
    const messageId = z.string().parse(req.body?.messageId);
    await prisma.conversation.update({
      where: { id: ctx.channel!.conversationId },
      data: { pinnedMessageId: messageId, pinnedAt: new Date(), pinnedById: me },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
