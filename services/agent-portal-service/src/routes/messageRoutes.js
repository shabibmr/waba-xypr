const express = require('express');
const router = express.Router();
const multer = require('multer');
const messageController = require('../controllers/messageController');
const { authenticate } = require('../middleware/authenticate');
const validate = require('../middleware/validation');
const messageSchemas = require('../middleware/validation/message.schema');

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 16 * 1024 * 1024 } // 16MB limit
});

// All message routes require authentication
router.post('/send', authenticate, validate(messageSchemas.sendMessage), messageController.sendMessage);
router.post('/send/template', authenticate, validate(messageSchemas.sendTemplate), messageController.sendTemplate);
router.post('/upload', authenticate, upload.single('file'), messageController.uploadMedia);

module.exports = router;
