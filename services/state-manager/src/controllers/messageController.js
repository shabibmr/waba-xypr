const messageService = require('../services/messageService');

class MessageController {
    async track(req, res) {
        try {
            await messageService.trackMessage(req.body);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async updateStatus(req, res) {
        try {
            const { messageId } = req.params;
            const { status } = req.body;
            await messageService.updateStatus(messageId, status);
            res.json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new MessageController();
