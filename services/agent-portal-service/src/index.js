const express = require('express');
const cors = require('cors');
const http = require('http');
const config = require('./config');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');
const { authenticate } = require('./middleware/authenticate');
const { correlationId } = require('../../../shared/middleware/correlationId');
const socketService = require('./services/socketService');
const eventListener = require('./services/eventListener');

const agentRoutes = require('./routes/agentRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const organizationRoutes = require('./routes/organizationRoutes');
const onboardingRoutes = require('./routes/onboardingRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const widgetRoutes = require('./routes/widgetRoutes');
const genesysPlatformRoutes = require('./routes/genesysPlatformRoutes');

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
app.use(correlationId()); // Add correlation ID to all requests

// ── Routes ────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'agent-portal-service' }));

// Mount routes
app.use('/api/agents', agentRoutes);
app.use('/api/onboarding', authenticate, onboardingRoutes);
app.use('/api/whatsapp', authenticate, whatsappRoutes);
app.use('/api/conversations', authenticate, conversationRoutes);
app.use('/api/messages', authenticate, messageRoutes);
app.use('/api/dashboard', authenticate, dashboardRoutes);
app.use('/api/organization', authenticate, organizationRoutes);
app.use('/api/widget', widgetRoutes); // Internal service-to-service calls, no user JWT required
app.use('/api/genesys-platform', authenticate, genesysPlatformRoutes); // New route mounted

// ── Error Handler (must be last) ─────────────────────────
app.use(errorHandler);

// ── Socket.IO + Event Listener ────────────────────────────
Promise.allSettled([
    socketService.init(server),
    eventListener.start()
]).then(results => {
    results.forEach((r, i) => {
        if (r.status === 'rejected') {
            const names = ['Socket.IO', 'Event Listener'];
            logger.error(`Failed to init ${names[i]}`, r.reason);
        }
    });
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
