import { MessageStatus, MessageDirection, ConversationStatus } from '../../src/types';

export const fixtures = {
    inboundMessage: {
        wa_id: '919876543210',
        wamid: 'wamid.test_abc123',
        contact_name: 'Test User',
        phone_number_id: '12345',
        display_phone_number: '+91 98765 43210',
        timestamp: '2026-02-12T06:00:00Z',
        message_text: 'Hello from WhatsApp',
        media_url: undefined as string | undefined,
        tenantId: 'test-tenant',
    },

    outboundMessage: {
        conversation_id: 'conv-abc-123',
        genesys_message_id: 'genesys_msg_789',
        message_text: 'Hello from Genesys',
        media_url: undefined as string | undefined,
        tenantId: 'test-tenant',
    },

    statusUpdate: {
        wamid: 'wamid.test_abc123',
        status: MessageStatus.DELIVERED,
        timestamp: '2026-02-12T06:02:00Z',
        tenantId: 'test-tenant',
    },

    mapping: {
        id: 'map_123',
        wa_id: '919876543210',
        conversation_id: 'conv-abc-123',
        communication_id: 'comm-xyz-456',
        contact_name: 'Test User',
        phone_number_id: '12345',
        display_phone_number: '+91 98765 43210',
        status: ConversationStatus.ACTIVE,
        last_activity_at: new Date('2026-02-12T06:00:00Z'),
        last_message_id: 'wamid.test_abc123',
        created_at: new Date('2026-02-12T06:00:00Z'),
        updated_at: new Date('2026-02-12T06:00:00Z'),
        metadata: undefined,
    },

    message: {
        id: 'msg_123',
        mapping_id: 'map_123',
        wamid: 'wamid.test_abc123',
        genesys_message_id: null,
        direction: MessageDirection.INBOUND,
        status: MessageStatus.RECEIVED,
        media_url: null,
        created_at: new Date('2026-02-12T06:00:00Z'),
        updated_at: new Date('2026-02-12T06:00:00Z'),
        delivered_at: null,
    },
};
