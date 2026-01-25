import { io } from 'socket.io-client';
import authService from './authService';

class SocketService {
    constructor() {
        this.socket = null;
        this.listeners = {};
    }

    /**
     * Connect to Socket.io server
     */
    connect() {
        const SOCKET_URL = import.meta.env.VITE_AGENT_WIDGET_URL || 'ws://localhost:3012';
        const token = authService.getToken();

        if (!token) {
            console.error('Cannot connect to socket: No auth token');
            return;
        }

        this.socket = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket']
        });

        this.socket.on('connect', () => {
            console.log('Socket connected:', this.socket.id);
        });

        this.socket.on('disconnect', () => {
            console.log('Socket disconnected');
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
        });

        return this.socket;
    }

    /**
     * Disconnect from Socket.io server
     */
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    /**
     * Listen for inbound messages
     */
    onInboundMessage(callback) {
        if (!this.socket) return;
        this.socket.on('inbound-message', callback);
    }

    /**
     * Remove inbound message listener
     */
    offInboundMessage(callback) {
        if (!this.socket) return;
        this.socket.off('inbound-message', callback);
    }

    /**
     * Emit an event
     */
    emit(event, data) {
        if (!this.socket) return;
        this.socket.emit(event, data);
    }

    /**
     * Get connection status
     */
    isConnected() {
        return this.socket?.connected || false;
    }
}

export default new SocketService();
