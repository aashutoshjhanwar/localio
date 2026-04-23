import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth, requireAdmin, type AuthedRequest } from '../middleware/auth.js';

export const analyticsRouter = Router();

analyticsRouter.get('/overview', requireAuth, requireAdmin, async (_req: AuthedRequest, res, next) => {
  try {
    const now = Date.now();
    const day = 24 * 3600 * 1000;
    const since7 = new Date(now - 7 * day);
    const since30 = new Date(now - 30 * day);

    const [
      users, listings, services, bookings, posts, polls, events, societies,
      usersNew7, usersNew30, listingsNew7, servicesNew7, bookingsNew7, postsNew7,
      reportsOpen, reportsResolved, ratingsCount,
      bookingsByStatus,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.listing.count(),
      prisma.service.count(),
      prisma.booking.count(),
      prisma.post.count(),
      prisma.poll.count(),
      prisma.event.count(),
      prisma.society.count(),
      prisma.user.count({ where: { createdAt: { gte: since7 } } }),
      prisma.user.count({ where: { createdAt: { gte: since30 } } }),
      prisma.listing.count({ where: { createdAt: { gte: since7 } } }),
      prisma.service.count({ where: { createdAt: { gte: since7 } } }),
      prisma.booking.count({ where: { createdAt: { gte: since7 } } }),
      prisma.post.count({ where: { createdAt: { gte: since7 } } }),
      prisma.report.count({ where: { status: 'open' } }),
      prisma.report.count({ where: { status: 'resolved' } }),
      prisma.rating.count(),
      prisma.booking.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);

    const topCategories = await prisma.listing.groupBy({
      by: ['category'],
      _count: { _all: true },
      orderBy: { _count: { category: 'desc' } },
      take: 5,
    });

    const dailySignups: Array<{ date: string; count: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const start = new Date(now - i * day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + day);
      const count = await prisma.user.count({ where: { createdAt: { gte: start, lt: end } } });
      dailySignups.push({ date: start.toISOString().slice(0, 10), count });
    }

    res.json({
      totals: { users, listings, services, bookings, posts, polls, events, societies, ratings: ratingsCount },
      growth7d: { users: usersNew7, listings: listingsNew7, services: servicesNew7, bookings: bookingsNew7, posts: postsNew7 },
      growth30d: { users: usersNew30 },
      moderation: { reportsOpen, reportsResolved },
      bookingsByStatus: bookingsByStatus.map((b) => ({ status: b.status, count: b._count._all })),
      topCategories: topCategories.map((c) => ({ category: c.category, count: c._count._all })),
      dailySignups,
    });
  } catch (e) { next(e); }
});
