/**
 * Genesys Service
 * DEPRECATED: Replaced by Publisher Service (RabbitMQ)
 * This file can be safely removed once verification is complete.
 */

export async function sendMessage(
    genesysMessage: any,
    conversationId: string,
    isNew: boolean,
    tenantId: string
): Promise<any> {
    throw new Error('DEPRECATED: Use publisherService.publishToGenesys instead');
}
