// Test fixtures for Genesys webhook service

const mockGenesysEvent = {
    id: 'event-123',
    topicName: 'v2.conversations.messages',
    eventBody: {
        id: 'msg-456',
        conversationId: 'conv-789',
        type: 'Text',
        text: 'Hello from Genesys',
        direction: 'Outbound'
    }
};

module.exports = {
    mockGenesysEvent
};
