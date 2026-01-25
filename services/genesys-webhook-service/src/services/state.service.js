const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');

class StateService {
    async updateConversationStatus(tenantId, conversationId, status) {
        try {
            await axios.patch(
                `${config.services.state.url}/state/conversation/${conversationId}`,
                { status },
                {
                    headers: {
                        'X-Tenant-ID': tenantId
                    }
                }
            );
            logger.info('Updated conversation status', { tenantId, conversationId, status });
            return true;
        } catch (error) {
            logger.error('Failed to update conversation status', {
                tenantId,
                conversationId,
                error: error.message
            });
            return false;
        }
    }
}

module.exports = new StateService();
