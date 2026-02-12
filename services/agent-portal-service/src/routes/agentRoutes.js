const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authenticate');
const validate = require('../middleware/validation');
const authSchemas = require('../middleware/validation/auth.schema');

// Public routes
router.get('/auth/login', authController.initiateLogin);
router.get('/auth/callback', authController.handleCallback);
router.post('/auth/refresh', validate(authSchemas.refreshToken), authController.refreshToken); // No auth required - uses refresh token
router.post('/auth/demo', validate(authSchemas.demoLogin), authController.demoLogin); // Demo login - bypass OAuth

// Protected routes
router.post('/auth/logout', authenticate, authController.logout);
router.post('/auth/logout-all', authenticate, authController.logoutAll);
router.get('/profile', authenticate, authController.getProfile);

module.exports = router;
