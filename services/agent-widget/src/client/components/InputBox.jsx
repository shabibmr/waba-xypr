import React, { useState, useRef } from 'react';
import { sendMessage } from '../services/widgetApi';
import { generateMessageId } from '../utils/generateId';

export default function InputBox({ conversationId, tenantId, waId, onMessageSent, onMessageFailed }) {
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const inputRef = useRef(null);

    const handleSend = async () => {
        if (!text.trim() || sending) return;

        const messageId = generateMessageId();
        const optimistic = {
            id: messageId,
            direction: 'outbound',
            text: text.trim(),
            status: 'pending',
            timestamp: new Date().toISOString(),
        };

        onMessageSent(optimistic);
        setText('');
        setSending(true);

        try {
            await sendMessage({ conversationId, tenantId, waId, text: optimistic.text, messageId });
        } catch {
            onMessageFailed(messageId);
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="input-box" role="form" aria-label="Send a message">
            <textarea
                ref={inputRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message…"
                aria-label="Message text"
                rows={2}
                disabled={sending}
            />
            <button
                onClick={handleSend}
                disabled={!text.trim() || sending}
                aria-label="Send message"
                className="send-btn"
            >
                {sending ? '…' : 'Send'}
            </button>
        </div>
    );
}
