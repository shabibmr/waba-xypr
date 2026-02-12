const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/authenticate');
const validate = require('../middleware/validation');
const schemas = require('../middleware/validation/dashboard.schema');

router.use(authenticate);

router.get('/stats', dashboardController.getStats);
router.get('/metrics', validate(schemas.getMetrics, 'query'), dashboardController.getMetrics);
router.post('/refresh', dashboardController.refreshStats);

module.exports = router;
