import { useState, useEffect, useCallback } from 'react';
import { fetchHistory } from '../services/widgetApi';
import { useSocket } from './useSocket';

export function useMessages(conversationId, tenantId) {
    const [messages, setMessages] = useState([]);
    const { socket } = useSocket(tenantId, conversationId);

    // Load message history on mount
    useEffect(() => {
        if (!conversationId || !tenantId) return;
        fetchHistory(conversationId, tenantId).then(data => {
            setMessages(data.messages || []);
        }).catch(() => {
            // History load failure is non-fatal — widget still works
        });
    }, [conversationId, tenantId]);

    // Real-time inbound messages via socket
    useEffect(() => {
        if (!socket) return;
        const onInbound = (data) => {
            setMessages(prev => {
                if (prev.some(m => m.id === (data.messageId || data.id))) return prev;
                return [...prev, {
                    id: data.messageId || data.id || String(Date.now()),
                    direction: 'inbound',
                    text: data.text,
                    mediaUrl: data.mediaUrl,
                    mediaType: data.mediaType,
                    timestamp: data.timestamp || new Date().toISOString(),
                    status: null,
                }];
            });
        };
        socket.on('new_message', onInbound);
        return () => socket.off('new_message', onInbound);
    }, [socket]);

    // Status updates (sent/delivered/read ticks) via socket
    useEffect(() => {
        if (!socket) return;
        const onStatus = ({ messageId, status }) => {
            setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status } : m));
        };
        socket.on('status_update', onStatus);
        return () => socket.off('status_update', onStatus);
    }, [socket]);

    // Add message (optimistic or real)
    const addMessage = useCallback((msg) => {
        setMessages(prev => {
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
        });
    }, []);

    // Update status of a message by ID
    const updateStatus = useCallback((messageId, status) => {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status } : m));
    }, []);

    // Mark a message as failed
    const markFailed = useCallback((messageId) => {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, status: 'failed' } : m));
    }, []);

    return { messages, addMessage, updateStatus, markFailed };
}
