import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { encodeGeohash, distanceKm, neighborGeohashes, geoBoxWhere } from '../utils/geo.js';
import { ensureSocietyGroup, joinAllChannels } from '../services/groupChannels.js';
import { isAdminPhone } from '../middleware/auth.js';

export const societyRouter = Router();

const createSchema = z.object({
  name: z.string().min(2).max(120),
  city: z.string().min(2).max(80),
  pincode: z.string().min(4).max(10),
  address: z.string().max(300).optional(),
  lat: z.number(),
  lng: z.number(),
});

// Anyone signed in can create a society. Creator becomes the group OWNER, which gives
// them the full admin toolkit (mute / kick / promote / announce) via the existing groups API.
societyRouter.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const d = createSchema.parse(req.body);

    // Soft-dedupe: if a society with very close coords + similar name already exists, return it.
    const candidates = await prisma.society.findMany({
      where: { pincode: d.pincode },
      take: 50,
    });
    const dupe = candidates.find((s) =>
      s.name.toLowerCase().trim() === d.name.toLowerCase().trim()
      && Math.abs(s.lat - d.lat) < 0.005
      && Math.abs(s.lng - d.lng) < 0.005,
    );
    if (dupe) {
      const groupId = await ensureSocietyGroup(dupe.id);
      await joinAllChannels(groupId, req.user!.userId, 'member');
      return res.json({ society: dupe, duplicate: true, groupId });
    }

    const geohash = encodeGeohash(d.lat, d.lng);
    const society = await prisma.society.create({
      data: { ...d, geohash, createdById: req.user!.userId, memberCount: 1 },
    });
    // Set the creator's home society + auto-join with OWNER role of the auto-group
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { societyId: society.id },
    });
    const groupId = await ensureSocietyGroup(society.id);
    await joinAllChannels(groupId, req.user!.userId, 'owner');

    res.json({ society, groupId });
  } catch (e) { next(e); }
});

// Edit a society: creator OR platform admin only.
societyRouter.patch('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const society = await prisma.society.findUnique({ where: { id: req.params.id } });
    if (!society) return res.status(404).json({ error: 'not_found' });
    const me = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { phone: true } });
    const platformAdmin = isAdminPhone(me?.phone ?? '');
    if (society.createdById !== req.user!.userId && !platformAdmin) {
      return res.status(403).json({ error: 'forbidden' });
    }
    const patch = z.object({
      name: z.string().min(2).max(120).optional(),
      city: z.string().min(2).max(80).optional(),
      pincode: z.string().min(4).max(10).optional(),
      address: z.string().max(300).optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      verified: z.boolean().optional(),
    }).parse(req.body);
    // Only the platform admin can flip the `verified` flag.
    if (patch.verified !== undefined && !platformAdmin) delete patch.verified;
    if (patch.lat !== undefined && patch.lng !== undefined) {
      (patch as any).geohash = encodeGeohash(patch.lat, patch.lng);
    }
    const updated = await prisma.society.update({ where: { id: society.id }, data: patch });
    res.json({ society: updated });
  } catch (e) { next(e); }
});

// Delete: creator OR platform admin only. Refuses if there are >5 other members (use leave instead).
societyRouter.delete('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const society = await prisma.society.findUnique({ where: { id: req.params.id } });
    if (!society) return res.status(404).json({ error: 'not_found' });
    const me = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { phone: true } });
    const platformAdmin = isAdminPhone(me?.phone ?? '');
    if (society.createdById !== req.user!.userId && !platformAdmin) {
      return res.status(403).json({ error: 'forbidden' });
    }
    if (!platformAdmin && (society.memberCount ?? 0) > 5) {
      return res.status(409).json({ error: 'has_members', message: 'Society has active members; only platform admin can delete.' });
    }
    // Detach users + delete society's group cascade-style.
    const grp = await prisma.group.findUnique({ where: { societyId: society.id } });
    if (grp) {
      await prisma.channel.deleteMany({ where: { groupId: grp.id } });
      await prisma.groupMember.deleteMany({ where: { groupId: grp.id } });
      await prisma.groupAnnouncement.deleteMany({ where: { groupId: grp.id } });
      await prisma.group.delete({ where: { id: grp.id } });
    }
    await prisma.user.updateMany({ where: { societyId: society.id }, data: { societyId: null } });
    await prisma.society.delete({ where: { id: society.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// GET /api/societies/nearby?lat=..&lng=..&radiusKm=5
societyRouter.get('/nearby', async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radiusKm = parseFloat((req.query.radiusKm as string) ?? '5');
    if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: 'lat_lng_required' });

    const candidates = await prisma.society.findMany({
      where: geoBoxWhere(lat, lng, radiusKm),
      take: 200,
    });
    const results = candidates
      .map((s) => ({ ...s, distanceKm: distanceKm(lat, lng, s.lat, s.lng) }))
      .filter((s) => s.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);
    res.json({ societies: results });
  } catch (e) { next(e); }
});

// Search by free text (name / city / pincode) — used by LocationPicker
societyRouter.get('/search', async (req, res, next) => {
  try {
    const q = ((req.query.q as string) ?? '').trim();
    if (q.length < 2) return res.json({ societies: [] });
    const societies = await prisma.society.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { city: { contains: q } },
          { pincode: { contains: q } },
        ],
      },
      take: 25,
      orderBy: [{ verified: 'desc' }, { memberCount: 'desc' }],
    });
    res.json({ societies });
  } catch (e) { next(e); }
});

societyRouter.get('/:id', async (req, res, next) => {
  try {
    const society = await prisma.society.findUnique({
      where: { id: req.params.id },
      include: { groups: true },
    });
    if (!society) return res.status(404).json({ error: 'not_found' });
    res.json({ society });
  } catch (e) { next(e); }
});

societyRouter.post('/:id/join', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const society = await prisma.society.findUnique({ where: { id: req.params.id } });
    if (!society) return res.status(404).json({ error: 'not_found' });
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { societyId: society.id },
    });
    await prisma.society.update({
      where: { id: society.id },
      data: { memberCount: { increment: 1 } },
    });
    const groupId = await ensureSocietyGroup(society.id);
    await joinAllChannels(groupId, req.user!.userId, 'member');
    res.json({ ok: true, groupId });
  } catch (e) { next(e); }
});
