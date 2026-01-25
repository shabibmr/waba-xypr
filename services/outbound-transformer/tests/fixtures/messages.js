// Test fixtures for outbound transformer

const mockGenesysTextMessage = {
    id: 'genesys-msg-123',
    channel: { platform: 'Open' },
    type: 'Text',
    text: 'Hello from Genesys',
    direction: 'Outbound'
};

const mockWhatsAppMessage = {
    messaging_product: 'whatsapp',
    to: '+1234567890',
    type: 'text',
    text: { body: 'Hello from Genesys' }
};

module.exports = {
    mockGenesysTextMessage,
    mockWhatsAppMessage
};
