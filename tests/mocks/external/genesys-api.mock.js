/**
 * Genesys Cloud API Mock
 * Mocks all Genesys Cloud Platform API endpoints using nock
 */

const nock = require('nock');
const fixtures = require('../../fixtures/genesys-fixtures');

const GENESYS_REGION = process.env.GENESYS_REGION || 'mypurecloud.com';
const LOGIN_BASE = `https://login.${GENESYS_REGION}`;
const API_BASE = `https://api.${GENESYS_REGION}`;

class GenesysApiMock {
    constructor() {
        this.scope = null;
        this.isActive = false;
    }

    /**
     * Activate all Genesys API mocks
     */
    activate() {
        if (this.isActive) return;

        this.isActive = true;

        // Mock OAuth endpoints
        this.mockOAuthToken();

        // Mock conversation endpoints
        this.mockCreateConversation();
        this.mockAddMessage();
        this.mockGetConversation();
        this.mockGetMessages();
        this.mockSendReceipt();
        this.mockUpdateAttributes();
        this.mockDisconnect();
        this.mockTypingIndicator();

        // Mock organization endpoints
        this.mockGetOrganization();
        this.mockGetUser();

        console.log('Genesys API mocks activated');
    }

    /**
     * Deactivate all mocks
     */
    deactivate() {
        if (!this.isActive) return;
        nock.cleanAll();
        this.scope = null;
        this.isActive = false;
        console.log('Genesys API mocks deactivated');
    }

    /**
     * Mock OAuth token endpoint
     */
    mockOAuthToken(customResponse = null) {
        nock(LOGIN_BASE)
            .post('/oauth/token')
            .reply(200, customResponse || fixtures.tokenSuccess);
    }

    /**
     * Mock create conversation
     */
    mockCreateConversation(customResponse = null, statusCode = 200) {
        nock(API_BASE)
            .post('/api/v2/conversations/messages', body => {
                return body.direction === 'Inbound';
            })
            .reply(statusCode, customResponse || fixtures.createConversationSuccess);
    }

    /**
     * Mock add message to conversation
     */
    mockAddMessage(conversationId = null, customResponse = null) {
        const pattern = conversationId
            ? `/api/v2/conversations/messages/${conversationId}/messages`
            : /\/api\/v2\/conversations\/messages\/[^/]+\/messages/;

        nock(API_BASE)
            .post(pattern)
            .reply(200, customResponse || fixtures.addMessageSuccess);
    }

    /**
     * Mock get conversation details
     */
    mockGetConversation(conversationId = null, customResponse = null) {
        const pattern = conversationId
            ? `/api/v2/conversations/${conversationId}`
            : /\/api\/v2\/conversations\/[^/]+$/;

        nock(API_BASE)
            .get(pattern)
            .reply(200, customResponse || fixtures.conversationDetails);
    }

    /**
     * Mock get conversation messages
     */
    mockGetMessages(conversationId = null, customResponse = null) {
        const pattern = conversationId
            ? `/api/v2/conversations/messages/${conversationId}/messages`
            : /\/api\/v2\/conversations\/messages\/[^/]+\/messages/;

        nock(API_BASE)
            .get(pattern)
            .reply(200, customResponse || fixtures.conversationMessages);
    }

    /**
     * Mock send receipt
     */
    mockSendReceipt(conversationId = null, customResponse = null) {
        const pattern = conversationId
            ? `/api/v2/conversations/messages/${conversationId}/receipts`
            : /\/api\/v2\/conversations\/messages\/[^/]+\/receipts/;

        nock(API_BASE)
            .post(pattern)
            .reply(200, customResponse || fixtures.receiptSuccess);
    }

    /**
     * Mock update conversation attributes
     */
    mockUpdateAttributes(conversationId = null, customResponse = null) {
        const pattern = conversationId
            ? `/api/v2/conversations/${conversationId}/attributes`
            : /\/api\/v2\/conversations\/[^/]+\/attributes/;

        nock(API_BASE)
            .patch(pattern)
            .reply(200, customResponse || fixtures.updateAttributesSuccess);
    }

    /**
     * Mock disconnect conversation
     */
    mockDisconnect(conversationId = null, customResponse = null) {
        const pattern = conversationId
            ? `/api/v2/conversations/${conversationId}/disconnect`
            : /\/api\/v2\/conversations\/[^/]+\/disconnect/;

        nock(API_BASE)
            .post(pattern)
            .reply(200, customResponse || fixtures.disconnectSuccess);
    }

    /**
     * Mock typing indicator
     */
    mockTypingIndicator(conversationId = null, customResponse = null) {
        const pattern = conversationId
            ? `/api/v2/conversations/messages/${conversationId}/typing`
            : /\/api\/v2\/conversations\/messages\/[^/]+\/typing/;

        nock(API_BASE)
            .post(pattern)
            .reply(200, customResponse || fixtures.typingIndicatorSuccess);
    }

    /**
     * Mock get organization
     */
    mockGetOrganization(customResponse = null) {
        nock(API_BASE)
            .get('/api/v2/organizations/me')
            .reply(200, customResponse || fixtures.organizationDetails);
    }

    /**
     * Mock get user
     */
    mockGetUser(userId = 'me', customResponse = null) {
        nock(API_BASE)
            .get(`/api/v2/users/${userId}`)
            .reply(200, customResponse || fixtures.userDetails);
    }

    /**
     * Mock error responses
     */
    mockError(endpoint, errorType = 'unauthorized') {
        const error = fixtures.errors[errorType];
        const statusCode = error.status;

        nock(API_BASE)
            .persist()
            .intercept(new RegExp(endpoint), /GET|POST|PATCH/)
            .reply(statusCode, error);
    }

    /**
     * Mock OAuth authorization flow
     */
    mockOAuthAuthorize() {
        nock(LOGIN_BASE)
            .get('/oauth/authorize')
            .query(true)
            .reply(302, '', {
                'Location': 'http://localhost:3006/auth/callback?code=test-auth-code&state=test-state'
            });
    }

    /**
     * Reset all mocks
     */
    reset() {
        this.deactivate();
        this.activate();
    }
}

// Export singleton instance
module.exports = new GenesysApiMock();
