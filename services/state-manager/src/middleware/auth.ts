import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export function verifyApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.STATE_MANAGER_API_KEY;

  // Skip authentication if API key not configured (for internal service-to-service calls)
  if (!expectedKey) {
    logger.warn('API_KEY not configured, skipping auth');
    return next();
  }

  // If API key is configured, validate it
  if (apiKey !== expectedKey) {
    logger.warn('Invalid or missing API key', { ip: req.ip, hasKey: !!apiKey });
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
}
