import 'dotenv/config';

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing env var: ${name}`);
  return v;
}

export const env = {
  NODE_ENV: req('NODE_ENV', 'development'),
  PORT: parseInt(req('PORT', '4000'), 10),
  DATABASE_URL: req('DATABASE_URL'),
  JWT_SECRET: req('JWT_SECRET'),
  JWT_EXPIRES_IN: req('JWT_EXPIRES_IN', '30d'),
  OTP_DEV_BYPASS: process.env.OTP_DEV_BYPASS || '',
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_FROM: process.env.TWILIO_FROM || '',
  S3_BUCKET: process.env.S3_BUCKET || '',
  S3_REGION: process.env.S3_REGION || '',
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY || '',
  S3_SECRET_KEY: process.env.S3_SECRET_KEY || '',
  S3_PUBLIC_BASE: process.env.S3_PUBLIC_BASE || '',
  isDev: (process.env.NODE_ENV ?? 'development') === 'development',
};
