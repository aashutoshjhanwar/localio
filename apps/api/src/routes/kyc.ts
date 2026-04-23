import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireAdmin, type AuthedRequest } from '../middleware/auth.js';
import { pushToUser } from '../realtime/push.js';

export const kycRouter = Router();

const submitSchema = z.object({
  docType: z.enum(['aadhaar', 'pan', 'dl', 'passport']),
  docUrl: z.string().url(),
  selfieUrl: z.string().url(),
});

kycRouter.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const d = submitSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (user?.kycVerified) return res.status(400).json({ error: 'already_verified' });

    const open = await prisma.kycSubmission.findFirst({
      where: { userId: req.user!.userId, status: 'pending' },
    });
    if (open) return res.status(409).json({ error: 'pending_exists', submission: open });

    const submission = await prisma.kycSubmission.create({
      data: {
        userId: req.user!.userId,
        docType: d.docType, docUrl: d.docUrl, selfieUrl: d.selfieUrl,
      },
    });
    res.json({ submission });
  } catch (e) { next(e); }
});

kycRouter.get('/mine', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const rows = await prisma.kycSubmission.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    res.json({ submissions: rows });
  } catch (e) { next(e); }
});

kycRouter.get('/admin/pending', requireAuth, requireAdmin, async (_req: AuthedRequest, res, next) => {
  try {
    const rows = await prisma.kycSubmission.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, name: true, phone: true, avatarUrl: true } } },
    });
    res.json({ submissions: rows });
  } catch (e) { next(e); }
});

kycRouter.post('/admin/:id/approve', requireAuth, requireAdmin, async (req: AuthedRequest, res, next) => {
  try {
    const s = await prisma.kycSubmission.findUnique({ where: { id: req.params.id } });
    if (!s || s.status !== 'pending') return res.status(404).json({ error: 'not_found' });
    const [updated] = await prisma.$transaction([
      prisma.kycSubmission.update({
        where: { id: s.id },
        data: { status: 'approved', reviewedAt: new Date(), reviewedBy: req.user!.userId },
      }),
      prisma.user.update({
        where: { id: s.userId },
        data: { kycVerified: true, trustScore: { increment: 1 } },
      }),
    ]);
    pushToUser(s.userId, {
      title: '✅ You are verified',
      body: 'Your KYC has been approved. You now have the verified badge.',
      type: 'kyc_approved',
    }).catch(() => {});
    res.json({ submission: updated });
  } catch (e) { next(e); }
});

kycRouter.post('/admin/:id/reject', requireAuth, requireAdmin, async (req: AuthedRequest, res, next) => {
  try {
    const reason = z.object({ reason: z.string().max(200).optional() }).parse(req.body ?? {}).reason;
    const s = await prisma.kycSubmission.findUnique({ where: { id: req.params.id } });
    if (!s || s.status !== 'pending') return res.status(404).json({ error: 'not_found' });
    const updated = await prisma.kycSubmission.update({
      where: { id: s.id },
      data: { status: 'rejected', reason, reviewedAt: new Date(), reviewedBy: req.user!.userId },
    });
    pushToUser(s.userId, {
      title: 'KYC needs attention',
      body: reason ?? 'Please resubmit with clearer documents.',
      type: 'kyc_rejected',
    }).catch(() => {});
    res.json({ submission: updated });
  } catch (e) { next(e); }
});
