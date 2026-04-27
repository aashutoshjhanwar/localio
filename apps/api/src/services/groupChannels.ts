import { prisma } from '../db/prisma.js';

// Default channels every society-group gets on creation.
export const DEFAULT_CHANNELS: Array<{
  slug: string;
  name: string;
  kind: string;
  emoji: string;
  readOnly?: boolean;
  sortOrder: number;
}> = [
  { slug: 'announcements', name: 'Announcements', kind: 'announcements', emoji: '📢', readOnly: true, sortOrder: 0 },
  { slug: 'general',       name: 'General',       kind: 'general',       emoji: '💬', sortOrder: 1 },
  { slug: 'buy-sell',      name: 'Buy & Sell',    kind: 'buy_sell',      emoji: '🛒', sortOrder: 2 },
  { slug: 'services',      name: 'Services',      kind: 'services',      emoji: '🔧', sortOrder: 3 },
  { slug: 'lost-found',    name: 'Lost & Found',  kind: 'lost_found',    emoji: '🔍', sortOrder: 4 },
  { slug: 'events',        name: 'Events',        kind: 'events',        emoji: '🎉', sortOrder: 5 },
  { slug: 'sos',           name: 'SOS',           kind: 'sos',           emoji: '🚨', sortOrder: 6 },
];

// Ensure a group has all default channels. Idempotent.
export async function ensureDefaultChannels(groupId: string) {
  const existing = await prisma.channel.findMany({ where: { groupId }, select: { slug: true } });
  const have = new Set(existing.map((c) => c.slug));
  for (const c of DEFAULT_CHANNELS) {
    if (have.has(c.slug)) continue;
    const conv = await prisma.conversation.create({
      data: { type: 'channel' },
    });
    await prisma.channel.create({
      data: {
        groupId,
        slug: c.slug,
        name: c.name,
        kind: c.kind,
        emoji: c.emoji,
        readOnly: c.readOnly ?? false,
        sortOrder: c.sortOrder,
        conversationId: conv.id,
      },
    });
  }
}

// Ensure a society has a group and default channels. Returns groupId.
export async function ensureSocietyGroup(societyId: string): Promise<string> {
  const society = await prisma.society.findUnique({ where: { id: societyId } });
  if (!society) throw new Error('society_not_found');

  let group = await prisma.group.findUnique({ where: { societyId } });
  if (!group) {
    group = await prisma.group.create({
      data: {
        name: society.name,
        description: `Community group for ${society.name}`,
        societyId,
        isPublic: true,
      },
    });
  }
  await ensureDefaultChannels(group.id);
  return group.id;
}

// Add a user to every channel conversation of a group. Also adds to GroupMember.
export async function joinAllChannels(groupId: string, userId: string, role: 'member' | 'admin' | 'owner' = 'member') {
  await prisma.groupMember.upsert({
    where: { groupId_userId: { groupId, userId } },
    update: { kickedAt: null },
    create: { groupId, userId, role },
  });
  const channels = await prisma.channel.findMany({ where: { groupId }, select: { conversationId: true } });
  for (const ch of channels) {
    await prisma.conversationMember.upsert({
      where: { conversationId_userId: { conversationId: ch.conversationId, userId } },
      update: { archivedAt: null },
      create: { conversationId: ch.conversationId, userId },
    });
  }
}
