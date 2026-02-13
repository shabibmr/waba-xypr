/**
 * Test Fixtures for Outbound Transformer
 * Type-safe test data for unit and integration tests
 */

import { InputMessage, OutputMessage, DlqMessage } from '../../src/types/messages';

// Valid InputMessage samples

export const validTextMessage: InputMessage = {
    internalId: '123e4567-e89b-42d3-a456-426614174000',
    tenantId: 'tenant-123',
    conversationId: 'conv-456',
    genesysId: 'genesys-789',
    waId: '1234567890',
    phoneNumberId: '987654321',
    timestamp: 1707782400,
    type: 'message',
    payload: {
        text: 'Hello, this is a test message',
    },
};

export const validImageMessage: InputMessage = {
    internalId: '223e4567-e89b-42d3-a456-426614174001',
    tenantId: 'tenant-123',
    conversationId: 'conv-456',
    genesysId: 'genesys-790',
    waId: '1234567890',
    phoneNumberId: '987654321',
    timestamp: 1707782400,
    type: 'message',
    payload: {
        text: 'Check out this image',
        media: {
            url: 'https://example.com/image.jpg',
            mime_type: 'image/jpeg',
            filename: 'image.jpg',
        },
    },
};

export const validVideoMessage: InputMessage = {
    internalId: '323e4567-e89b-42d3-a456-426614174002',
    tenantId: 'tenant-123',
    conversationId: 'conv-456',
    genesysId: 'genesys-791',
    waId: '1234567890',
    phoneNumberId: '987654321',
    timestamp: 1707782400,
    type: 'message',
    payload: {
        text: 'Watch this video',
        media: {
            url: 'https://example.com/video.mp4',
            mime_type: 'video/mp4',
        },
    },
};

export const validDocumentMessage: InputMessage = {
    internalId: '423e4567-e89b-42d3-a456-426614174003',
    tenantId: 'tenant-123',
    conversationId: 'conv-456',
    genesysId: 'genesys-792',
    waId: '1234567890',
    phoneNumberId: '987654321',
    timestamp: 1707782400,
    type: 'message',
    payload: {
        media: {
            url: 'https://example.com/document.pdf',
            mime_type: 'application/pdf',
            filename: 'document.pdf',
        },
    },
};

export const validAudioMessage: InputMessage = {
    internalId: '523e4567-e89b-42d3-a456-426614174004',
    tenantId: 'tenant-123',
    conversationId: 'conv-456',
    genesysId: 'genesys-793',
    waId: '1234567890',
    phoneNumberId: '987654321',
    timestamp: 1707782400,
    type: 'message',
    payload: {
        media: {
            url: 'https://example.com/audio.mp3',
            mime_type: 'audio/mpeg',
        },
    },
};

export const validAudioWithTextMessage: InputMessage = {
    internalId: '623e4567-e89b-42d3-a456-426614174005',
    tenantId: 'tenant-123',
    conversationId: 'conv-456',
    genesysId: 'genesys-794',
    waId: '1234567890',
    phoneNumberId: '987654321',
    timestamp: 1707782400,
    type: 'message',
    payload: {
        text: 'Listen to this',
        media: {
            url: 'https://example.com/audio.mp3',
            mime_type: 'audio/mpeg',
        },
    },
};

// Invalid InputMessage samples for validation testing

export const invalidMessage_MissingInternalId: any = {
    tenantId: 'tenant-123',
    conversationId: 'conv-456',
    genesysId: 'genesys-789',
    waId: '1234567890',
    phoneNumberId: '987654321',
    timestamp: 1707782400,
    type: 'message',
    payload: { text: 'Test' },
};

export const invalidMessage_InvalidUUID: any = {
    internalId: 'not-a-valid-uuid',
    tenantId: 'tenant-123',
    conversationId: 'conv-456',
    genesysId: 'genesys-789',
    waId: '1234567890',
    phoneNumberId: '987654321',
    timestamp: 1707782400,
    type: 'message',
    payload: { text: 'Test' },
};

export const invalidMessage_InvalidWaId: any = {
    internalId: '123e4567-e89b-42d3-a456-426614174000',
    tenantId: 'tenant-123',
    conversationId: 'conv-456',
    genesysId: 'genesys-789',
    waId: '0123',
    phoneNumberId: '987654321',
    timestamp: 1707782400,
    type: 'message',
    payload: { text: 'Test' },
};

export const invalidMessage_NoPayload: any = {
    internalId: '123e4567-e89b-42d3-a456-426614174000',
    tenantId: 'tenant-123',
    conversationId: 'conv-456',
    genesysId: 'genesys-789',
    waId: '1234567890',
    phoneNumberId: '987654321',
    timestamp: 1707782400,
    type: 'message',
    payload: {},
};

export const invalidMessage_EmptyText: any = {
    internalId: '123e4567-e89b-42d3-a456-426614174000',
    tenantId: 'tenant-123',
    conversationId: 'conv-456',
    genesysId: 'genesys-789',
    waId: '1234567890',
    phoneNumberId: '987654321',
    timestamp: 1707782400,
    type: 'message',
    payload: { text: '   ' },
};

export const invalidMessage_TextTooLong: any = {
    internalId: '123e4567-e89b-42d3-a456-426614174000',
    tenantId: 'tenant-123',
    conversationId: 'conv-456',
    genesysId: 'genesys-789',
    waId: '1234567890',
    phoneNumberId: '987654321',
    timestamp: 1707782400,
    type: 'message',
    payload: { text: 'a'.repeat(5000) },
};

export const invalidMessage_MediaMissingUrl: any = {
    internalId: '123e4567-e89b-42d3-a456-426614174000',
    tenantId: 'tenant-123',
    conversationId: 'conv-456',
    genesysId: 'genesys-789',
    waId: '1234567890',
    phoneNumberId: '987654321',
    timestamp: 1707782400,
    type: 'message',
    payload: {
        media: {
            mime_type: 'image/jpeg',
        },
    },
};

// Expected OutputMessage samples

export const expectedTextOutput: OutputMessage = {
    metadata: {
        tenantId: 'tenant-123',
        phoneNumberId: '987654321',
        internalId: '123e4567-e89b-42d3-a456-426614174000',
        correlationId: 'genesys-789',
    },
    wabaPayload: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '1234567890',
        type: 'text',
        text: { body: 'Hello, this is a test message' },
    },
};

export const expectedImageOutput: OutputMessage = {
    metadata: {
        tenantId: 'tenant-123',
        phoneNumberId: '987654321',
        internalId: '223e4567-e89b-42d3-a456-426614174001',
        correlationId: 'genesys-790',
    },
    wabaPayload: {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: '1234567890',
        type: 'image',
        image: {
            link: 'https://example.com/image.jpg',
            caption: 'Check out this image',
        },
    },
};
