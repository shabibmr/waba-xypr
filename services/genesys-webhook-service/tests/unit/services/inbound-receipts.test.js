const { describe, it, expect } = require('@jest/globals');

// Mock payloads
const inboundReceiptPublished = require('../../fixtures/inbound-receipt-published.json');
const inboundReceiptFailed = require('../../fixtures/inbound-receipt-failed.json');

describe('Genesys Handler Service - Inbound Receipts', () => {
    // Import the handler (we'll test the classification logic)
    const GenesysHandlerService = require('../../../dist/services/genesys-handler.service').default;

    describe('classifyEvent', () => {
        it('should classify Inbound Receipt (Published) as inbound_receipt', () => {
            const result = GenesysHandlerService.classifyEvent(inboundReceiptPublished);
            expect(result).toBe('inbound_receipt');
        });

        it('should classify Inbound Receipt (Failed) as inbound_receipt', () => {
            const result = GenesysHandlerService.classifyEvent(inboundReceiptFailed);
            expect(result).toBe('inbound_receipt');
        });

        it('should skip Inbound non-Receipt events', () => {
            const inboundText = {
                type: 'Text',
                direction: 'Inbound',
                text: 'Hello from customer'
            };
            const result = GenesysHandlerService.classifyEvent(inboundText);
            expect(result).toBe('skip');
        });
    });

    describe('Payload Structure Validation', () => {
        it('should have required fields for Published receipt', () => {
            expect(inboundReceiptPublished).toHaveProperty('id');
            expect(inboundReceiptPublished).toHaveProperty('status', 'Published');
            expect(inboundReceiptPublished).toHaveProperty('direction', 'Inbound');
            expect(inboundReceiptPublished).toHaveProperty('type', 'Receipt');
            expect(inboundReceiptPublished).toHaveProperty('isFinalReceipt', true);
        });

        it('should have required fields and reasons for Failed receipt', () => {
            expect(inboundReceiptFailed).toHaveProperty('id');
            expect(inboundReceiptFailed).toHaveProperty('status', 'Failed');
            expect(inboundReceiptFailed).toHaveProperty('direction', 'Inbound');
            expect(inboundReceiptFailed).toHaveProperty('type', 'Receipt');
            expect(inboundReceiptFailed).toHaveProperty('reasons');
            expect(Array.isArray(inboundReceiptFailed.reasons)).toBe(true);
            expect(inboundReceiptFailed.reasons[0]).toHaveProperty('code');
            expect(inboundReceiptFailed.reasons[0]).toHaveProperty('message');
        });
    });
});
