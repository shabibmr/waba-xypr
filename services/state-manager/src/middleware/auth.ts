import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export function verifyApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'];
  const expectedKey = process.env.STATE_MANAGER_API_KEY;

  if (!expectedKey) {
    logger.warn('API_KEY not configured, skipping auth');
    return next();
  }

  if (apiKey !== expectedKey) {
    logger.warn('Invalid API key', { ip: req.ip });
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
}
