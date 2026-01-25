const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('./config');
const errorHandler = require('./middleware/errorHandler');
const Agent = require('./models/Agent');

// Import routes
const agentRoutes = require('./routes/agentRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const organizationRoutes = require('./routes/organizationRoutes'); // Import organization routes

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = socketIo(server, {
    cors: {
        origin: config.frontend.url,
        methods: ['GET', 'POST']
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'agent-portal-service' });
});

// API Routes
app.use('/api/agents', agentRoutes);
app.use('/api/agents', whatsappRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/organization', organizationRoutes); // Mount organization routes

// Error handler (must be last)
app.use(errorHandler);

// Socket.io authentication middleware
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;

        if (!token) {
            return next(new Error('Authentication error: No token provided'));
        }

        const decoded = jwt.verify(token, config.jwt.secret);
        const agent = await Agent.findById(decoded.agentId);

        if (!agent || !agent.is_active) {
            return next(new Error('Authentication error: Invalid agent'));
        }

        socket.agentId = agent.agent_id;
        socket.agent = agent;
        next();
    } catch (error) {
        next(new Error('Authentication error'));
    }
});

// Socket.io connection handler
io.on('connection', (socket) => {
    console.log(`Agent connected via socket: ${socket.agentId}`);

    // Join agent-specific room
    socket.join(`agent:${socket.agentId}`);

    socket.on('disconnect', () => {
        console.log(`Agent disconnected: ${socket.agentId}`);
    });
});

// Export io for use in other modules
app.set('socketio', io);

// Start server
const PORT = config.port;
server.listen(PORT, () => {
    console.log(`Agent Portal Service running on port ${PORT}`);
    console.log(`Socket.io server ready for agent connections`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

module.exports = { app, server, io };
