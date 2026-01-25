// Test fixtures for inbound transformer

const mockWhatsAppTextMessage = {
    from: '+1234567890',
    id: 'wamid.test123',
    timestamp: '1234567890',
    type: 'text',
    text: { body: 'Hello from WhatsApp' }
};

const mockGenesysMessage = {
    id: 'genesys-msg-123',
    channel: { platform: 'Open' },
    type: 'Text',
    text: 'Hello from WhatsApp',
    direction: 'Inbound'
};

module.exports = {
    mockWhatsAppTextMessage,
    mockGenesysMessage
};
