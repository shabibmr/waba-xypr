import express from 'express';
import healthRoutes from './health.routes';
import transformRoutes from './transform.routes';
import templateRoutes from './template.routes';

const router = express.Router();

router.use(healthRoutes);
router.use(transformRoutes);
router.use(templateRoutes);

export default router;
