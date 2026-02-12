/**
 * Detects whether the widget is running inside Genesys Cloud
 * or the Customer Portal, based on SDK presence and URL params.
 */
export function detectMode() {
    if (typeof window !== 'undefined' && window.Genesys && typeof window.Genesys === 'function') {
        return 'genesys';
    }
    const mode = new URLSearchParams(window.location.search).get('mode');
    if (mode === 'genesys' || mode === 'portal') return mode;
    return 'portal';
}

/**
 * Get initialization parameters based on mode.
 * @returns {{ conversationId, tenantId, integrationId, token }}
 */
export function getInitParams(mode) {
    const urlParams = new URLSearchParams(window.location.search);

    if (mode === 'genesys') {
        return {
            conversationId: getGenesysConversationId(),
            tenantId: urlParams.get('tenantId'),
            integrationId: urlParams.get('integrationId'),
            token: getGenesysToken(),
        };
    }

    // Portal mode — all params from URL
    return {
        conversationId: urlParams.get('conversationId'),
        tenantId: urlParams.get('tenantId'),
        integrationId: urlParams.get('integrationId'),
        token: urlParams.get('token') || getCookieToken(),
    };
}

function getGenesysConversationId() {
    try {
        if (window.Genesys && typeof window.Genesys.getActiveConversationId === 'function') {
            return window.Genesys.getActiveConversationId();
        }
    } catch {}
    return new URLSearchParams(window.location.search).get('conversationId');
}

function getGenesysToken() {
    try {
        if (window.Genesys && typeof window.Genesys.getToken === 'function') {
            return window.Genesys.getToken();
        }
    } catch {}
    return new URLSearchParams(window.location.search).get('token') || '';
}

function getCookieToken() {
    const match = document.cookie.match(/(?:^|;\s*)session_token=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}
