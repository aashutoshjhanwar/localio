import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { ensureDefaultChannels, joinAllChannels } from '../services/groupChannels.js';

export const groupRouter = Router();

// Helper: require the caller to be an admin/owner of the group
async function requireGroupAdmin(groupId: string, userId: string) {
  const m = await prisma.groupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
  });
  if (!m || (m.role !== 'admin' && m.role !== 'owner')) {
    const err: any = new Error('not_admin');
    err.status = 403;
    throw err;
  }
  return m;
}

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
    await ensureDefaultChannels(group.id);
    await joinAllChannels(group.id, req.user!.userId, 'owner');
    res.json({ group });
  } catch (e) { next(e); }
});

// List groups (optionally filter by society)
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

// My groups
groupRouter.get('/mine', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const rows = await prisma.groupMember.findMany({
      where: { userId: req.user!.userId, kickedAt: null },
      include: {
        group: { include: { _count: { select: { members: true } }, society: true } },
      },
      orderBy: { joinedAt: 'desc' },
    });
    res.json({ groups: rows.map((r) => ({ ...r.group, role: r.role })) });
  } catch (e) { next(e); }
});

// Group details with channels + my membership
groupRouter.get('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!.userId;
    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      include: {
        society: true,
        _count: { select: { members: true } },
        channels: { orderBy: { sortOrder: 'asc' } },
        announcements: { where: { pinned: true }, orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!group) return res.status(404).json({ error: 'not_found' });
    const mine = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId: me } },
    });
    res.json({ group, membership: mine });
  } catch (e) { next(e); }
});

// List members
groupRouter.get('/:id/members', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const members = await prisma.groupMember.findMany({
      where: { groupId: req.params.id, kickedAt: null },
      include: { user: { select: { id: true, name: true, avatarUrl: true, trustScore: true, kycVerified: true } } },
      orderBy: [{ role: 'desc' }, { joinedAt: 'asc' }],
    });
    res.json({ members });
  } catch (e) { next(e); }
});

groupRouter.post('/:id/join', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const group = await prisma.group.findUnique({ where: { id: req.params.id } });
    if (!group) return res.status(404).json({ error: 'not_found' });
    await joinAllChannels(group.id, req.user!.userId, 'member');
    res.json({ ok: true });
  } catch (e) { next(e); }
});

groupRouter.post('/:id/leave', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const groupId = req.params.id;
    const me = req.user!.userId;
    await prisma.groupMember.deleteMany({ where: { groupId, userId: me } });
    const channels = await prisma.channel.findMany({ where: { groupId }, select: { conversationId: true } });
    for (const ch of channels) {
      await prisma.conversationMember.deleteMany({
        where: { conversationId: ch.conversationId, userId: me },
      });
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---- Admin actions ----

// Promote/demote a member (member | admin)
groupRouter.post('/:id/members/:userId/role', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await requireGroupAdmin(req.params.id, req.user!.userId);
    const role = z.enum(['member', 'admin']).parse(req.body?.role);
    const target = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: req.params.id, userId: req.params.userId } },
    });
    if (!target) return res.status(404).json({ error: 'not_a_member' });
    if (target.role === 'owner') return res.status(400).json({ error: 'cannot_change_owner' });
    const updated = await prisma.groupMember.update({
      where: { groupId_userId: { groupId: req.params.id, userId: req.params.userId } },
      data: { role },
    });
    res.json({ member: updated });
  } catch (e) { next(e); }
});

// Kick a member
groupRouter.post('/:id/members/:userId/kick', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await requireGroupAdmin(req.params.id, req.user!.userId);
    const target = await prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: req.params.id, userId: req.params.userId } },
    });
    if (!target) return res.status(404).json({ error: 'not_a_member' });
    if (target.role === 'owner') return res.status(400).json({ error: 'cannot_kick_owner' });
    await prisma.groupMember.update({
      where: { groupId_userId: { groupId: req.params.id, userId: req.params.userId } },
      data: { kickedAt: new Date() },
    });
    const channels = await prisma.channel.findMany({ where: { groupId: req.params.id }, select: { conversationId: true } });
    for (const ch of channels) {
      await prisma.conversationMember.deleteMany({
        where: { conversationId: ch.conversationId, userId: req.params.userId },
      });
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Mute a member inside the group (hours>0, 0 to unmute)
groupRouter.post('/:id/members/:userId/mute', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await requireGroupAdmin(req.params.id, req.user!.userId);
    const hours = z.number().min(0).max(24 * 30).parse(req.body?.hours ?? 24);
    const mutedUntil = hours === 0 ? null : new Date(Date.now() + hours * 3600_000);
    const updated = await prisma.groupMember.update({
      where: { groupId_userId: { groupId: req.params.id, userId: req.params.userId } },
      data: { mutedUntil },
    });
    res.json({ member: updated });
  } catch (e) { next(e); }
});

// Pinned announcements
groupRouter.post('/:id/announcements', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await requireGroupAdmin(req.params.id, req.user!.userId);
    const d = z.object({
      title: z.string().min(2).max(120),
      body: z.string().min(2).max(4000),
      pinned: z.boolean().optional(),
    }).parse(req.body);
    const ann = await prisma.groupAnnouncement.create({
      data: { groupId: req.params.id, authorId: req.user!.userId, ...d, pinned: d.pinned ?? true },
    });
    // Also post into the #announcements channel if present
    const ch = await prisma.channel.findUnique({
      where: { groupId_slug: { groupId: req.params.id, slug: 'announcements' } },
    });
    if (ch) {
      await prisma.message.create({
        data: {
          conversationId: ch.conversationId,
          senderId: req.user!.userId,
          type: 'system',
          body: `📢 ${d.title}\n\n${d.body}`,
          metadata: JSON.stringify({ kind: 'announcement', announcementId: ann.id }),
        },
      });
    }
    res.json({ announcement: ann });
  } catch (e) { next(e); }
});

groupRouter.get('/:id/announcements', async (req, res, next) => {
  try {
    const anns = await prisma.groupAnnouncement.findMany({
      where: { groupId: req.params.id },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });
    res.json({ announcements: anns });
  } catch (e) { next(e); }
});

groupRouter.delete('/:id/announcements/:annId', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    await requireGroupAdmin(req.params.id, req.user!.userId);
    await prisma.groupAnnouncement.delete({ where: { id: req.params.annId } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
