/**
 * Status mapper utility
 * Maps WhatsApp status values to Genesys status values
 */

/**
 * Map WhatsApp status to Genesys status
 * @param {string} whatsappStatus - WhatsApp status (sent, delivered, read, failed)
 * @returns {string} Genesys status
 */
function mapStatusToGenesys(whatsappStatus) {
    const statusMap = {
        'sent': 'Sent',
        'delivered': 'Delivered',
        'read': 'Read',
        'failed': 'Failed'
    };
    return statusMap[whatsappStatus] || 'Unknown';
}

module.exports = {
    mapStatusToGenesys
};
