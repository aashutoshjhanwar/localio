import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { pushToUser } from '../realtime/push.js';

export const bookingRouter = Router();

// Customer creates a booking
bookingRouter.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const d = z.object({
      serviceId: z.string(),
      scheduledAt: z.string().datetime().optional(),
      notes: z.string().max(1000).optional(),
      slotId: z.string().optional(),
    }).parse(req.body);

    const service = await prisma.service.findUnique({ where: { id: d.serviceId } });
    if (!service) return res.status(404).json({ error: 'service_not_found' });
    if (service.providerId === req.user!.userId) return res.status(400).json({ error: 'cannot_book_own_service' });

    let scheduledAt = d.scheduledAt ? new Date(d.scheduledAt) : null;
    if (d.slotId) {
      const slot = await prisma.serviceSlot.findUnique({ where: { id: d.slotId } });
      if (!slot || slot.serviceId !== service.id) return res.status(404).json({ error: 'slot_not_found' });
      if (slot.status !== 'open') return res.status(400).json({ error: 'slot_unavailable' });
      scheduledAt = slot.startsAt;
    }

    const booking = await prisma.booking.create({
      data: {
        serviceId: service.id,
        customerId: req.user!.userId,
        providerId: service.providerId,
        scheduledAt,
        notes: d.notes,
        priceInPaise: service.priceFrom ?? null,
      },
    });

    if (d.slotId) {
      await prisma.serviceSlot.update({
        where: { id: d.slotId },
        data: { status: 'booked', bookingId: booking.id },
      });
    }

    pushToUser(service.providerId, {
      type: 'booking_request',
      title: 'New booking request',
      body: service.title,
      data: { bookingId: booking.id },
    }).catch(() => {});

    res.json({ booking });
  } catch (e) { next(e); }
});

// List my bookings (customer or provider)
bookingRouter.get('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const role = (req.query.role as string) ?? 'customer';
    const me = req.user!.userId;
    const where = role === 'provider' ? { providerId: me } : { customerId: me };
    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        customer: { select: { id: true, name: true, avatarUrl: true } },
        provider: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
    res.json({ bookings });
  } catch (e) { next(e); }
});

// Provider/customer updates status
bookingRouter.post('/:id/status', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { status } = z.object({
      status: z.enum(['accepted', 'rejected', 'completed', 'cancelled']),
    }).parse(req.body);

    const booking = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!booking) return res.status(404).json({ error: 'not_found' });

    const me = req.user!.userId;
    const isProvider = booking.providerId === me;
    const isCustomer = booking.customerId === me;
    if (!isProvider && !isCustomer) return res.status(403).json({ error: 'forbidden' });

    // Simple state rules
    if ((status === 'accepted' || status === 'rejected' || status === 'completed') && !isProvider) {
      return res.status(403).json({ error: 'only_provider_can_do_that' });
    }
    if (status === 'cancelled' && booking.status !== 'requested' && booking.status !== 'accepted') {
      return res.status(400).json({ error: 'cannot_cancel_now' });
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status },
    });

    if (status === 'rejected' || status === 'cancelled') {
      await prisma.serviceSlot.updateMany({
        where: { bookingId: booking.id },
        data: { status: 'open', bookingId: null },
      });
    }

    const other = isProvider ? booking.customerId : booking.providerId;
    pushToUser(other, {
      type: 'booking_update',
      title: `Booking ${status}`,
      body: `Your booking was ${status}.`,
      data: { bookingId: booking.id },
    }).catch(() => {});

    res.json({ booking: updated });
  } catch (e) { next(e); }
});
