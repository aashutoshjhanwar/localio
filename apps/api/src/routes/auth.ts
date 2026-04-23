import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { issueOtp, verifyOtp } from '../utils/otp.js';
import { signToken } from '../utils/jwt.js';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';

export const authRouter = Router();

const phoneSchema = z
  .string()
  .regex(/^\+?[0-9]{10,15}$/, 'invalid phone');

authRouter.post('/request-otp', async (req, res, next) => {
  try {
    const { phone } = z.object({ phone: phoneSchema }).parse(req.body);
    const { expiresAt } = await issueOtp(phone);
    res.json({ ok: true, expiresAt });
  } catch (e) {
    next(e);
  }
});

authRouter.post('/verify-otp', async (req, res, next) => {
  try {
    const { phone, code, referralCode } = z
      .object({
        phone: phoneSchema,
        code: z.string().length(6),
        referralCode: z.string().min(4).max(12).optional(),
      })
      .parse(req.body);

    const ok = await verifyOtp(phone, code);
    if (!ok) return res.status(401).json({ error: 'invalid_otp' });

    const existing = await prisma.user.findUnique({ where: { phone } });
    let referredById: string | undefined;
    if (!existing && referralCode) {
      const ref = await prisma.user.findUnique({ where: { referralCode: referralCode.toUpperCase() } });
      if (ref) referredById = ref.id;
    }

    const user = await prisma.user.upsert({
      where: { phone },
      update: { phoneVerified: true },
      create: {
        phone,
        phoneVerified: true,
        referralCode: await generateReferralCode(),
        referredById,
      },
    });

    if (!user.referralCode) {
      await prisma.user.update({
        where: { id: user.id },
        data: { referralCode: await generateReferralCode() },
      });
    }

    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    const token = signToken({ userId: user.id, phone: user.phone });
    res.json({ token, user: fresh });
  } catch (e) {
    next(e);
  }
});

async function generateReferralCode(): Promise<string> {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let i = 0; i < 8; i++) {
    const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const exists = await prisma.user.findUnique({ where: { referralCode: code } });
    if (!exists) return code;
  }
  return `R${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

authRouter.get('/me', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: { society: true },
    });
    res.json({ user });
  } catch (e) {
    next(e);
  }
});
