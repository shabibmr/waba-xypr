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
                className="fixed inset-0 bg-surface-900/40 backdrop-blur-sm z-40 animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal container */}
            <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-[95%] max-w-5xl h-[85vh] md:h-[800px] animate-in zoom-in-95 duration-200">
                <div className="bg-white rounded-2xl shadow-2xl-light overflow-hidden border border-surface-200 flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-surface-100">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                            <h3 className="font-bold text-surface-900 tracking-tight">WhatsApp Conversation</h3>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-surface-100 rounded-xl transition-colors text-surface-400 hover:text-surface-600"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Iframe */}
                    <div className="flex-1 bg-surface-50 relative">
                        {widgetUrl && (
                            <iframe
                                ref={iframeRef}
                                src={widgetUrl}
                                className="w-full h-full"
                                frameBorder="0"
                                title="Agent Widget"
                                sandbox="allow-scripts allow-same-origin allow-forms"
                            />
                        )}
                        {!widgetUrl && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

export default AgentWidgetIframe;
