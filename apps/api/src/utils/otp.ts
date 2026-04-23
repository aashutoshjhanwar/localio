import { prisma } from '../db/prisma.js';
import { env } from '../config/env.js';

const OTP_TTL_MIN = 10;

export function generateCode(): string {
  if (env.isDev && env.OTP_DEV_BYPASS) return env.OTP_DEV_BYPASS;
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function issueOtp(phone: string) {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000);
  await prisma.otp.create({ data: { phone, code, expiresAt } });
  if (env.isDev) {
    // eslint-disable-next-line no-console
    console.log(`[OTP] ${phone} -> ${code} (valid ${OTP_TTL_MIN}m)`);
  }
  if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM) {
    try {
      const body = new URLSearchParams({
        To: phone,
        From: env.TWILIO_FROM,
        Body: `Your LOCALIO code is ${code}. Valid for ${OTP_TTL_MIN} minutes.`,
      });
      const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
      const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      if (!resp.ok) {
        // eslint-disable-next-line no-console
        console.error('[OTP] Twilio send failed', resp.status, await resp.text().catch(() => ''));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[OTP] Twilio error', e);
    }
  }
  return { expiresAt };
}

export async function verifyOtp(phone: string, code: string): Promise<boolean> {
  const record = await prisma.otp.findFirst({
    where: { phone, code, consumed: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) return false;
  await prisma.otp.update({ where: { id: record.id }, data: { consumed: true } });
  return true;
}
