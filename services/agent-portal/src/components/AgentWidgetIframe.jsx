import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

/**
 * AgentWidgetIframe - Embeds the agent-widget in an iframe overlay
 * For demo environment only - uses simple token passing
 */
function AgentWidgetIframe({ conversationId, onClose }) {
    const [widgetUrl, setWidgetUrl] = useState('');

    useEffect(() => {
        const baseUrl = import.meta.env.VITE_AGENT_WIDGET_URL || 'http://localhost:3012';

        // Ensure we use http:// not ws://
        const httpBaseUrl = baseUrl.replace('ws://', 'http://').replace('wss://', 'https://');

        // Construct widget URL with conversationId
        const url = `${httpBaseUrl}/widget?conversationId=${conversationId}`;
        setWidgetUrl(url);
    }, [conversationId]);

    return (
        <>
            {/* Backdrop overlay */}
            <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={onClose}
            />

            {/* Modal container */}
            <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-4xl">
                <div className="bg-gray-800 rounded-lg shadow-2xl overflow-hidden border border-gray-700">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700">
                        <h3 className="font-semibold text-white">WhatsApp Conversation</h3>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-gray-700 rounded transition text-gray-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Iframe */}
                    {widgetUrl && (
                        <iframe
                            src={widgetUrl}
                            className="w-full h-[600px] bg-white"
                            frameBorder="0"
                            title="Agent Widget"
                            sandbox="allow-scripts allow-same-origin allow-forms"
                        />
                    )}
                </div>
            </div>
        </>
    );
}

export default AgentWidgetIframe;
