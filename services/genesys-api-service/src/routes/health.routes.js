/**
 * Health check routes
 * Service health monitoring endpoints
 */

const express = require('express');
const router = express.Router();

// Health check endpoint
router.get('/', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'genesys-api'
    });
});

module.exports = router;
