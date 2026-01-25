const express = require('express');
const router = express.Router();
const multer = require('multer');
const messageController = require('../controllers/messageController');
const { authenticate } = require('../middleware/authenticate');

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 16 * 1024 * 1024 } // 16MB limit
});

// All message routes require authentication
router.post('/send', authenticate, messageController.sendMessage);
router.post('/send/template', authenticate, messageController.sendTemplate);
router.post('/upload', authenticate, upload.single('file'), messageController.uploadMedia);

module.exports = router;
