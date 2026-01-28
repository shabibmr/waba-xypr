import axios from 'axios';
// @ts-ignore
import config from '../config/config';
// @ts-ignore
import logger from '../utils/logger';

class StateService {
    async updateConversationStatus(tenantId: string, conversationId: string, status: string) {
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
        } catch (error: any) {
            logger.error('Failed to update conversation status', {
                tenantId,
                conversationId,
                error: error.message
            });
            return false;
        }
    }
}

export default new StateService();
