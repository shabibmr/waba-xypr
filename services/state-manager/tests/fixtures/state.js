// Test fixtures for state manager

const mockConversation = {
    whatsappNumber: '+1234567890',
    genesysConversationId: 'conv-123456',
    tenantId: 'test-tenant-001',
    status: 'active',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
};

const mockMessage = {
    messageId: 'msg-123',
    conversationId: 'conv-123456',
    direction: 'inbound',
    content: 'Test message',
    timestamp: '2024-01-01T00:00:00.000Z'
};

module.exports = {
    mockConversation,
    mockMessage
};
