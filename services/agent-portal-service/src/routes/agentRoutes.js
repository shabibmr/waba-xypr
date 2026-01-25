const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authenticate');

// Public routes
router.get('/auth/login', authController.initiateLogin);
router.get('/auth/callback', authController.handleCallback);

// Protected routes
router.post('/auth/logout', authenticate, authController.logout);
router.get('/profile', authenticate, authController.getProfile);

module.exports = router;
