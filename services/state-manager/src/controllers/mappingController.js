const mappingService = require('../services/mappingService');

class MappingController {
    async createOrUpdate(req, res) {
        try {
            const { waId } = req.body;
            if (!waId) {
                return res.status(400).json({ error: 'waId is required' });
            }

            const result = await mappingService.createOrUpdateMapping(req.body);
            res.json(result);
        } catch (error) {
            console.error('Mapping error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async getByWaId(req, res) {
        try {
            const { waId } = req.params;
            const result = await mappingService.getMapping(waId);

            if (!result) {
                return res.status(404).json({ error: 'Mapping not found' });
            }

            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getByConversationId(req, res) {
        try {
            const { conversationId } = req.params;
            const result = await mappingService.getMappingByConversationId(conversationId);

            if (!result) {
                return res.status(404).json({ error: 'Mapping not found' });
            }

            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new MappingController();
