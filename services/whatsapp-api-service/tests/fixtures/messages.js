// Test fixtures for WhatsApp API service

const mockTextMessage = {
    messaging_product: 'whatsapp',
    to: '+1234567890',
    type: 'text',
    text: { body: 'Test message' }
};

const mockImageMessage = {
    messaging_product: 'whatsapp',
    to: '+1234567890',
    type: 'image',
    image: { link: 'https://example.com/image.jpg' }
};

module.exports = {
    mockTextMessage,
    mockImageMessage
};
