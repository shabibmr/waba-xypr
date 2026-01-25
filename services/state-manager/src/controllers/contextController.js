const contextService = require('../services/contextService');

class ContextController {
    async updateContext(req, res) {
        try {
            const { conversationId } = req.params;
            const { context } = req.body;
            await contextService.updateContext(conversationId, context);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getContext(req, res) {
        try {
            const { conversationId } = req.params;
            const context = await contextService.getContext(conversationId);
            res.json({ context });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new ContextController();
