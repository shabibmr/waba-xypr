/**
 * WhatsApp Graph API Mock
 * Mocks all WhatsApp Business API endpoints using nock
 */

const nock = require('nock');
const fixtures = require('../../fixtures/whatsapp-fixtures');

const GRAPH_API_BASE = 'https://graph.facebook.com';
const API_VERSION = process.env.META_GRAPH_API_VERSION || 'v18.0';

class WhatsAppApiMock {
    constructor() {
        this.scope = null;
        this.isActive = false;
    }

    /**
     * Activate all WhatsApp API mocks
     */
    activate() {
        if (this.isActive) return;

        this.scope = nock(GRAPH_API_BASE);
        this.isActive = true;

        // Mock OAuth token exchange
        this.mockTokenExchange();

        // Mock debug token
        this.mockDebugToken();

        // Mock phone number details
        this.mockPhoneNumberDetails();

        // Mock send message
        this.mockSendMessage();

        // Mock send template
        this.mockSendTemplate();

        // Mock mark as read
        this.mockMarkAsRead();

        // Mock media operations
        this.mockMediaUpload();
        this.mockMediaUrl();
        this.mockMediaDownload();

        console.log('WhatsApp API mocks activated');
    }

    /**
     * Deactivate all mocks
     */
    deactivate() {
        if (!this.isActive) return;
        nock.cleanAll();
        this.scope = null;
        this.isActive = false;
        console.log('WhatsApp API mocks deactivated');
    }

    /**
     * Mock OAuth token exchange
     */
    mockTokenExchange(customResponse = null) {
        nock(GRAPH_API_BASE)
            .get(`/${API_VERSION}/oauth/access_token`)
            .query(true)
            .reply(200, customResponse || fixtures.tokenExchangeSuccess);
    }

    /**
     * Mock debug token endpoint
     */
    mockDebugToken(customResponse = null) {
        nock(GRAPH_API_BASE)
            .get(`/${API_VERSION}/debug_token`)
            .query(true)
            .reply(200, customResponse || fixtures.debugTokenSuccess);
    }

    /**
     * Mock phone number details
     */
    mockPhoneNumberDetails(phoneNumberId = '123456789012345', customResponse = null) {
        nock(GRAPH_API_BASE)
            .get(`/${API_VERSION}/${phoneNumberId}`)
            .query(true)
            .reply(200, customResponse || fixtures.phoneNumberDetails);
    }

    /**
     * Mock send message endpoint
     */
    mockSendMessage(phoneNumberId = '123456789012345', customResponse = null, statusCode = 200) {
        nock(GRAPH_API_BASE)
            .post(`/${API_VERSION}/${phoneNumberId}/messages`, body => {
                // Validate message structure
                return body.messaging_product === 'whatsapp';
            })
            .reply(statusCode, customResponse || fixtures.messageSendSuccess);
    }

    /**
     * Mock send template endpoint
     */
    mockSendTemplate(phoneNumberId = '123456789012345', customResponse = null) {
        nock(GRAPH_API_BASE)
            .post(`/${API_VERSION}/${phoneNumberId}/messages`, body => {
                return body.type === 'template';
            })
            .reply(200, customResponse || fixtures.templateSendSuccess);
    }

    /**
     * Mock mark as read
     */
    mockMarkAsRead(phoneNumberId = '123456789012345', customResponse = null) {
        nock(GRAPH_API_BASE)
            .post(`/${API_VERSION}/${phoneNumberId}/messages`, body => {
                return body.status === 'read';
            })
            .reply(200, customResponse || fixtures.markAsReadSuccess);
    }

    /**
     * Mock media upload
     */
    mockMediaUpload(phoneNumberId = '123456789012345', customResponse = null) {
        nock(GRAPH_API_BASE)
            .post(`/${API_VERSION}/${phoneNumberId}/media`)
            .reply(200, customResponse || fixtures.mediaUploadSuccess);
    }

    /**
     * Mock get media URL
     */
    mockMediaUrl(mediaId = 'media-id-12345', customResponse = null) {
        nock(GRAPH_API_BASE)
            .get(`/${API_VERSION}/${mediaId}`)
            .query(true)
            .reply(200, customResponse || fixtures.mediaUrlSuccess);
    }

    /**
     * Mock media download
     */
    mockMediaDownload(mediaUrl = null, customResponse = 'binary-data') {
        const url = mediaUrl || fixtures.mediaUrlSuccess.url;
        nock('https://lookaside.fbsbx.com')
            .get(/\/whatsapp_business\/attachments\//)
            .query(true)
            .reply(200, customResponse, {
                'Content-Type': 'image/jpeg'
            });
    }

    /**
     * Mock error responses
     */
    mockError(endpoint, errorType = 'invalidToken') {
        const error = fixtures.errors[errorType];
        const statusCode = errorType === 'rateLimitExceeded' ? 429 :
            errorType === 'invalidToken' ? 401 : 400;

        nock(GRAPH_API_BASE)
            .persist()
            .intercept(new RegExp(endpoint), 'POST')
            .reply(statusCode, error);
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
module.exports = new WhatsAppApiMock();
