import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const referralRouter = Router();

referralRouter.get('/me', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: me },
      select: { referralCode: true, referredById: true },
    });
    if (!user) return res.status(404).json({ error: 'not_found' });

    let code = user.referralCode;
    if (!code) {
      code = await mint();
      await prisma.user.update({ where: { id: me }, data: { referralCode: code } });
    }

    const referrals = await prisma.user.findMany({
      where: { referredById: me },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, avatarUrl: true, createdAt: true, trustScore: true },
      take: 100,
    });

    const referredBy = user.referredById
      ? await prisma.user.findUnique({
          where: { id: user.referredById },
          select: { id: true, name: true, avatarUrl: true },
        })
      : null;

    res.json({ code, referrals, count: referrals.length, referredBy });
  } catch (e) { next(e); }
});

// Leaderboard — top referrers. Optional ?societyId= to scope to a society.
referralRouter.get('/leaderboard', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const me = req.user!.userId;
    const societyId = (req.query.societyId as string) || undefined;
    const sinceDays = parseInt((req.query.days as string) ?? '0', 10);
    const createdFilter = sinceDays > 0
      ? { createdAt: { gte: new Date(Date.now() - sinceDays * 86400_000) } }
      : undefined;

    const whereReferred: any = { referredById: { not: null }, ...(createdFilter ?? {}) };
    if (societyId) whereReferred.societyId = societyId;

    const grouped = await prisma.user.groupBy({
      by: ['referredById'],
      where: whereReferred,
      _count: { _all: true },
      orderBy: { _count: { referredById: 'desc' } },
      take: 20,
    });

    const ids = grouped.map((g) => g.referredById!).filter(Boolean);
    const users = ids.length
      ? await prisma.user.findMany({
          where: { id: { in: ids } },
          select: { id: true, name: true, avatarUrl: true, trustScore: true, kycVerified: true, societyId: true },
        })
      : [];
    const byId = new Map(users.map((u) => [u.id, u]));

    const leaderboard = grouped
      .map((g, i) => ({
        rank: i + 1,
        userId: g.referredById!,
        count: g._count._all,
        user: byId.get(g.referredById!) ?? null,
        isMe: g.referredById === me,
      }))
      .filter((r) => r.user);

    let myRow = leaderboard.find((r) => r.isMe) ?? null;
    if (!myRow) {
      const myCount = await prisma.user.count({ where: { ...whereReferred, referredById: me } });
      if (myCount > 0) {
        const meUser = await prisma.user.findUnique({
          where: { id: me },
          select: { id: true, name: true, avatarUrl: true, trustScore: true, kycVerified: true, societyId: true },
        });
        const ahead = await prisma.user.groupBy({
          by: ['referredById'],
          where: { ...whereReferred, referredById: { not: null } },
          _count: { _all: true },
          having: { referredById: { _count: { gt: myCount } } },
        });
        myRow = {
          rank: ahead.length + 1,
          userId: me,
          count: myCount,
          user: meUser,
          isMe: true,
        };
      }
    }

    res.json({ leaderboard, me: myRow });
  } catch (e) { next(e); }
});

async function mint(): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let i = 0; i < 8; i++) {
    const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const exists = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!exists) return code;
  }
  return `R${Date.now().toString(36).toUpperCase().slice(-6)}`;
}
