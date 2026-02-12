const express = require('express');
const cors = require('cors');
const http = require('http');
const config = require('./config');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const socketService = require('./services/socketService');
const eventListener = require('./services/eventListener');

const agentRoutes = require('./routes/agentRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const organizationRoutes = require('./routes/organizationRoutes');
const onboardingRoutes = require('./routes/onboardingRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
const server = http.createServer(app);

// ── Middleware ────────────────────────────────────────────
app.use(cors({
    origin: (origin, cb) => {
        const allowed = (process.env.ALLOWED_ORIGINS || '')
            .split(',').map(o => o.trim()).filter(Boolean);
        if (!origin || allowed.includes(origin) || /mypurecloud\.com$/.test(origin)) {
            return cb(null, true);
        }
        cb(new Error('CORS not allowed'), false);
    },
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Routes ────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'agent-portal-service' }));

app.use('/api/agents', agentRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ── Error Handler (must be last) ─────────────────────────
app.use(errorHandler);

// ── Socket.IO + Event Listener ────────────────────────────
socketService.init(server).then(() => {
    eventListener.start().catch(err =>
        logger.error('Failed to start Event Listener', err)
    );
}).catch(err => {
    logger.error('Failed to init socket service', err);
});

// ── Start ─────────────────────────────────────────────────
const PORT = config.port;
server.listen(PORT, () => {
    logger.info('Agent Portal Service started', {
        port: PORT,
        nodeEnv: process.env.NODE_ENV,
    });
});

process.on('SIGTERM', () => {
    logger.info('SIGTERM received: closing server');
    server.close(() => process.exit(0));
});

module.exports = { app, server };
