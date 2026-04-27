import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { assess } from '../services/scamShield.js';
import { gradeListing } from '../services/listingQuality.js';

export const shieldRouter = Router();

// POST /api/shield/assess  { text }
// Used before sending a chat message to flag scam patterns.
shieldRouter.post('/assess', requireAuth, (req, res, next) => {
  try {
    const { text } = z.object({ text: z.string().min(1).max(4000) }).parse(req.body);
    res.json({ assessment: assess(text) });
  } catch (e) { next(e); }
});

// POST /api/shield/grade-listing — listing coach for sellers
shieldRouter.post('/grade-listing', requireAuth, async (req, res, next) => {
  try {
    const d = z.object({
      title: z.string(),
      description: z.string(),
      category: z.string(),
      priceInPaise: z.number().int().min(0),
      images: z.array(z.string()),
      attributes: z.record(z.string(), z.any()).nullable().optional(),
      lat: z.number(),
      lng: z.number(),
    }).parse(req.body);
    const report = await gradeListing(d);
    res.json({ report });
  } catch (e) { next(e); }
});
