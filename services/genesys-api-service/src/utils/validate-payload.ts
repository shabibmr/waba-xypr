/**
 * Inbound payload validation (T03)
 * Validates the inbound-processed queue message against FRD Section 5.1 schema rules.
 */

import { InboundMessage } from '../types/inbound-message';

export type ValidationResult =
    | { valid: true; data: InboundMessage }
    | { valid: false; reason: string };

/**
 * Validate an inbound queue message payload against the FRD schema.
 * Returns a typed result — never throws — allowing the consumer to decide the error action.
 */
export function validateInboundPayload(payload: unknown): ValidationResult {
    if (!payload || typeof payload !== 'object') {
        return { valid: false, reason: 'Payload must be a non-null object' };
    }

    const p = payload as Record<string, any>;

    // --- metadata section ---
    if (!p.metadata || typeof p.metadata !== 'object') {
        return { valid: false, reason: 'Missing required field: metadata' };
    }

    if (!p.metadata.tenantId || typeof p.metadata.tenantId !== 'string') {
        return { valid: false, reason: 'Missing or invalid metadata.tenantId' };
    }

    if (!p.metadata.whatsapp_message_id || typeof p.metadata.whatsapp_message_id !== 'string') {
        return { valid: false, reason: 'Missing or invalid metadata.whatsapp_message_id' };
    }

    if (!p.metadata.correlationId || typeof p.metadata.correlationId !== 'string') {
        return { valid: false, reason: 'Missing or invalid metadata.correlationId' };
    }

    // --- genesysPayload section ---
    if (!p.genesysPayload || typeof p.genesysPayload !== 'object') {
        return { valid: false, reason: 'Missing required field: genesysPayload' };
    }

    if (!p.genesysPayload.id || typeof p.genesysPayload.id !== 'string') {
        return { valid: false, reason: 'Missing or invalid genesysPayload.id' };
    }

    if (p.genesysPayload.direction !== 'Inbound') {
        return {
            valid: false,
            reason: `Invalid genesysPayload.direction: "${p.genesysPayload.direction}" (must be "Inbound")`
        };
    }

    if (!p.genesysPayload.channel || typeof p.genesysPayload.channel !== 'object') {
        return { valid: false, reason: 'Missing required field: genesysPayload.channel' };
    }

    if (p.genesysPayload.type === 'Text' && !p.genesysPayload.text) {
        return { valid: false, reason: 'genesysPayload.text is required for Text message type' };
    }

    return { valid: true, data: payload as InboundMessage };
}
