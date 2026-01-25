// Test fixtures for auth service

const mockToken = {
    accessToken: 'test-access-token-12345',
    expiresAt: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
};

const mockGenesysTokenResponse = {
    access_token: 'genesys-token-67890',
    token_type: 'bearer',
    expires_in: 86400 // 24 hours
};

const mockOrganization = {
    id: 'org-123456',
    name: 'Test Organization',
    domain: 'test.mypurecloud.com',
    version: 1
};

module.exports = {
    mockToken,
    mockGenesysTokenResponse,
    mockOrganization
};
