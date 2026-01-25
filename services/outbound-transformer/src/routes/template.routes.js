const express = require('express');
const { sendTemplate } = require('../controllers/template.controller');

const router = express.Router();

router.post('/send/template', sendTemplate);

module.exports = router;
