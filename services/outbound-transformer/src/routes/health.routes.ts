import express from 'express';
// @ts-ignore
import { healthCheck } from '../controllers/health.controller';

const router = express.Router();

router.get('/health', healthCheck);

export default router;
