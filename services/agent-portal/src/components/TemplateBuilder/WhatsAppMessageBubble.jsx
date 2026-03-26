import React from 'react';
import { Check, CheckCheck } from 'lucide-react';

/**
 * WhatsApp Message Bubble Component
 * Renders message bubble with tail, content, timestamp, and read receipts
 */
function WhatsAppMessageBubble({
  children,
  sent = true,
  timestamp = null,
  status = 'read' // 'sent', 'delivered', 'read'
}) {
  const time = timestamp || new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return (
    <div className={`wa-message-container ${sent ? 'sent' : 'received'}`}>
      <div className={`wa-message-bubble ${sent ? 'sent' : 'received'}`}>
        {/* Message Content */}
        <div className="wa-bubble-content">
          {children}
        </div>

        {/* Timestamp and Read Receipts */}
        <div className="wa-message-meta">
          <span className="wa-timestamp">{time}</span>
          {sent && (
            <span className={`wa-read-receipt ${status}`}>
              {status === 'sent' ? (
                <Check className="w-4 h-4" strokeWidth={2.5} />
              ) : (
                <CheckCheck className="w-4 h-4" strokeWidth={2.5} />
              )}
            </span>
          )}
        </div>

        {/* Message Tail */}
        <div className={`wa-bubble-tail ${sent ? 'sent' : 'received'}`}></div>
      </div>
    </div>
  );
}

export default WhatsAppMessageBubble;
