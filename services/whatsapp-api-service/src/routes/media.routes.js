const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/media.controller');

router.get('/media/:mediaId', (req, res, next) => mediaController.getMediaUrl(req, res, next));
router.get('/media/:mediaId/download', (req, res, next) => mediaController.downloadMedia(req, res, next));

module.exports = router;
