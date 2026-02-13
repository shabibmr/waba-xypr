/**
 * Error Classification and DLQ Service
 * Per FRD Section 6.1, 6.2
 */

import { ClassifiedError, DlqMessage, ErrorCategory } from '../types/messages';
import config from '../config';

/**
 * Classify an error as retryable or permanent
 */
export function classifyError(error: Error): ClassifiedError {
  const message = error.message.toLowerCase();

  // Validation / Client errors - not retryable
  if (
    error.name === 'ValidationError' ||
    message.includes('validation') ||
    message.includes('invalid') ||
    message.includes('unsupported mime') ||
    message.includes('missing required') ||
    message.includes('must be') ||
    message.includes('bad request')
  ) {
    return { category: 'validation', retryable: false };
  }

  // Configuration errors - not retryable
  if (
    message.includes('not configured') ||
    message.includes('missing config') ||
    message.includes('configuration')
  ) {
    return { category: 'configuration', retryable: false };
  }

  // Transient errors - retryable
  if (
    message.includes('timeout') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('enotfound') ||
    message.includes('redis') ||
    message.includes('rabbitmq') ||
    message.includes('5xx') ||
    message.includes('service unavailable') ||
    message.includes('network') ||
    message.includes('epipe') ||
    message.includes('publish failed')
  ) {
    return { category: 'transient', retryable: true };
  }

  // Default: treat unknown errors as transient (retryable)
  return { category: 'transient', retryable: true };
}

/**
 * Calculate exponential backoff with ±20% jitter
 * @param attempt - Current retry attempt (0-based)
 * @returns Delay in milliseconds
 */
export function calculateBackoff(attempt: number): number {
  const baseDelay = Math.pow(2, attempt + 1) * 1000; // 2s, 4s, 8s
  const jitter = baseDelay * (Math.random() * 0.4 - 0.2); // ±20%
  return Math.floor(baseDelay + jitter);
}

/**
 * Get retry count from RabbitMQ message headers
 */
export function getRetryCount(msg: { properties?: { headers?: Record<string, unknown> } }): number {
  return (msg?.properties?.headers?.['x-retry-count'] as number) || 0;
}

/**
 * Build a DLQ message with full error context
 */
export function buildDlqMessage(
  originalMessage: unknown,
  error: Error,
  retryCount: number,
  firstAttemptTimestamp?: number
): DlqMessage {
  const now = Math.floor(Date.now() / 1000);
  const parsedOriginal = originalMessage as Record<string, unknown>;

  return {
    original_message: originalMessage,
    error_details: {
      error_type: error.constructor?.name || 'Error',
      error_message: error.message,
      stack_trace: error.stack,
      retry_count: retryCount,
      first_attempt_timestamp: firstAttemptTimestamp || now,
      last_attempt_timestamp: now,
    },
    metadata: {
      tenant_id: (parsedOriginal?.tenantId as string) || 'unknown',
      internal_id: (parsedOriginal?.internalId as string) || 'unknown',
      dlq_timestamp: now,
      service: 'outbound-transformer',
      service_version: config.serviceVersion,
    },
  };
}
