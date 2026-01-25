/**
 * Test Data Builders
 * Builder pattern utilities for creating test data
 */

class TenantBuilder {
    constructor() {
        this.data = {
            tenantId: `tenant-${Date.now()}`,
            name: 'Test Tenant',
            status: 'active',
            whatsapp: {
                wabaId: '123456789012345',
                phoneNumberId: '123456789012345',
                displayPhoneNumber: '+1 555-0123',
                accessToken: 'test-access-token',
                webhookVerifyToken: 'test-verify-token',
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
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    }

    withId(tenantId) {
        this.data.tenantId = tenantId;
        return this;
    }

    withName(name) {
        this.data.name = name;
        return this;
    }

    withWhatsApp(config) {
        this.data.whatsapp = { ...this.data.whatsapp, ...config };
        return this;
    }

    withGenesys(config) {
        this.data.genesys = { ...this.data.genesys, ...config };
        return this;
    }

    withStatus(status) {
        this.data.status = status;
        return this;
    }

    build() {
        return { ...this.data };
    }
}

class MessageBuilder {
    constructor() {
        this.data = {
            from: '+919876543210',
            to: '+1 555-0123',
            type: 'text',
            text: 'Hello, I need help!',
            timestamp: new Date().toISOString(),
            messageId: `msg-${Date.now()}`
        };
    }

    from(phoneNumber) {
        this.data.from = phoneNumber;
        return this;
    }

    to(phoneNumber) {
        this.data.to = phoneNumber;
        return this;
    }

    withText(text) {
        this.data.type = 'text';
        this.data.text = text;
        return this;
    }

    withImage(imageUrl, caption = '') {
        this.data.type = 'image';
        this.data.image = { link: imageUrl, caption };
        delete this.data.text;
        return this;
    }

    withDocument(documentUrl, filename, caption = '') {
        this.data.type = 'document';
        this.data.document = { link: documentUrl, filename, caption };
        delete this.data.text;
        return this;
    }

    withLocation(latitude, longitude, name = '', address = '') {
        this.data.type = 'location';
        this.data.location = { latitude, longitude, name, address };
        delete this.data.text;
        return this;
    }

    withId(messageId) {
        this.data.messageId = messageId;
        return this;
    }

    withTimestamp(timestamp) {
        this.data.timestamp = timestamp;
        return this;
    }

    build() {
        return { ...this.data };
    }
}

class ConversationBuilder {
    constructor() {
        this.data = {
            id: `conv-${Date.now()}`,
            whatsappNumber: '+919876543210',
            tenantId: 'tenant-001',
            genesysConversationId: null,
            status: 'active',
            messages: [],
            metadata: {},
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString()
        };
    }

    withId(id) {
        this.data.id = id;
        return this;
    }

    withWhatsAppNumber(phoneNumber) {
        this.data.whatsappNumber = phoneNumber;
        return this;
    }

    withTenantId(tenantId) {
        this.data.tenantId = tenantId;
        return this;
    }

    withGenesysConversationId(conversationId) {
        this.data.genesysConversationId = conversationId;
        return this;
    }

    withStatus(status) {
        this.data.status = status;
        return this;
    }

    addMessage(message) {
        this.data.messages.push(message);
        return this;
    }

    withMetadata(metadata) {
        this.data.metadata = { ...this.data.metadata, ...metadata };
        return this;
    }

    build() {
        return { ...this.data };
    }
}

class CredentialBuilder {
    constructor(type = 'whatsapp') {
        this.type = type;
        this.data = type === 'whatsapp' ? {
            phoneNumberId: '123456789012345',
            accessToken: 'test-access-token',
            displayPhoneNumber: '+1 555-0123',
            wabaId: '123456789012345'
        } : {
            orgId: 'org-12345-abcde',
            region: 'mypurecloud.com',
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret'
        };
    }

    withPhoneNumberId(phoneNumberId) {
        if (this.type === 'whatsapp') {
            this.data.phoneNumberId = phoneNumberId;
        }
        return this;
    }

    withAccessToken(accessToken) {
        this.data.accessToken = accessToken;
        return this;
    }

    withOrgId(orgId) {
        if (this.type === 'genesys') {
            this.data.orgId = orgId;
        }
        return this;
    }

    withRegion(region) {
        if (this.type === 'genesys') {
            this.data.region = region;
        }
        return this;
    }

    withClientId(clientId) {
        if (this.type === 'genesys') {
            this.data.clientId = clientId;
        }
        return this;
    }

    build() {
        return { ...this.data };
    }
}

// Factory functions for convenience
const builders = {
    tenant: () => new TenantBuilder(),
    message: () => new MessageBuilder(),
    conversation: () => new ConversationBuilder(),
    whatsappCredentials: () => new CredentialBuilder('whatsapp'),
    genesysCredentials: () => new CredentialBuilder('genesys')
};

module.exports = builders;
