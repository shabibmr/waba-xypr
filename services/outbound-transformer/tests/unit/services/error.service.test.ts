/**
 * Unit Tests for Error Service
 * Tests error classification, retry logic, and DLQ message building
 */

import {
    classifyError,
    calculateBackoff,
    getRetryCount,
    buildDlqMessage,
} from '../../../src/services/error.service';
import { validTextMessage } from '../../fixtures/messages';

describe('Error Service', () => {
    describe('classifyError', () => {
        describe('Validation Errors (Non-retryable)', () => {
            it('should classify validation error as non-retryable', () => {
                const error = new Error('Validation failed: invalid field');
                error.name = 'ValidationError';

                const result = classifyError(error);
                expect(result.category).toBe('validation');
                expect(result.retryable).toBe(false);
            });

            it('should classify invalid message as non-retryable', () => {
                const error = new Error('invalid waId format');
                const result = classifyError(error);
                expect(result.category).toBe('validation');
                expect(result.retryable).toBe(false);
            });

            it('should classify unsupported mime type as non-retryable', () => {
                const error = new Error('Unsupported mime type: application/xyz');
                const result = classifyError(error);
                expect(result.category).toBe('validation');
                expect(result.retryable).toBe(false);
            });

            it('should classify missing required field as non-retryable', () => {
                const error = new Error('missing required field: tenantId');
                const result = classifyError(error);
                expect(result.category).toBe('validation');
                expect(result.retryable).toBe(false);
            });
        });

        describe('Configuration Errors (Non-retryable)', () => {
            it('should classify configuration error as non-retryable', () => {
                const error = new Error('Service not configured');
                const result = classifyError(error);
                expect(result.category).toBe('configuration');
                expect(result.retryable).toBe(false);
            });

            it('should classify missing config as non-retryable', () => {
                const error = new Error('missing config: API_KEY');
                const result = classifyError(error);
                expect(result.category).toBe('configuration');
                expect(result.retryable).toBe(false);
            });
        });

        describe('Transient Errors (Retryable)', () => {
            it('should classify timeout as retryable', () => {
                const error = new Error('Request timeout after 5000ms');
                const result = classifyError(error);
                expect(result.category).toBe('transient');
                expect(result.retryable).toBe(true);
            });

            it('should classify ECONNREFUSED as retryable', () => {
                const error = new Error('connect ECONNREFUSED 127.0.0.1:3000');
                const result = classifyError(error);
                expect(result.category).toBe('transient');
                expect(result.retryable).toBe(true);
            });

            it('should classify RabbitMQ error as retryable', () => {
                const error = new Error('RabbitMQ publish failed - channel backpressure');
                const result = classifyError(error);
                expect(result.category).toBe('transient');
                expect(result.retryable).toBe(true);
            });

            it('should classify Redis error as retryable', () => {
                const error = new Error('Redis connection lost');
                const result = classifyError(error);
                expect(result.category).toBe('transient');
                expect(result.retryable).toBe(true);
            });

            it('should classify network error as retryable', () => {
                const error = new Error('network error: ENOTFOUND');
                const result = classifyError(error);
                expect(result.category).toBe('transient');
                expect(result.retryable).toBe(true);
            });

            it('should classify 5xx server error as retryable', () => {
                const error = new Error('HTTP 503 Service Unavailable');
                const result = classifyError(error);
                expect(result.category).toBe('transient');
                expect(result.retryable).toBe(true);
            });
        });

        describe('Unknown Errors (Default to Retryable)', () => {
            it('should classify unknown error as retryable', () => {
                const error = new Error('Some unexpected error');
                const result = classifyError(error);
                expect(result.category).toBe('transient');
                expect(result.retryable).toBe(true);
            });
        });
    });

    describe('calculateBackoff', () => {
        it('should calculate exponential backoff for attempt 0', () => {
            const backoff = calculateBackoff(0);
            // Base: 2^1 * 1000 = 2000ms, with ±20% jitter
            expect(backoff).toBeGreaterThanOrEqual(1600);
            expect(backoff).toBeLessThanOrEqual(2400);
        });

        it('should calculate exponential backoff for attempt 1', () => {
            const backoff = calculateBackoff(1);
            // Base: 2^2 * 1000 = 4000ms, with ±20% jitter
            expect(backoff).toBeGreaterThanOrEqual(3200);
            expect(backoff).toBeLessThanOrEqual(4800);
        });

        it('should calculate exponential backoff for attempt 2', () => {
            const backoff = calculateBackoff(2);
            // Base: 2^3 * 1000 = 8000ms, with ±20% jitter
            expect(backoff).toBeGreaterThanOrEqual(6400);
            expect(backoff).toBeLessThanOrEqual(9600);
        });

        it('should return integer values', () => {
            const backoff = calculateBackoff(0);
            expect(Number.isInteger(backoff)).toBe(true);
        });
    });

    describe('getRetryCount', () => {
        it('should return retry count from message headers', () => {
            const msg = {
                properties: {
                    headers: {
                        'x-retry-count': 2,
                    },
                },
            };

            const result = getRetryCount(msg);
            expect(result).toBe(2);
        });

        it('should return 0 if no retry count header', () => {
            const msg = {
                properties: {
                    headers: {},
                },
            };

            const result = getRetryCount(msg);
            expect(result).toBe(0);
        });

        it('should return 0 if no headers', () => {
            const msg = {
                properties: {},
            };

            const result = getRetryCount(msg);
            expect(result).toBe(0);
        });

        it('should return 0 if no properties', () => {
            const msg = {};

            const result = getRetryCount(msg);
            expect(result).toBe(0);
        });
    });

    describe('buildDlqMessage', () => {
        const mockError = new Error('Test error message');
        mockError.stack = 'Error: Test error message\n    at test.js:10:15';

        it('should build DLQ message with all required fields', () => {
            const retryCount = 3;
            const firstAttemptTimestamp = 1707782400;

            const result = buildDlqMessage(validTextMessage, mockError, retryCount, firstAttemptTimestamp);

            expect(result.original_message).toEqual(validTextMessage);
            expect(result.error_details.error_type).toBe('Error');
            expect(result.error_details.error_message).toBe('Test error message');
            expect(result.error_details.stack_trace).toContain('Error: Test error message');
            expect(result.error_details.retry_count).toBe(3);
            expect(result.error_details.first_attempt_timestamp).toBe(1707782400);
            expect(result.error_details.last_attempt_timestamp).toBeGreaterThan(0);
            expect(result.metadata.tenant_id).toBe(validTextMessage.tenantId);
            expect(result.metadata.internal_id).toBe(validTextMessage.internalId);
            expect(result.metadata.service).toBe('outbound-transformer');
            expect(result.metadata.dlq_timestamp).toBeGreaterThan(0);
        });

        it('should use current timestamp if firstAttemptTimestamp not provided', () => {
            const retryCount = 1;

            const result = buildDlqMessage(validTextMessage, mockError, retryCount);

            expect(result.error_details.first_attempt_timestamp).toBeGreaterThan(0);
            expect(result.error_details.last_attempt_timestamp).toBeGreaterThan(0);
        });

        it('should handle message without tenantId gracefully', () => {
            const invalidMessage = { someField: 'value' };

            const result = buildDlqMessage(invalidMessage, mockError, 1);

            expect(result.metadata.tenant_id).toBe('unknown');
            expect(result.metadata.internal_id).toBe('unknown');
        });

        it('should include error stack trace', () => {
            const result = buildDlqMessage(validTextMessage, mockError, 1);

            expect(result.error_details.stack_trace).toBeDefined();
            expect(result.error_details.stack_trace).toContain('test.js:10:15');
        });
    });
});
