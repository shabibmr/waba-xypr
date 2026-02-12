const express = require('express');
const router = express.Router();
const onboardingController = require('../controllers/onboardingController');
const { authenticate, requireRole } = require('../middleware/authenticate');
const validate = require('../middleware/validation');
const schemas = require('../middleware/validation/onboarding.schema');

// All onboarding routes require admin access
router.use(authenticate);
router.use(requireRole(['admin']));

// Get status
router.get('/status', onboardingController.getStatus);

// Submit steps
router.post('/step/1', validate(schemas.step1), (req, res, next) => { req.params.stepNumber = 1; next(); }, onboardingController.submitStep);
router.post('/step/2', validate(schemas.step2), (req, res, next) => { req.params.stepNumber = 2; next(); }, onboardingController.submitStep);
router.post('/step/3', validate(schemas.step3), (req, res, next) => { req.params.stepNumber = 3; next(); }, onboardingController.submitStep);
router.post('/step/4', validate(schemas.step4), (req, res, next) => { req.params.stepNumber = 4; next(); }, onboardingController.submitStep);
router.post('/step/5', validate(schemas.step5), (req, res, next) => { req.params.stepNumber = 5; next(); }, onboardingController.submitStep);

// Complete
router.post('/complete', onboardingController.completeOnboarding);

module.exports = router;
