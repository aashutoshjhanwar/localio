import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { storage, makeKey } from '../storage/index.js';

export const uploadRouter = Router();

uploadRouter.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { filename, contentType, base64 } = z.object({
      filename: z.string().min(1).max(200),
      contentType: z.string().regex(/^[\w.+-]+\/[\w.+-]+$/),
      base64: z.string().min(8),
    }).parse(req.body);

    if (!/^image\/(jpeg|png|webp|gif)$/.test(contentType)) {
      return res.status(400).json({ error: 'unsupported_type' });
    }

    const buf = Buffer.from(base64, 'base64');
    if (buf.length > 5 * 1024 * 1024) return res.status(413).json({ error: 'too_large' });

    const key = makeKey(filename);
    const rel = await storage.put(key, buf, contentType);

    // If local driver, we get a relative path; expand to absolute for clients.
    const url = rel.startsWith('http')
      ? rel
      : `${req.protocol}://${req.get('host')}${rel}`;

    res.json({ url });
  } catch (e) { next(e); }
});
