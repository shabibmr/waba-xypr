const express = require('express');
const { transformOutbound } = require('../controllers/transform.controller');

const router = express.Router();

router.post('/transform/outbound', transformOutbound);

module.exports = router;
