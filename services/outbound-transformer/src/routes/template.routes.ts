import express from 'express';
// @ts-ignore
import { sendTemplate } from '../controllers/template.controller';

const router = express.Router();

router.post('/send/template', sendTemplate);

export default router;
