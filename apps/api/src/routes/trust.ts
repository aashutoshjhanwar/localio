import { Router } from 'express';
import { requireAuth, type AuthedRequest } from '../middleware/auth.js';
import { computeTrust, refreshTrust } from '../services/trust.js';

export const trustRouter = Router();

// Get my full breakdown (with suggestions).
trustRouter.get('/me', requireAuth, async (req: AuthedRequest, res, next) => {
  try {
    const breakdown = await refreshTrust(req.user!.userId);
    res.json({ trust: breakdown });
  } catch (e) { next(e); }
});

// Public: anyone can see any user's score + tier (but not personal suggestions).
trustRouter.get('/:userId', async (req, res, next) => {
  try {
    const breakdown = await computeTrust(req.params.userId);
    const { suggestions, ...rest } = breakdown;
    res.json({ trust: rest });
  } catch (e) { next(e); }
});
