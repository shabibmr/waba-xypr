import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const SocketContext = createContext(null);

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within SocketProvider');
    }
    return context;
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [reconnectAttempts, setReconnectAttempts] = useState(0);
    const queryClient = useQueryClient();
    const { user, token } = useAuth();
    const { showToast } = useToast();
    const reconnectTimeoutRef = useRef(null);
    const maxReconnectAttempts = 5;

    const SOCKET_URL = import.meta.env.VITE_AGENT_PORTAL_SERVICE_URL || 'ws://localhost:3015';

    // Handle socket events and invalidate React Query cache
    const setupEventListeners = useCallback((socketInstance) => {
        // Connection events
        socketInstance.on('connect', () => {
            console.log('[SocketContext] Connected:', socketInstance.id);
            setIsConnected(true);
            setReconnectAttempts(0);
        });

        socketInstance.on('disconnect', (reason) => {
            console.log('[SocketContext] Disconnected:', reason);
            setIsConnected(false);
        });

        socketInstance.on('connect_error', (error) => {
            console.error('[SocketContext] Connection error:', error.message);
            setIsConnected(false);
        });

        // Business events - invalidate React Query cache
        socketInstance.on('new_message', (data) => {
            console.log('[SocketContext] New message:', data);
            queryClient.invalidateQueries(['conversations']);
            queryClient.invalidateQueries(['conversation-messages', data.conversationId]);
            queryClient.invalidateQueries(['dashboard-metrics']);
        });

        socketInstance.on('conversation_update', (data) => {
            console.log('[SocketContext] Conversation update:', data);
            queryClient.invalidateQueries(['conversations']);
            queryClient.invalidateQueries(['conversation-messages', data.id || data.conversationId]);
        });

        socketInstance.on('status_update', (data) => {
            console.log('[SocketContext] Status update:', data);
            queryClient.invalidateQueries(['conversation-messages', data.conversationId]);
            queryClient.invalidateQueries(['conversations']);
        });

        socketInstance.on('metrics_update', (data) => {
            console.log('[SocketContext] Metrics update:', data);
            queryClient.invalidateQueries(['dashboard-metrics']);
        });
    }, [queryClient]);

    // Connect to socket
    const connect = useCallback(() => {
        if (!token || !user) {
            console.log('[SocketContext] No token or user, skipping connection');
            return;
        }

        if (socket?.connected) {
            console.log('[SocketContext] Already connected');
            return;
        }

        console.log('[SocketContext] Connecting to', SOCKET_URL);

        const socketInstance = io(SOCKET_URL, {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: maxReconnectAttempts,
        });

        setupEventListeners(socketInstance);
        setSocket(socketInstance);
    }, [token, user, socket, SOCKET_URL, setupEventListeners]);

    // Disconnect from socket
    const disconnect = useCallback(() => {
        if (socket) {
            console.log('[SocketContext] Disconnecting');
            socket.disconnect();
            setSocket(null);
            setIsConnected(false);
        }
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
    }, [socket]);

    // Reconnect with exponential backoff
    const handleReconnect = useCallback(() => {
        if (reconnectAttempts >= maxReconnectAttempts) {
            showToast?.({
                type: 'warning',
                message: 'Real-time updates unavailable. Please refresh the page.',
                duration: 5000,
            });
            return;
        }

        const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        console.log(`[SocketContext] Reconnecting in ${backoffDelay}ms (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);

        reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            disconnect();
            connect();
        }, backoffDelay);
    }, [reconnectAttempts, connect, disconnect, showToast]);

    // Connect on mount or when token changes
    useEffect(() => {
        if (token && user) {
            connect();
        } else {
            disconnect();
        }

        return () => {
            disconnect();
        };
    }, [token, user]); // Only reconnect when token or user changes

    // Handle token refresh
    useEffect(() => {
        const handleTokenRefresh = () => {
            console.log('[SocketContext] Token refreshed, reconnecting socket');
            disconnect();
            setTimeout(() => connect(), 500);
        };

        window.addEventListener('tokenRefreshed', handleTokenRefresh);
        return () => {
            window.removeEventListener('tokenRefreshed', handleTokenRefresh);
        };
    }, [connect, disconnect]);

    const value = {
        socket,
        isConnected,
        connect,
        disconnect,
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};
