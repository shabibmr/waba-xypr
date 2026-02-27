const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');

class SocketService {
    constructor() {
        this.io = null;
        this.pubClient = null;
        this.subClient = null;
    }

    async init(server) {
        // Init Redis Adapter
        this.pubClient = createClient({
            url: config.redis.url,
            socket: {
                connectTimeout: 5000,
                reconnectStrategy: (retries) => Math.min(retries * 500, 5000)
            }
        });
        this.subClient = this.pubClient.duplicate();

        await Promise.all([
            this.pubClient.connect(),
            this.subClient.connect()
        ]);

        this.io = socketIo(server, {
            cors: {
                origin: (origin, cb) => {
                    if (!origin) return cb(null, true);
                    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
                    const isNgrok = origin.match(/^https:\/\/[a-zA-Z0-9-]+\.ngrok(-free)?\.(app|dev|io)$/);
                    if (allowed.includes(origin) || /mypurecloud\.com$/.test(origin) || isNgrok) {
                        return cb(null, true);
                    }
                    // Keep it permissive for widget embedding
                    logger.warn(`[Socket CORS] Unlisted origin: ${origin}, allowing anyway for dev`);
                    cb(null, true);
                },
                credentials: true,
                methods: ['GET', 'POST'],
            },
            adapter: createAdapter(this.pubClient, this.subClient)
        });

        // Auth Middleware
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.query.token;
                if (!token) {
                    return next(new Error('Authentication error: No token provided'));
                }

                // Verify Token
                const decoded = jwt.verify(token, config.jwt.secret);
                socket.user = decoded;

                const tenantId = decoded.tenant_id || decoded.tenantId;
                const userId = decoded.user_id || decoded.userId;

                if (!tenantId) {
                    return next(new Error('Authentication error: Token lacks tenantId'));
                }

                // Join Tenant Room
                const tenantRoom = `tenant:${tenantId}`;
                socket.join(tenantRoom);

                // Join User Room (for direct notifications)
                if (userId) {
                    const userRoom = `user:${userId}`;
                    socket.join(userRoom);
                }

                logger.debug(`[SocketService] Auth successful - ID: ${socket.id}, Tenant: ${tenantId}, User: ${userId}`);
                next();
            } catch (err) {
                logger.error('Socket auth failed', { error: err.message });
                next(new Error('Authentication error: Invalid token'));
            }
        });

        this.io.on('connection', (socket) => {
            logger.info(`[SocketService] New socket connection established: ${socket.id}`);

            socket.on('disconnect', (reason) => {
                logger.info(`[SocketService] Socket disconnected: ${socket.id} - Reason: ${reason}`);
            });

            // Handle client events if any
        });

        logger.info('Socket.io initialized with Redis adapter');
    }

    /**
     * Emit event to specific tenant
     * @param {string} tenantId 
     * @param {string} event 
     * @param {object} data 
     */
    toTenant(tenantId, event, data) {
        if (!this.io) {
            logger.warn('Socket.io not initialized');
            return;
        }
        logger.info(`[SocketService] Emitting event '${event}' to tenant room 'tenant:${tenantId}'`, {
            event,
            tenantId,
            dataPreview: JSON.stringify(data).substring(0, 200)
        });
        this.io.to(`tenant:${tenantId}`).emit(event, data);
    }

    /**
     * Emit event to specific user
     * @param {string} userId 
     * @param {string} event 
     * @param {object} data 
     */
    toUser(userId, event, data) {
        if (!this.io) {
            logger.warn('Socket.io not initialized');
            return;
        }
        this.io.to(`user:${userId}`).emit(event, data);
    }
}

module.exports = new SocketService();
