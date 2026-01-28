import express from 'express';
// @ts-ignore
import { transformOutbound } from '../controllers/transform.controller';

const router = express.Router();

router.post('/transform/outbound', transformOutbound);

export default router;
