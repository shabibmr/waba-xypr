// All API calls go to agent-portal-service via the URL from window.__WIDGET_CONFIG__
const getBase = () => window.__WIDGET_CONFIG__?.apiUrl || '';

function getHeaders(tenantId) {
    const token = window.__WIDGET_TOKEN__
        || new URLSearchParams(window.location.search).get('token')
        || localStorage.getItem('session_token')
        || '';
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
    };
}

/**
 * Resolve conversation context — calls GET /api/conversations/:id on agent-portal-service
 */
export async function resolveContext(conversationId, tenantId) {
    const res = await fetch(`${getBase()}/api/conversations/${conversationId}`, {
        headers: getHeaders(tenantId),
    });
    if (!res.ok) throw new Error('InvalidConversation');
    return res.json();
}

/**
 * Fetch message history — calls GET /api/conversations/:id/messages
 */
export async function fetchHistory(conversationId, tenantId, limit = 50, offset = 0) {
    const res = await fetch(
        `${getBase()}/api/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}`,
        { headers: getHeaders(tenantId) }
    );
    if (!res.ok) return { messages: [] };
    return res.json();
}

/**
 * Send an outbound message — calls POST /api/messages/send on agent-portal-service
 */
export async function sendMessage({ conversationId, tenantId, waId, text, messageId }) {
    const res = await fetch(`${getBase()}/api/messages/send`, {
        method: 'POST',
        headers: getHeaders(tenantId),
        body: JSON.stringify({ conversationId, tenantId, text, messageId }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || 'Send failed');
    }
    return res.json();
}
