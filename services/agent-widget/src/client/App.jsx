import React, { useEffect } from 'react';
import { useWidgetInit } from './hooks/useWidgetInit';
import ChatUI from './components/ChatUI';
import LoadingScreen from './components/LoadingScreen';
import ErrorScreen from './components/ErrorScreen';
import SecurityWrapper from './components/SecurityWrapper';

const TITLES = {
    genesys: 'WhatsApp — Genesys',
    portal: 'WhatsApp Chat',
};

export default function App() {
    const init = useWidgetInit();

    // Apply theme class and window title based on detected mode
    useEffect(() => {
        if (init.mode) {
            document.body.className = init.mode === 'genesys' ? 'theme-genesys' : 'theme-portal';
            document.title = TITLES[init.mode] || 'WhatsApp Widget';
        }
    }, [init.mode]);

    if (init.loading) return <LoadingScreen />;
    if (init.error) return <ErrorScreen message={init.error} mode={init.mode} />;

    return (
        <SecurityWrapper tenantId={init.tenantId}>
            <ChatUI
                conversationId={init.conversationId}
                tenantId={init.tenantId}
                waId={init.waId}
                mode={init.mode}
                pciMode={init.pciMode}
            />
        </SecurityWrapper>
    );
}
