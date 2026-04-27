import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { storage, makeKey } from '../storage/index.js';

export const uploadRouter = Router();

const ALLOWED_IMAGE = /^image\/(jpeg|png|webp|gif|heic)$/;
const ALLOWED_VIDEO = /^video\/(mp4|quicktime)$/;
const ALLOWED_DOC = /^application\/pdf$/;

function isAllowed(ct: string): boolean {
  return ALLOWED_IMAGE.test(ct) || ALLOWED_VIDEO.test(ct) || ALLOWED_DOC.test(ct);
}

// Legacy base64 upload — small images (<5 MB). Keep for dev + fallback on mobile.
uploadRouter.post('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { filename, contentType, base64 } = z.object({
      filename: z.string().min(1).max(200),
      contentType: z.string().regex(/^[\w.+-]+\/[\w.+-]+$/),
      base64: z.string().min(8),
    }).parse(req.body);

    if (!ALLOWED_IMAGE.test(contentType)) {
      return res.status(400).json({ error: 'unsupported_type' });
    }

    const buf = Buffer.from(base64, 'base64');
    if (buf.length > 5 * 1024 * 1024) return res.status(413).json({ error: 'too_large' });

    const key = makeKey(filename, `user/${req.user!.userId}`);
    const rel = await storage.put(key, buf, contentType);

    const url = rel.startsWith('http')
      ? rel
      : `${req.protocol}://${req.get('host')}${rel}`;

    res.json({ url, key });
  } catch (e) { next(e); }
});

// Presigned direct-upload URL. Mobile uploads the file straight to S3 (no API round-trip).
// Required in prod: 25 MB JSON body limit on the API would otherwise cap uploads.
uploadRouter.post('/presign', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { filename, contentType, size } = z.object({
      filename: z.string().min(1).max(200),
      contentType: z.string().regex(/^[\w.+-]+\/[\w.+-]+$/),
      size: z.number().int().min(1).max(50 * 1024 * 1024).optional(),
    }).parse(req.body);

    if (!isAllowed(contentType)) return res.status(400).json({ error: 'unsupported_type' });

    const key = makeKey(filename, `user/${req.user!.userId}`);

    if (storage.kind === 'local' || !storage.presignPut) {
      // Local driver has no presign — tell the client to fall back to base64 POST.
      return res.json({
        driver: 'local',
        uploadUrl: null,
        publicUrl: null,
        fallback: '/api/uploads',
        key,
      });
    }

    const signed = await storage.presignPut(key, { contentType, maxBytes: size });
    res.json({ driver: 's3', ...signed });
  } catch (e) { next(e); }
});

// Delete a previously-uploaded file. Caller must own the key prefix (user/<id>/...).
uploadRouter.delete('/', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const { key } = z.object({ key: z.string().min(3).max(300) }).parse(req.body);
    const ownerPrefix = `user/${req.user!.userId}/`;
    if (!key.startsWith(ownerPrefix)) return res.status(403).json({ error: 'not_owner' });
    await storage.delete(key);
    res.json({ ok: true });
  } catch (e) { next(e); }
});
