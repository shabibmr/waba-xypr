const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authenticate');

// Public routes
router.get('/auth/login', authController.initiateLogin);
router.get('/auth/callback', authController.handleCallback);
router.post('/auth/refresh', authController.refreshToken); // No auth required - uses refresh token

// Protected routes
router.post('/auth/logout', authenticate, authController.logout);
router.post('/auth/logout-all', authenticate, authController.logoutAll);
router.get('/profile', authenticate, authController.getProfile);

module.exports = router;
