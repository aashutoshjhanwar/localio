import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: 'validation_error', issues: err.issues });
  }
  // eslint-disable-next-line no-console
  console.error(err);
  const message = err instanceof Error ? err.message : 'internal_error';
  res.status(500).json({ error: 'internal_error', message });
}
