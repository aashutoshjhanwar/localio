import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const slotRouter = Router();

slotRouter.get('/service/:serviceId', async (req, res, next) => {
  try {
    const slots = await prisma.serviceSlot.findMany({
      where: { serviceId: req.params.serviceId, startsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
      take: 100,
    });
    res.json({ slots });
  } catch (e) { next(e); }
});

slotRouter.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const d = z.object({
      serviceId: z.string(),
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime(),
    }).parse(req.body);

    const service = await prisma.service.findUnique({ where: { id: d.serviceId } });
    if (!service) return res.status(404).json({ error: 'service_not_found' });
    if (service.providerId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });
    if (Date.parse(d.endsAt) <= Date.parse(d.startsAt)) return res.status(400).json({ error: 'bad_range' });

    const slot = await prisma.serviceSlot.create({
      data: {
        serviceId: d.serviceId,
        startsAt: new Date(d.startsAt),
        endsAt: new Date(d.endsAt),
      },
    });
    res.json({ slot });
  } catch (e) { next(e); }
});

slotRouter.delete('/:id', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const slot = await prisma.serviceSlot.findUnique({
      where: { id: req.params.id },
      include: { service: true },
    });
    if (!slot) return res.status(404).json({ error: 'not_found' });
    if (slot.service.providerId !== req.user!.userId) return res.status(403).json({ error: 'forbidden' });
    if (slot.status === 'booked') return res.status(400).json({ error: 'already_booked' });
    await prisma.serviceSlot.delete({ where: { id: slot.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
