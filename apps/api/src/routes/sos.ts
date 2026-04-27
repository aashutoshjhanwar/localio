import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { encodeGeohash, distanceKm, neighborGeohashes } from '../utils/geo.js';
import { pushToUsers } from '../realtime/push.js';

export const sosRouter = Router();

// Broadcast an SOS to all nearby verified users AND into the caller's society #sos channel.
// POST /api/sos { lat, lng, body, category?: 'medical' | 'security' | 'fire' | 'other', radiusKm? }
sosRouter.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!.userId;
    const d = z.object({
      lat: z.number(),
      lng: z.number(),
      body: z.string().min(2).max(500),
      category: z.enum(['medical', 'security', 'fire', 'other']).default('other'),
      radiusKm: z.number().min(0.5).max(10).default(3),
    }).parse(req.body);

    const sender = await prisma.user.findUnique({
      where: { id: me },
      select: { id: true, name: true, phone: true, societyId: true, avatarUrl: true },
    });
    if (!sender) return res.status(404).json({ error: 'user_not_found' });

    const hash = encodeGeohash(d.lat, d.lng);
    const cells = neighborGeohashes(hash);

    // Candidate nearby users by geohash cell
    const candidates = await prisma.user.findMany({
      where: { geohash: { in: cells }, id: { not: me } },
      select: { id: true, lat: true, lng: true },
    });
    const nearbyIds = candidates
      .filter((u) => u.lat != null && u.lng != null && distanceKm(d.lat, d.lng, u.lat!, u.lng!) <= d.radiusKm)
      .map((u) => u.id);

    // Also include everyone in the caller's society group, regardless of exact geolocation
    let societyMemberIds: string[] = [];
    let channelId: string | undefined;
    if (sender.societyId) {
      const grp = await prisma.group.findUnique({
        where: { societyId: sender.societyId },
        include: { channels: { where: { slug: 'sos' } } },
      });
      if (grp) {
        const members = await prisma.groupMember.findMany({
          where: { groupId: grp.id, kickedAt: null, userId: { not: me } },
          select: { userId: true },
        });
        societyMemberIds = members.map((m) => m.userId);
        channelId = grp.channels[0]?.id;

        // Post into #sos channel so it shows in group chat
        if (grp.channels[0]) {
          await prisma.message.create({
            data: {
              conversationId: grp.channels[0].conversationId,
              senderId: me,
              type: 'system',
              body: `🚨 SOS (${d.category}) from ${sender.name ?? 'a neighbor'}: ${d.body}`,
              metadata: JSON.stringify({ kind: 'sos', lat: d.lat, lng: d.lng, category: d.category }),
            },
          });
        }
      }
    }

    const recipientIds = Array.from(new Set([...nearbyIds, ...societyMemberIds]));
    if (recipientIds.length > 0) {
      await pushToUsers(recipientIds, {
        type: 'sos',
        title: `🚨 SOS: ${sender.name ?? 'Neighbor'} needs help`,
        body: d.body.slice(0, 140),
        data: {
          kind: 'sos',
          category: d.category,
          lat: d.lat,
          lng: d.lng,
          senderId: me,
          senderName: sender.name,
          senderPhone: sender.phone,
          channelId,
        },
      });
    }

    res.json({ ok: true, reached: recipientIds.length, channelId });
  } catch (e) { next(e); }
});
