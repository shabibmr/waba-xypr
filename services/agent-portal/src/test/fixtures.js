// Test data factories for consistent mock data

export const mockAgent = {
    id: 'agent-123',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'agent',
    organization: {
        id: 'org-123',
        name: 'Test Organization',
        tenant_id: 'tenant-123',
        timezone: 'America/New_York',
        whatsapp: {
            waba_id: '123456789',
            phone_number: '+1234567890',
            status: 'active'
        },
        genesys: {
            client_id: 'genesys-client-123',
            region: 'us-east-1',
            status: 'connected'
        }
    }
};

export const mockConversations = [
    {
        conversation_id: 'conv-1',
        contact_name: 'Alice Smith',
        wa_id: '+1111111111',
        status: 'active',
        last_message: 'Hello, how can I help?',
        unread_count: 2,
        created_at: '2024-02-10T10:00:00Z',
        updated_at: '2024-02-12T14:30:00Z'
    },
    {
        conversation_id: 'conv-2',
        contact_name: 'Bob Johnson',
        wa_id: '+2222222222',
        status: 'closed',
        last_message: 'Thank you for your help',
        unread_count: 0,
        created_at: '2024-02-11T09:00:00Z',
        updated_at: '2024-02-11T15:00:00Z'
    },
    {
        conversation_id: 'conv-3',
        contact_name: 'Charlie Brown',
        wa_id: '+3333333333',
        status: 'active',
        last_message: 'I need assistance',
        unread_count: 1,
        created_at: '2024-02-12T08:00:00Z',
        updated_at: '2024-02-12T16:00:00Z'
    }
];

export const mockMessages = [
    {
        id: 'msg-1',
        conversation_id: 'conv-1',
        direction: 'inbound',
        text: 'Hello, how can I help?',
        timestamp: '2024-02-12T14:25:00Z',
        status: 'delivered'
    },
    {
        id: 'msg-2',
        conversation_id: 'conv-1',
        direction: 'outbound',
        text: 'Hi! How may I assist you today?',
        timestamp: '2024-02-12T14:26:00Z',
        status: 'sent'
    },
    {
        id: 'msg-3',
        conversation_id: 'conv-1',
        direction: 'inbound',
        text: 'I have a question about my order',
        timestamp: '2024-02-12T14:30:00Z',
        status: 'delivered'
    }
];

export const mockDashboardMetrics = {
    kpis: {
        total: 45,
        active: 12,
        closed: 33,
        today: 5
    },
    tokenHealth: {
        daysRemaining: 45,
        status: 'healthy',
        expiresAt: '2024-03-29T00:00:00Z'
    },
    charts: {
        conversationsOverTime: [
            { date: '2024-02-10', count: 8 },
            { date: '2024-02-11', count: 12 },
            { date: '2024-02-12', count: 5 }
        ]
    }
};

export const mockGenesysCredentials = {
    clientId: 'test-client-id-123',
    clientSecret: 'test-secret-456',
    region: 'us-east-1'
};

export const mockValidationResults = {
    genesys: {
        status: 'success',
        message: 'Genesys Cloud API connected successfully'
    },
    whatsapp: {
        status: 'success',
        message: 'WhatsApp Business API connected successfully'
    },
    webhooks: {
        status: 'success',
        message: 'All webhook endpoints are reachable'
    }
};

export const mockWebhookUrls = {
    meta: 'http://localhost:3000/webhook/meta/tenant-123',
    genesys: 'http://localhost:3000/webhook/genesys/tenant-123'
};
