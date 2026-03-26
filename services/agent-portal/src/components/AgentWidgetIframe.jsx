import React, { useEffect, useState, useRef } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

/**
 * AgentWidgetIframe - Embeds the agent-widget in an iframe overlay
 * Passes portal authentication to widget via postMessage
 */
function AgentWidgetIframe({ conversationId, onClose }) {
    const [widgetUrl, setWidgetUrl] = useState('');
    const iframeRef = useRef(null);
    const { token, user } = useAuth();

    useEffect(() => {
        const baseUrl = import.meta.env.VITE_AGENT_WIDGET_URL || 'http://localhost:3012';

        // Ensure we use http:// not ws://
        const httpBaseUrl = baseUrl.replace('ws://', 'http://').replace('wss://', 'https://');

        // Get integrationId from user's organization
        const integrationId = user?.organization?.integration_id;

        // Construct widget URL with conversationId, portal mode flag, and integrationId
        let url = `${httpBaseUrl}/widget?conversationId=${conversationId}&mode=portal&embedded=true`;

        // Add integrationId if available
        if (integrationId) {
            url += `&integrationId=${integrationId}`;
        }

        setWidgetUrl(url);
    }, [conversationId, user]);

    // Send auth token to widget iframe when it loads
    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe || !token) return;

        const handleLoad = () => {
            // Send auth token to widget via postMessage
            iframe.contentWindow?.postMessage({
                type: 'PORTAL_AUTH',
                token: token
            }, '*'); // In production, specify exact origin

            console.log('[AgentWidgetIframe] Sent auth token to widget');
        };

        iframe.addEventListener('load', handleLoad);
        return () => iframe.removeEventListener('load', handleLoad);
    }, [token]);

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
                            ref={iframeRef}
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
