const express = require('express');
const router = express.Router();
const messageController = require('../controllers/message.controller');

router.post('/send/text', (req, res, next) => messageController.sendText(req, res, next));
router.post('/send/template', (req, res, next) => messageController.sendTemplate(req, res, next));
router.post('/send/image', (req, res, next) => messageController.sendImage(req, res, next));
router.post('/send/document', (req, res, next) => messageController.sendDocument(req, res, next));
router.post('/send/location', (req, res, next) => messageController.sendLocation(req, res, next));
router.post('/send/buttons', (req, res, next) => messageController.sendButtons(req, res, next));
router.post('/mark-read', (req, res, next) => messageController.markAsRead(req, res, next));

module.exports = router;
