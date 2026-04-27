import type { Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '../utils/jwt.js';

export interface AuthedRequest extends Request {
  user?: JwtPayload;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_token' });
  }
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'missing_token' });
  try {
    const user = verifyToken(header.slice(7));
    const admins = (process.env.ADMIN_PHONES ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!admins.includes(user.phone)) return res.status(403).json({ error: 'forbidden' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

export function isAdminPhone(phone: string): boolean {
  const admins = (process.env.ADMIN_PHONES ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return !!phone && admins.includes(phone);
}

export function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = verifyToken(header.slice(7));
    } catch {
      /* ignore */
    }
  }
  next();
}
