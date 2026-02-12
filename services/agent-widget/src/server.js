const express = require('express');
const path = require('path');
const cors = require('cors');
const config = require('./config');

const app = express();

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    credentials: true,
}));
app.use(express.json());

// ── Health check ──────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'agent-widget' }));

// ── Widget config — tells the React app where agent-portal-service lives ──
app.get('/api/v1/widget/config', (req, res) => {
    res.json({
        apiUrl: config.portalServiceUrl,
        socketUrl: config.portalServiceUrl,
        features: {
            messageHistory: true,
            templates: true,
            mediaUpload: true,
        },
    });
});

// ── Serve React build (must come after API routes) ────────
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback — serve index.html for all unmatched routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Error handler ─────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(config.port, () => {
    console.log(`Agent Widget running on port ${config.port}`);
    console.log(`Portal service: ${config.portalServiceUrl}`);
});
