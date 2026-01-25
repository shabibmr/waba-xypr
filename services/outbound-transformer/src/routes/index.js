const express = require('express');
const healthRoutes = require('./health.routes');
const transformRoutes = require('./transform.routes');
const templateRoutes = require('./template.routes');

const router = express.Router();

router.use(healthRoutes);
router.use(transformRoutes);
router.use(templateRoutes);

module.exports = router;
