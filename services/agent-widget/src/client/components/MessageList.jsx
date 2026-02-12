import React, { useEffect, useRef } from 'react';
import StatusIcons from './StatusIcons';

export default function MessageList({ messages }) {
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    if (!messages.length) {
        return <div className="empty-state">No messages yet</div>;
    }

    return (
        <div
            className="message-list"
            role="log"
            aria-live="polite"
            aria-label="Conversation messages"
        >
            {messages.map(msg => (
                <div
                    key={msg.id}
                    className={`message message--${msg.direction}`}
                    role="article"
                >
                    {msg.mediaUrl && (
                        <div className="message__media">
                            {msg.mediaType?.startsWith('image') ? (
                                <img src={msg.mediaUrl} alt="Media" className="message__image" />
                            ) : msg.mediaType?.startsWith('video') ? (
                                <video src={msg.mediaUrl} controls className="message__video" />
                            ) : (
                                <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="message__file">
                                    Download file
                                </a>
                            )}
                        </div>
                    )}
                    {msg.text && <p className="message__text">{msg.text}</p>}
                    <div className="message__meta">
                        <span className="message__time">{formatTime(msg.timestamp)}</span>
                        {msg.direction === 'outbound' && <StatusIcons status={msg.status} />}
                    </div>
                </div>
            ))}
            <div ref={bottomRef} />
        </div>
    );
}

function formatTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
