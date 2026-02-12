import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export function useSocket(tenantId, conversationId) {
    const [connected, setConnected] = useState(false);
    const socketRef = useRef(null);

    useEffect(() => {
        if (!tenantId || !conversationId) return;

        const socketUrl = window.__WIDGET_CONFIG__?.socketUrl || window.location.origin;
        const token = window.__WIDGET_TOKEN__ || new URLSearchParams(window.location.search).get('token') || '';

        const socket = io(socketUrl, {
            auth: { token },
            query: { tenantId, conversationId },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: Infinity,
        });

        socket.on('connect', () => setConnected(true));
        socket.on('disconnect', () => setConnected(false));

        socketRef.current = socket;

        return () => {
            socket.disconnect();
            socketRef.current = null;
            setConnected(false);
        };
    }, [tenantId, conversationId]);

    return { socket: socketRef.current, connected };
}
