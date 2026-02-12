let counter = 0;

/**
 * Generates a unique message ID for deduplication.
 * Uses timestamp + counter to avoid collisions.
 */
export function generateMessageId() {
    return `msg_${Date.now()}_${(++counter).toString(36)}`;
}
