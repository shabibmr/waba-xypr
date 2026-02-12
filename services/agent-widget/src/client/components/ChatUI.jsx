import React from 'react';
import MessageList from './MessageList';
import InputBox from './InputBox';
import CustomerInfo from './CustomerInfo';
import OfflineBanner from './OfflineBanner';
import { useSocket } from '../hooks/useSocket';
import { useMessages } from '../hooks/useMessages';

export default function ChatUI({ conversationId, tenantId, waId, mode, pciMode }) {
    const { connected } = useSocket(tenantId, conversationId);
    const { messages, addMessage, markFailed } = useMessages(conversationId, tenantId);

    return (
        <div className="chat-container">
            <OfflineBanner visible={!connected} />
            <CustomerInfo waId={waId} tenantId={tenantId} />
            <MessageList messages={messages} />
            {!pciMode ? (
                <InputBox
                    conversationId={conversationId}
                    tenantId={tenantId}
                    waId={waId}
                    onMessageSent={addMessage}
                    onMessageFailed={markFailed}
                />
            ) : (
                <div className="pci-notice" role="status">
                    Input disabled — PCI compliance mode
                </div>
            )}
        </div>
    );
}
