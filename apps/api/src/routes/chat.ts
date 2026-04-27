import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const chatRouter = Router();

// Start or resume a direct conversation (optionally tied to a listing)
chatRouter.post('/direct', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { peerId, listingId } = z.object({
      peerId: z.string(),
      listingId: z.string().optional(),
    }).parse(req.body);

    const me = req.user!.userId;
    if (peerId === me) return res.status(400).json({ error: 'cannot_chat_self' });

    // Look for existing direct conversation between the two (matching listing if provided)
    const existing = await prisma.conversation.findFirst({
      where: {
        type: 'direct',
        ...(listingId ? { listingId } : { listingId: null }),
        AND: [
          { members: { some: { userId: me } } },
          { members: { some: { userId: peerId } } },
        ],
      },
      include: { members: true },
    });
    if (existing && existing.members.length === 2) {
      return res.json({ conversation: existing });
    }

    const conv = await prisma.conversation.create({
      data: {
        type: 'direct',
        listingId: listingId ?? null,
        members: {
          create: [{ userId: me }, { userId: peerId }],
        },
      },
      include: { members: true },
    });
    res.json({ conversation: conv });
  } catch (e) { next(e); }
});

// List my conversations (optionally archived=1 to fetch archived-only)
chatRouter.get('/conversations', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!.userId;
    const wantArchived = req.query.archived === '1';
    const convs = await prisma.conversation.findMany({
      where: {
        members: {
          some: {
            userId: me,
            ...(wantArchived ? { archivedAt: { not: null } } : { archivedAt: null }),
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: {
        members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        group: true,
      },
    });

    const withUnread = await Promise.all(convs.map(async (c) => {
      const mine = c.members.find((m) => m.userId === me);
      const since = mine?.lastReadAt ?? new Date(0);
      const unread = await prisma.message.count({
        where: { conversationId: c.id, createdAt: { gt: since }, senderId: { not: me } },
      });
      const muted = mine?.mutedUntil ? new Date(mine.mutedUntil).getTime() > Date.now() : false;
      return { ...c, unread, muted };
    }));
    res.json({ conversations: withUnread });
  } catch (e) { next(e); }
});

// Archive / unarchive a conversation for the current user only
chatRouter.post('/conversations/:id/archive', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!.userId;
    const archived = req.body?.archived !== false;
    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId: req.params.id, userId: me } },
      data: { archivedAt: archived ? new Date() : null },
    });
    res.json({ ok: true, archived });
  } catch (e) { next(e); }
});

// Mute / unmute a conversation for the current user (hours=0 → unmute, omitted → forever)
chatRouter.post('/conversations/:id/mute', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!.userId;
    const hours = typeof req.body?.hours === 'number' ? req.body.hours : null;
    let mutedUntil: Date | null;
    if (hours === 0) mutedUntil = null;
    else if (hours && hours > 0) mutedUntil = new Date(Date.now() + hours * 3600_000);
    else mutedUntil = new Date('2999-12-31T00:00:00Z');
    await prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId: req.params.id, userId: me } },
      data: { mutedUntil },
    });
    res.json({ ok: true, mutedUntil });
  } catch (e) { next(e); }
});

// Get single conversation details (peer, listing)
chatRouter.get('/conversations/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!.userId;
    const conv = await prisma.conversation.findFirst({
      where: { id: req.params.id, members: { some: { userId: me } } },
      include: {
        members: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
      },
    });
    if (!conv) return res.status(404).json({ error: 'not_found' });
    const peerMember = conv.members.find((m) => m.userId !== me);
    const peer = peerMember?.user ?? null;
    const peerLastReadAt = peerMember?.lastReadAt ?? null;
    let listing: any = null;
    if (conv.listingId) {
      const l = await prisma.listing.findUnique({
        where: { id: conv.listingId },
        select: { id: true, title: true, sellerId: true, priceInPaise: true, status: true, images: true },
      });
      if (l) {
        let images: string[] = [];
        try { const x = JSON.parse(l.images); if (Array.isArray(x)) images = x; } catch {}
        listing = { ...l, images };
      }
    }
    const mine = conv.members.find((m) => m.userId === me);
    const muted = mine?.mutedUntil ? new Date(mine.mutedUntil).getTime() > Date.now() : false;
    let pinned: any = null;
    if (conv.pinnedMessageId) {
      const pm = await prisma.message.findUnique({
        where: { id: conv.pinnedMessageId },
        include: { sender: { select: { id: true, name: true } } },
      });
      if (pm && !pm.deletedAt) pinned = { id: pm.id, body: pm.body, type: pm.type, sender: pm.sender, pinnedAt: conv.pinnedAt, pinnedById: conv.pinnedById };
    }
    res.json({ conversation: { id: conv.id, type: conv.type, listingId: conv.listingId, peer, peerLastReadAt, listing, muted, mutedUntil: mine?.mutedUntil ?? null, pinned } });
  } catch (e) { next(e); }
});

chatRouter.post('/conversations/:id/pin', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!.userId;
    const { messageId } = req.body as { messageId?: string };
    if (!messageId) return res.status(400).json({ error: 'messageId_required' });
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: req.params.id, userId: me } },
    });
    if (!member) return res.status(403).json({ error: 'not_a_member' });
    const msg = await prisma.message.findFirst({ where: { id: messageId, conversationId: req.params.id, deletedAt: null } });
    if (!msg) return res.status(404).json({ error: 'message_not_found' });
    await prisma.conversation.update({
      where: { id: req.params.id },
      data: { pinnedMessageId: messageId, pinnedAt: new Date(), pinnedById: me },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

chatRouter.delete('/conversations/:id/pin', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!.userId;
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: req.params.id, userId: me } },
    });
    if (!member) return res.status(403).json({ error: 'not_a_member' });
    await prisma.conversation.update({
      where: { id: req.params.id },
      data: { pinnedMessageId: null, pinnedAt: null, pinnedById: null },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Get messages in a conversation (paginated)
chatRouter.get('/conversations/:id/messages', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!.userId;
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: req.params.id, userId: me } },
    });
    if (!member) return res.status(403).json({ error: 'not_a_member' });

    const before = req.query.before ? new Date(req.query.before as string) : new Date();
    const messages = await prisma.message.findMany({
      where: { conversationId: req.params.id, createdAt: { lt: before } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
        reactions: { select: { emoji: true, userId: true } },
        replyTo: {
          select: {
            id: true, body: true, type: true, senderId: true,
            sender: { select: { id: true, name: true } },
          },
        },
      },
    });
    res.json({ messages: messages.reverse() });
  } catch (e) { next(e); }
});

// Search text within a conversation
// Global search — across ALL my conversations, groups and channels.
// Something WhatsApp still cannot do in 2026.
chatRouter.get('/search', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!.userId;
    const q = ((req.query.q as string) ?? '').trim();
    if (q.length < 2) return res.json({ results: [] });

    const myConvs = await prisma.conversationMember.findMany({
      where: { userId: me }, select: { conversationId: true },
    });
    const convIds = myConvs.map((c) => c.conversationId);
    if (convIds.length === 0) return res.json({ results: [] });

    const messages = await prisma.message.findMany({
      where: {
        conversationId: { in: convIds },
        deletedAt: null,
        body: { contains: q },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        sender: { select: { id: true, name: true, avatarUrl: true } },
        conversation: {
          select: {
            id: true, type: true, listingId: true,
            group: { select: { id: true, name: true } },
            channel: { select: { id: true, name: true, emoji: true, groupId: true } },
            members: { where: { userId: { not: me } }, take: 1, include: { user: { select: { id: true, name: true } } } },
          },
        },
      },
    });

    const results = messages.map((m) => ({
      messageId: m.id,
      body: m.body,
      type: m.type,
      createdAt: m.createdAt,
      sender: m.sender,
      conversationId: m.conversationId,
      conversationType: m.conversation.type,
      channel: m.conversation.channel,
      group: m.conversation.group,
      peer: m.conversation.members[0]?.user ?? null,
    }));

    res.json({ results });
  } catch (e) { next(e); }
});

chatRouter.get('/conversations/:id/search', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!.userId;
    const q = ((req.query.q as string) ?? '').trim();
    if (!q) return res.json({ messages: [] });
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: req.params.id, userId: me } },
    });
    if (!member) return res.status(403).json({ error: 'not_a_member' });
    const messages = await prisma.message.findMany({
      where: {
        conversationId: req.params.id,
        deletedAt: null,
        body: { contains: q },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { sender: { select: { id: true, name: true } } },
    });
    res.json({ messages });
  } catch (e) { next(e); }
});

// Send message via REST (socket is preferred, this is fallback)
chatRouter.post('/conversations/:id/messages', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!.userId;
    const { type, body, mediaUrl, metadata, replyToId } = z.object({
      type: z.enum(['text', 'image', 'offer', 'system', 'location']).default('text'),
      body: z.string().min(1).max(4000),
      mediaUrl: z.string().url().optional(),
      metadata: z.any().optional(),
      replyToId: z.string().optional(),
    }).parse(req.body);

    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: req.params.id, userId: me } },
    });
    if (!member) return res.status(403).json({ error: 'not_a_member' });

    const msg = await prisma.message.create({
      data: {
        conversationId: req.params.id,
        senderId: me,
        type,
        body,
        mediaUrl,
        metadata: metadata ? JSON.stringify(metadata) : null,
        replyToId: replyToId ?? null,
      },
      include: {
        replyTo: {
          select: {
            id: true, body: true, type: true, senderId: true,
            sender: { select: { id: true, name: true } },
          },
        },
      },
    });
    await prisma.conversation.update({
      where: { id: req.params.id },
      data: { updatedAt: new Date() },
    });
    res.json({ message: msg });
  } catch (e) { next(e); }
});

// Total unread message count across all my conversations (for tab badge)
chatRouter.get('/unread', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!.userId;
    const members = await prisma.conversationMember.findMany({
      where: { userId: me },
      select: { conversationId: true, lastReadAt: true },
    });
    let total = 0;
    await Promise.all(members.map(async (m) => {
      const since = m.lastReadAt ?? new Date(0);
      const n = await prisma.message.count({
        where: {
          conversationId: m.conversationId,
          createdAt: { gt: since },
          senderId: { not: me },
        },
      });
      total += n;
    }));
    res.json({ unread: total });
  } catch (e) { next(e); }
});

// Mark conversation as read
chatRouter.post('/conversations/:id/read', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const now = new Date();
    await prisma.conversationMember.update({
      where: {
        conversationId_userId: { conversationId: req.params.id, userId: req.user!.userId },
      },
      data: { lastReadAt: now },
    });
    res.json({ ok: true });
    const io = req.app.get('io') as import('socket.io').Server | undefined;
    io?.to(`conv:${req.params.id}`).emit('conversation:read', {
      conversationId: req.params.id,
      userId: req.user!.userId,
      lastReadAt: now.toISOString(),
    });
  } catch (e) { next(e); }
});

// Sender can patch a message's metadata/body — used for live-location updates and edits.
const EDIT_WINDOW_MS = 15 * 60 * 1000;
const DELETE_WINDOW_MS = 60 * 60 * 1000;
chatRouter.patch('/messages/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const d = z.object({
      metadata: z.any().optional(),
      body: z.string().min(1).max(4000).optional(),
    }).parse(req.body);

    const msg = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!msg) return res.status(404).json({ error: 'not_found' });
    if (msg.senderId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });
    if (msg.deletedAt) return res.status(410).json({ error: 'deleted' });

    const isBodyEdit = d.body !== undefined && d.body !== msg.body;
    if (isBodyEdit) {
      if (Date.now() - msg.createdAt.getTime() > EDIT_WINDOW_MS) {
        return res.status(403).json({ error: 'edit_window_expired' });
      }
      if (msg.type !== 'text') return res.status(400).json({ error: 'only_text_editable' });
    }

    const updated = await prisma.message.update({
      where: { id: msg.id },
      data: {
        metadata: d.metadata !== undefined ? JSON.stringify(d.metadata) : msg.metadata,
        body: d.body ?? msg.body,
        editedAt: isBodyEdit ? new Date() : msg.editedAt,
      },
    });
    res.json({ message: updated });

    const io = req.app.get('io') as import('socket.io').Server | undefined;
    io?.to(`conv:${msg.conversationId}`).emit('message:updated', {
      conversationId: msg.conversationId,
      messageId: msg.id,
      metadata: d.metadata,
      body: updated.body,
      editedAt: updated.editedAt,
    });
  } catch (e) { next(e); }
});

// Sender can delete own message (tombstone) within 1 hour
chatRouter.delete('/messages/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const msg = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!msg) return res.status(404).json({ error: 'not_found' });
    if (msg.senderId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });
    if (msg.deletedAt) return res.json({ ok: true });
    if (Date.now() - msg.createdAt.getTime() > DELETE_WINDOW_MS) {
      return res.status(403).json({ error: 'delete_window_expired' });
    }

    await prisma.message.update({
      where: { id: msg.id },
      data: { deletedAt: new Date(), body: '', mediaUrl: null, metadata: null },
    });
    res.json({ ok: true });

    const io = req.app.get('io') as import('socket.io').Server | undefined;
    io?.to(`conv:${msg.conversationId}`).emit('message:deleted', {
      conversationId: msg.conversationId,
      messageId: msg.id,
    });
  } catch (e) { next(e); }
});

// Toggle a reaction (emoji) on a message. Same emoji twice removes it.
chatRouter.post('/messages/:id/react', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { emoji } = z.object({ emoji: z.string().min(1).max(8) }).parse(req.body);
    const me = req.user!.userId;
    const msg = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!msg) return res.status(404).json({ error: 'not_found' });
    const member = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: msg.conversationId, userId: me } },
    });
    if (!member) return res.status(403).json({ error: 'not_a_member' });

    const existing = await prisma.messageReaction.findUnique({
      where: { messageId_userId_emoji: { messageId: msg.id, userId: me, emoji } },
    });
    let added = false;
    if (existing) {
      await prisma.messageReaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.messageReaction.create({ data: { messageId: msg.id, userId: me, emoji } });
      added = true;
    }
    const reactions = await prisma.messageReaction.findMany({
      where: { messageId: msg.id },
      select: { emoji: true, userId: true },
    });
    res.json({ ok: true, added, reactions });

    const io = req.app.get('io') as import('socket.io').Server | undefined;
    io?.to(`conv:${msg.conversationId}`).emit('message:reaction', {
      conversationId: msg.conversationId,
      messageId: msg.id,
      reactions,
    });
  } catch (e) { next(e); }
});
