import {
    MessageStatus,
    isValidStateTransition,
    MESSAGE_STATE_TRANSITIONS,
} from '../../../src/types';

describe('Message State Machine', () => {
    // ==================== Valid Transitions ====================

    describe('Valid Transitions', () => {
        const validCases: [MessageStatus, MessageStatus][] = [
            [MessageStatus.QUEUED, MessageStatus.SENT],
            [MessageStatus.QUEUED, MessageStatus.FAILED],
            [MessageStatus.SENT, MessageStatus.DELIVERED],
            [MessageStatus.SENT, MessageStatus.FAILED],
            [MessageStatus.DELIVERED, MessageStatus.READ],
            [MessageStatus.DELIVERED, MessageStatus.FAILED],
            [MessageStatus.RECEIVED, MessageStatus.PROCESSED],
            [MessageStatus.RECEIVED, MessageStatus.FAILED],
        ];

        test.each(validCases)('%s → %s should be valid', (from, to) => {
            expect(isValidStateTransition(from, to)).toBe(true);
        });
    });

    // ==================== Invalid Transitions ====================

    describe('Invalid Transitions', () => {
        const invalidCases: [MessageStatus, MessageStatus][] = [
            [MessageStatus.DELIVERED, MessageStatus.SENT],       // backward
            [MessageStatus.READ, MessageStatus.DELIVERED],       // backward
            [MessageStatus.QUEUED, MessageStatus.READ],          // skip steps
            [MessageStatus.QUEUED, MessageStatus.DELIVERED],     // skip steps
            [MessageStatus.FAILED, MessageStatus.DELIVERED],     // terminal
            [MessageStatus.FAILED, MessageStatus.SENT],          // terminal
            [MessageStatus.READ, MessageStatus.SENT],            // terminal backward
            [MessageStatus.PROCESSED, MessageStatus.RECEIVED],   // terminal backward
        ];

        test.each(invalidCases)('%s → %s should be invalid', (from, to) => {
            expect(isValidStateTransition(from, to)).toBe(false);
        });
    });

    // ==================== Idempotent Transitions ====================

    describe('Idempotent Transitions (same → same)', () => {
        const allStatuses = Object.values(MessageStatus);

        test.each(allStatuses)('%s → %s (same) should be valid', (status) => {
            expect(isValidStateTransition(status, status)).toBe(true);
        });
    });

    // ==================== Completeness ====================

    describe('Completeness Check', () => {
        it('should have transition rules for all statuses', () => {
            const allStatuses = Object.values(MessageStatus);

            allStatuses.forEach((status) => {
                expect(MESSAGE_STATE_TRANSITIONS[status]).toBeDefined();
                expect(Array.isArray(MESSAGE_STATE_TRANSITIONS[status])).toBe(true);
            });
        });

        it('terminal statuses should have no outgoing transitions', () => {
            const terminalStatuses = [
                MessageStatus.READ,
                MessageStatus.PROCESSED,
                MessageStatus.FAILED,
            ];

            terminalStatuses.forEach((status) => {
                expect(MESSAGE_STATE_TRANSITIONS[status]).toEqual([]);
            });
        });
    });
});
