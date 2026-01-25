/**
 * Internal Service Response Fixtures
 * Sample responses from internal microservices
 */

module.exports = {
    // Tenant configurations
    tenants: {
        tenant001: {
            tenantId: 'tenant-001',
            name: 'Test Tenant 1',
            status: 'active',
            whatsapp: {
                wabaId: '123456789012345',
                phoneNumberId: '123456789012345',
                displayPhoneNumber: '+1 555-0123',
                accessToken: 'EAABsbCS1iHgBO7ZCqVz4ZCqJZBZCqVz4ZCqJ',
                webhookVerifyToken: 'test-verify-token-123',
                businessId: '987654321'
            },
            genesys: {
                orgId: 'org-12345-abcde',
                region: 'mypurecloud.com',
                clientId: 'test-client-id',
                clientSecret: 'test-client-secret',
                deploymentId: 'deployment-12345',
                integrationId: 'integration-12345'
            },
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-14T10:00:00.000Z'
        },

        tenant002: {
            tenantId: 'tenant-002',
            name: 'Test Tenant 2',
            status: 'active',
            whatsapp: {
                wabaId: '543210987654321',
                phoneNumberId: '543210987654321',
                displayPhoneNumber: '+1 555-9876',
                accessToken: 'EAABsbCS1iHgBO7ZCqVz4ZCqJZBZCqVz4ZCqK',
                webhookVerifyToken: 'test-verify-token-456',
                businessId: '123456789'
            },
            genesys: {
                orgId: 'org-67890-fghij',
                region: 'mypurecloud.ie',
                clientId: 'test-client-id-2',
                clientSecret: 'test-client-secret-2',
                deploymentId: 'deployment-67890',
                integrationId: 'integration-67890'
            },
            createdAt: '2024-01-02T00:00:00.000Z',
            updatedAt: '2024-01-14T10:00:00.000Z'
        }
    },

    // Conversation state mappings
    conversationStates: {
        state001: {
            whatsappNumber: '+919876543210',
            tenantId: 'tenant-001',
            genesysConversationId: 'conv-12345-abcde-67890',
            lastMessageId: 'msg-67890',
            lastActivity: '2024-01-14T10:01:00.000Z',
            status: 'active',
            metadata: {
                customerName: 'John Doe',
                initialMessage: 'Hello, I need help!'
            }
        },

        state002: {
            whatsappNumber: '+919876543211',
            tenantId: 'tenant-001',
            genesysConversationId: 'conv-abcde-12345-67890',
            lastMessageId: 'msg-12345',
            lastActivity: '2024-01-14T09:30:00.000Z',
            status: 'active',
            metadata: {
                customerName: 'Jane Smith',
                initialMessage: 'I have a question'
            }
        }
    },

    // Auth tokens
    authTokens: {
        validToken: {
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token',
            type: 'Bearer',
            expiresAt: new Date(Date.now() + 86400000).toISOString()
        },

        expiredToken: {
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired.token',
            type: 'Bearer',
            expiresAt: new Date(Date.now() - 3600000).toISOString()
        }
    },

    // API responses
    responses: {
        // Tenant Service
        getTenantSuccess: {
            tenantId: 'tenant-001',
            name: 'Test Tenant 1',
            status: 'active'
        },

        getWhatsAppCredentials: {
            phoneNumberId: '123456789012345',
            accessToken: 'EAABsbCS1iHgBO7ZCqVz4ZCqJZBZCqVz4ZCqJ',
            displayPhoneNumber: '+1 555-0123'
        },

        getGenesysCredentials: {
            orgId: 'org-12345-abcde',
            region: 'mypurecloud.com',
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret'
        },

        // State Manager
        getConversationMapping: {
            whatsappNumber: '+919876543210',
            genesysConversationId: 'conv-12345-abcde-67890',
            tenantId: 'tenant-001',
            status: 'active'
        },

        createConversationMapping: {
            id: 'mapping-12345',
            whatsappNumber: '+919876543210',
            genesysConversationId: 'conv-12345-abcde-67890',
            tenantId: 'tenant-001',
            createdAt: '2024-01-14T10:00:00.000Z'
        },

        updateConversationState: {
            success: true,
            updated: true
        },

        // Auth Service
        getAuthToken: {
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token',
            type: 'Bearer'
        },

        validateToken: {
            valid: true
        },

        refreshToken: {
            token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refreshed.token',
            type: 'Bearer',
            refreshed: true
        }
    },

    // Error responses
    errors: {
        tenantNotFound: {
            error: 'Tenant not found',
            code: 'TENANT_NOT_FOUND',
            status: 404
        },

        invalidCredentials: {
            error: 'Invalid credentials',
            code: 'INVALID_CREDENTIALS',
            status: 401
        },

        conversationNotFound: {
            error: 'Conversation mapping not found',
            code: 'CONVERSATION_NOT_FOUND',
            status: 404
        },

        serviceUnavailable: {
            error: 'Service temporarily unavailable',
            code: 'SERVICE_UNAVAILABLE',
            status: 503
        }
    }
};
