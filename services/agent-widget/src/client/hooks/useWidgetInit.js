import { useState, useEffect } from 'react';
import { detectMode, getInitParams } from '../utils/hostDetector';
import { resolveContext } from '../services/widgetApi';

export function useWidgetInit() {
    const [state, setState] = useState({
        mode: null,
        conversationId: null,
        tenantId: null,
        waId: null,
        integrationId: null,
        pciMode: false,
        loading: true,
        error: null,
    });

    useEffect(() => {
        async function init() {
            try {
                const mode = detectMode();
                const params = getInitParams(mode);

                if (!params.conversationId) {
                    throw new Error('Missing conversationId in URL params');
                }

                // Store token for subsequent API calls
                if (params.token) {
                    window.__WIDGET_TOKEN__ = params.token;
                }

                const ctx = await resolveContext(params.conversationId, params.tenantId);
                if (!ctx || !ctx.id) throw new Error('InvalidConversation');

                setState({
                    mode,
                    conversationId: params.conversationId,
                    tenantId: ctx.tenantId || params.tenantId,
                    waId: ctx.waId || ctx.wa_id,
                    integrationId: params.integrationId,
                    pciMode: ctx.pciMode || false,
                    loading: false,
                    error: null,
                });
            } catch (err) {
                setState(s => ({ ...s, loading: false, error: err.message }));
            }
        }
        init();
    }, []);

    return state;
}
