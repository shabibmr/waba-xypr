/**
 * Genesys Cloud API Response Fixtures
 * Sample responses from Genesys Cloud Platform APIs
 */

module.exports = {
    // OAuth token response
    tokenSuccess: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token',
        token_type: 'bearer',
        expires_in: 86400
    },

    // Organization details
    organizationDetails: {
        id: 'org-12345-abcde',
        name: 'Test Organization',
        domain: 'test-org.mypurecloud.com',
        version: 1,
        state: 'active',
        defaultSiteId: 'site-12345',
        supportURI: 'https://help.mypurecloud.com',
        voicemailEnabled: true
    },

    // Create conversation response
    createConversationSuccess: {
        id: 'conv-12345-abcde-67890',
        name: 'Open Messaging Conversation',
        startTime: '2024-01-14T10:00:00.000Z',
        endTime: null,
        participants: [{
            id: 'participant-12345',
            startTime: '2024-01-14T10:00:00.000Z',
            purpose: 'customer',
            state: 'connected',
            direction: 'inbound',
            messages: [{
                id: 'msg-12345',
                messageTime: '2024-01-14T10:00:00.000Z',
                type: 'text',
                textBody: 'Hello, I need help!',
                direction: 'inbound'
            }]
        }],
        conversationIds: ['conv-12345-abcde-67890']
    },

    // Add message to conversation response
    addMessageSuccess: {
        id: 'msg-67890',
        messageTime: '2024-01-14T10:01:00.000Z',
        type: 'text',
        textBody: 'Thank you for contacting us',
        direction: 'outbound',
        conversation: {
            id: 'conv-12345-abcde-67890'
        }
    },

    // Get conversation details
    conversationDetails: {
        id: 'conv-12345-abcde-67890',
        name: 'Open Messaging Conversation',
        startTime: '2024-01-14T10:00:00.000Z',
        participants: [{
            id: 'participant-12345',
            name: 'John Doe',
            purpose: 'customer',
            state: 'connected',
            direction: 'inbound',
            attributes: {
                tenantId: 'tenant-001',
                whatsappNumber: '+919876543210'
            },
            messages: [{
                id: 'msg-12345',
                messageTime: '2024-01-14T10:00:00.000Z',
                type: 'text',
                textBody: 'Hello, I need help!'
            }]
        }, {
            id: 'participant-67890',
            purpose: 'agent',
            state: 'connected',
            direction: 'outbound',
            userId: 'agent-12345'
        }]
    },

    // Get conversation messages
    conversationMessages: {
        entities: [{
            id: 'msg-12345',
            messageTime: '2024-01-14T10:00:00.000Z',
            type: 'text',
            textBody: 'Hello, I need help!',
            direction: 'inbound',
            fromAddress: '+919876543210'
        }, {
            id: 'msg-67890',
            messageTime: '2024-01-14T10:01:00.000Z',
            type: 'text',
            textBody: 'Thank you for contacting us',
            direction: 'outbound',
            toAddress: '+919876543210'
        }],
        total: 2,
        pageSize: 25,
        pageNumber: 1,
        pageCount: 1
    },

    // Receipt success (no body returned)
    receiptSuccess: {},

    // Update attributes success (no body returned)
    updateAttributesSuccess: {},

    // Disconnect conversation success (no body returned)
    disconnectSuccess: {},

    // Typing indicator success (no body returned)
    typingIndicatorSuccess: {},

    // User details
    userDetails: {
        id: 'user-12345',
        name: 'Agent Smith',
        email: 'agent.smith@test.com',
        state: 'active',
        version: 1
    },

    // Error responses
    errors: {
        unauthorized: {
            message: 'Authentication required',
            code: 'authentication.required',
            status: 401,
            contextId: 'ctx-12345',
            details: [],
            errors: []
        },

        forbidden: {
            message: 'Insufficient permissions',
            code: 'missing.permissions',
            status: 403,
            contextId: 'ctx-67890',
            details: [{
                errorCode: 'missing.permissions',
                fieldName: null,
                entityId: null,
                entityName: null
            }],
            errors: []
        },

        notFound: {
            message: 'The requested resource was not found',
            code: 'not.found',
            status: 404,
            contextId: 'ctx-abcde',
            details: [],
            errors: []
        },

        rateLimitExceeded: {
            message: 'Rate limit exceeded',
            code: 'rate.limit.exceeded',
            status: 429,
            contextId: 'ctx-fghij',
            details: [{
                errorCode: 'rate.limit.exceeded',
                fieldName: null,
                entityId: null,
                entityName: null
            }],
            errors: []
        },

        invalidRequest: {
            message: 'Invalid request body',
            code: 'bad.request',
            status: 400,
            contextId: 'ctx-klmno',
            details: [{
                errorCode: 'constraint.validation',
                fieldName: 'text',
                entityId: null,
                entityName: null
            }],
            errors: []
        }
    },

    // Webhook notification (outbound message from agent)
    webhookOutboundMessage: {
        topicName: 'v2.conversations.messages.{id}.messages',
        version: '2',
        eventBody: {
            id: 'msg-outbound-12345',
            conversation: {
                id: 'conv-12345-abcde-67890'
            },
            sender: {
                id: 'agent-12345'
            },
            body: 'How can I help you today?',
            bodyType: 'standard',
            timestamp: '2024-01-14T10:02:00.000Z',
            direction: 'outbound',
            messageStatus: 'sent'
        },
        metadata: {
            correlationId: 'corr-12345'
        }
    }
};
