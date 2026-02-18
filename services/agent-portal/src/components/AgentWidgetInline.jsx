import React, { useEffect, useState } from 'react';

/**
 * AgentWidgetInline - Embeds the agent-widget inline (not as a modal)
 * For use in the main Workspace chat area
 */
function AgentWidgetInline({ conversationId }) {
    const [widgetUrl, setWidgetUrl] = useState('');

    useEffect(() => {
        if (!conversationId) {
            setWidgetUrl('');
            return;
        }

        const baseUrl = import.meta.env.VITE_AGENT_WIDGET_URL || 'http://localhost:3012';

        // Ensure we use http:// not ws://
        const httpBaseUrl = baseUrl.replace('ws://', 'http://').replace('wss://', 'https://');

        // Construct widget URL with conversationId
        const url = `${httpBaseUrl}/widget?conversationId=${conversationId}`;
        setWidgetUrl(url);
    }, [conversationId]);

    if (!conversationId) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-400 bg-gray-900">
                <p>Select a conversation to start messaging</p>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-white">
            {widgetUrl && (
                <iframe
                    src={widgetUrl}
                    className="w-full h-full border-0"
                    title="Agent Widget"
                    sandbox="allow-scripts allow-same-origin allow-forms"
                />
            )}
        </div>
    );
}

export default AgentWidgetInline;
