import messageController from '../../../src/controllers/messageController';
import messageService from '../../../src/services/messageService';

// Mock explicit require of mappingService
jest.mock('../../../src/services/mappingService', () => ({
    __esModule: true,
    default: {
        getMappingByConversationId: jest.fn()
    }
}));

import mappingService from '../../../src/services/mappingService';

jest.mock('../../../src/services/messageService');

describe('MessageController', () => {
    let req: any;
    let res: any;

    beforeEach(() => {
        req = {
            params: {},
            query: {},
            body: {},
            headers: {}
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        jest.clearAllMocks();
    });

    describe('getMessagesByConversationId', () => {
        it('should return 400 if tenantId is missing', async () => {
            req.params.conversationId = 'conv_123';

            await messageController.getMessagesByConversationId(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Tenant ID is required' });
        });

        it('should return 404 if conversation not found', async () => {
            req.params.conversationId = 'conv_123';
            req.headers['x-tenant-id'] = 'tenant-1';
            (mappingService.getMappingByConversationId as jest.Mock).mockResolvedValue(null);

            await messageController.getMessagesByConversationId(req, res);

            expect(mappingService.getMappingByConversationId).toHaveBeenCalledWith('conv_123', 'tenant-1');
            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'Conversation not found' });
        });

        it('should return messages if conversation found', async () => {
            req.params.conversationId = 'conv_123';
            req.query = { limit: '10', offset: '5' };
            req.headers['x-tenant-id'] = 'tenant-1';

            (mappingService.getMappingByConversationId as jest.Mock).mockResolvedValue({ id: 'map_123' });

            const mockData = { messages: [], total: 0, limit: 10, offset: 5 };
            (messageService.getMessagesByMappingId as jest.Mock).mockResolvedValue(mockData);

            await messageController.getMessagesByConversationId(req, res);

            expect(mappingService.getMappingByConversationId).toHaveBeenCalledWith('conv_123', 'tenant-1');
            expect(messageService.getMessagesByMappingId).toHaveBeenCalledWith('map_123', 10, 5, 'tenant-1');
            expect(res.json).toHaveBeenCalledWith({
                ...mockData,
                tenant_id: 'tenant-1',
                integrationId: null
            });
        });
    });
});
