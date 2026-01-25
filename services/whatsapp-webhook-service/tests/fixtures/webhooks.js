// Test fixtures for WhatsApp webhook service

const mockWhatsAppMessage = {
    object: 'whatsapp_business_account',
    entry: [{
        id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
        changes: [{
            value: {
                messaging_product: 'whatsapp',
                metadata: {
                    display_phone_number: '+1234567890',
                    phone_number_id: 'PHONE_NUMBER_ID'
                },
                messages: [{
                    from: '+9876543210',
                    id: 'wamid.test123',
                    timestamp: '1234567890',
                    type: 'text',
                    text: {
                        body: 'Hello, this is a test message'
                    }
                }]
            },
            field: 'messages'
        }]
    }]
};

const mockImageMessage = {
    object: 'whatsapp_business_account',
    entry: [{
        id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
        changes: [{
            value: {
                messaging_product: 'whatsapp',
                metadata: {
                    display_phone_number: '+1234567890',
                    phone_number_id: 'PHONE_NUMBER_ID'
                },
                messages: [{
                    from: '+9876543210',
                    id: 'wamid.test456',
                    timestamp: '1234567890',
                    type: 'image',
                    image: {
                        id: 'IMAGE_ID',
                        mime_type: 'image/jpeg',
                        sha256: 'IMAGE_HASH'
                    }
                }]
            },
            field: 'messages'
        }]
    }]
};

const mockStatusUpdate = {
    object: 'whatsapp_business_account',
    entry: [{
        id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
        changes: [{
            value: {
                messaging_product: 'whatsapp',
                metadata: {
                    display_phone_number: '+1234567890',
                    phone_number_id: 'PHONE_NUMBER_ID'
                },
                statuses: [{
                    id: 'wamid.test123',
                    status: 'delivered',
                    timestamp: '1234567890',
                    recipient_id: '+9876543210'
                }]
            },
            field: 'messages'
        }]
    }]
};

module.exports = {
    mockWhatsAppMessage,
    mockImageMessage,
    mockStatusUpdate
};
