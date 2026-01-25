/**
 * Internal Service Mocks
 * Mocks for tenant-service, state-manager, and auth-service
 */

const nock = require('nock');
const fixtures = require('../../fixtures/internal-fixtures');

const TENANT_SERVICE_URL = process.env.TENANT_SERVICE_URL || 'http://localhost:3001';
const STATE_MANAGER_URL = process.env.STATE_MANAGER_URL || 'http://localhost:3005';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3004';

class TenantServiceMock {
    activate() {
        // Get tenant configuration
        nock(TENANT_SERVICE_URL)
            .get(/\/tenants\/[^/]+$/)
            .reply(200, (uri) => {
                const tenantId = uri.split('/').pop();
                return fixtures.tenants[tenantId] || fixtures.responses.getTenantSuccess;
            });

        // Get WhatsApp credentials
        nock(TENANT_SERVICE_URL)
            .get(/\/tenants\/[^/]+\/whatsapp/)
            .reply(200, fixtures.responses.getWhatsAppCredentials);

        // Get Genesys credentials
        nock(TENANT_SERVICE_URL)
            .get(/\/tenants\/[^/]+\/genesys/)
            .reply(200, fixtures.responses.getGenesysCredentials);

        // Update tenant configuration
        nock(TENANT_SERVICE_URL)
            .put(/\/tenants\/[^/]+/)
            .reply(200, { success: true });

        console.log('Tenant service mocks activated');
    }

    deactivate() {
        nock.cleanAll();
    }

    mockError(errorType = 'tenantNotFound') {
        const error = fixtures.errors[errorType];
        nock(TENANT_SERVICE_URL)
            .persist()
            .get(/\/tenants/)
            .reply(error.status, error);
    }
}

class StateManagerMock {
    activate() {
        // Get conversation mapping
        nock(STATE_MANAGER_URL)
            .get(/\/state\/conversation/)
            .query(true)
            .reply(200, (uri, body, cb) => {
                const params = new URL(uri, STATE_MANAGER_URL).searchParams;
                const whatsappNumber = params.get('whatsappNumber');

                // Find matching state
                const state = Object.values(fixtures.conversationStates)
                    .find(s => s.whatsappNumber === whatsappNumber);

                cb(null, state || fixtures.responses.getConversationMapping);
            });

        // Create conversation mapping
        nock(STATE_MANAGER_URL)
            .post('/state/conversation')
            .reply(201, fixtures.responses.createConversationMapping);

        // Update conversation state
        nock(STATE_MANAGER_URL)
            .patch(/\/state\/conversation\/[^/]+/)
            .reply(200, fixtures.responses.updateConversationState);

        // Store message metadata
        nock(STATE_MANAGER_URL)
            .post('/state/message')
            .reply(201, { success: true });

        console.log('State manager mocks activated');
    }

    deactivate() {
        nock.cleanAll();
    }

    mockError(errorType = 'conversationNotFound') {
        const error = fixtures.errors[errorType];
        nock(STATE_MANAGER_URL)
            .persist()
            .get(/\/state/)
            .reply(error.status, error);
    }
}

class AuthServiceMock {
    activate() {
        // Get auth token
        nock(AUTH_SERVICE_URL)
            .get('/auth/token')
            .reply(200, fixtures.responses.getAuthToken);

        // Validate token
        nock(AUTH_SERVICE_URL)
            .post('/auth/validate')
            .reply(200, fixtures.responses.validateToken);

        // Refresh token
        nock(AUTH_SERVICE_URL)
            .post('/auth/refresh')
            .reply(200, fixtures.responses.refreshToken);

        // Health check
        nock(AUTH_SERVICE_URL)
            .get('/health')
            .reply(200, { status: 'healthy', redis: 'connected' });

        console.log('Auth service mocks activated');
    }

    deactivate() {
        nock.cleanAll();
    }

    mockError(errorType = 'invalidCredentials') {
        const error = fixtures.errors[errorType];
        nock(AUTH_SERVICE_URL)
            .persist()
            .get('/auth/token')
            .reply(error.status, error);
    }
}

// Export instances
module.exports = {
    tenantService: new TenantServiceMock(),
    stateManager: new StateManagerMock(),
    authService: new AuthServiceMock()
};
