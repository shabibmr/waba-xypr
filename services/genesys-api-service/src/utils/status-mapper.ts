/**
 * Status mapper utility
 * Maps WhatsApp status values to Genesys status values
 */

/**
 * Map WhatsApp status to Genesys status
 * @param {string} whatsappStatus - WhatsApp status (sent, delivered, read, failed)
 * @returns {string} Genesys status
 */
export function mapStatusToGenesys(whatsappStatus: string): string {
    const statusMap: Record<string, string> = {
        'sent': 'Sent',
        'delivered': 'Delivered',
        'read': 'Read',
        'failed': 'Failed'
    };
    return statusMap[whatsappStatus] || 'Unknown';
}
