import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireAdmin, type AuthedRequest } from '../middleware/auth.js';

export const reportRouter = Router();

// Users submit reports
reportRouter.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const d = z.object({
      targetType: z.enum(['listing', 'service', 'user', 'message', 'post']),
      targetId: z.string(),
      reason: z.enum(['spam', 'scam', 'offensive', 'unsafe', 'duplicate', 'other']),
      notes: z.string().max(1000).optional(),
    }).parse(req.body);

    const report = await prisma.report.create({
      data: { ...d, reporterId: req.user!.userId },
    });

    // Auto-hide threshold: 3+ open reports → mark listing/service inactive.
    const openCount = await prisma.report.count({
      where: { targetType: d.targetType, targetId: d.targetId, status: 'open' },
    });
    if (openCount >= 3) {
      if (d.targetType === 'listing') {
        await prisma.listing.updateMany({
          where: { id: d.targetId },
          data: { status: 'closed' },
        });
      } else if (d.targetType === 'service') {
        await prisma.service.updateMany({
          where: { id: d.targetId },
          data: { available: false },
        });
      } else if (d.targetType === 'post') {
        await prisma.post.deleteMany({ where: { id: d.targetId } });
      }
    }

    res.json({ report });
  } catch (e) { next(e); }
});

// Admin: list reports + moderation stats
reportRouter.get('/', requireAdmin, async (req, res, next) => {
  try {
    const status = (req.query.status as string) ?? 'open';
    const reports = await prisma.report.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { reporter: { select: { id: true, name: true, phone: true } } },
    });
    const [openCount, resolvedCount, dismissedCount] = await Promise.all([
      prisma.report.count({ where: { status: 'open' } }),
      prisma.report.count({ where: { status: 'resolved' } }),
      prisma.report.count({ where: { status: 'dismissed' } }),
    ]);
    res.json({ reports, stats: { open: openCount, resolved: resolvedCount, dismissed: dismissedCount } });
  } catch (e) { next(e); }
});

// Admin: resolve or dismiss a report; optionally take action on target
reportRouter.post('/:id/resolve', requireAdmin, async (req: AuthedRequest, res, next) => {
  try {
    const d = z.object({
      action: z.enum(['dismiss', 'resolve', 'take_down']),
    }).parse(req.body);

    const report = await prisma.report.findUnique({ where: { id: req.params.id } });
    if (!report) return res.status(404).json({ error: 'not_found' });

    if (d.action === 'take_down') {
      if (report.targetType === 'listing') {
        await prisma.listing.updateMany({ where: { id: report.targetId }, data: { status: 'closed' } });
      } else if (report.targetType === 'service') {
        await prisma.service.updateMany({ where: { id: report.targetId }, data: { available: false } });
      } else if (report.targetType === 'post') {
        await prisma.post.deleteMany({ where: { id: report.targetId } });
      }
    }

    const status = d.action === 'dismiss' ? 'dismissed' : 'resolved';
    // Resolve ALL open reports on the same target to clear the queue.
    await prisma.report.updateMany({
      where: { targetType: report.targetType, targetId: report.targetId, status: 'open' },
      data: { status, resolvedAt: new Date() },
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// Admin: fetch the reported target's current snapshot so mods can see context
reportRouter.get('/target/:type/:id', requireAdmin, async (req, res, next) => {
  try {
    const { type, id } = req.params;
    if (type === 'listing') {
      const l = await prisma.listing.findUnique({ where: { id }, include: { seller: { select: { id: true, name: true, phone: true } } } });
      return res.json({ target: l });
    }
    if (type === 'service') {
      const s = await prisma.service.findUnique({ where: { id }, include: { provider: { select: { id: true, name: true, phone: true } } } });
      return res.json({ target: s });
    }
    if (type === 'post') {
      const p = await prisma.post.findUnique({ where: { id }, include: { author: { select: { id: true, name: true, phone: true } } } });
      return res.json({ target: p });
    }
    if (type === 'user') {
      const u = await prisma.user.findUnique({ where: { id }, select: { id: true, name: true, phone: true, trustScore: true, kycVerified: true } });
      return res.json({ target: u });
    }
    return res.status(400).json({ error: 'unsupported_type' });
  } catch (e) { next(e); }
});
