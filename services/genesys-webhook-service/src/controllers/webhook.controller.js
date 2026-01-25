const genesysHandlerService = require('../services/genesys-handler.service');
const logger = require('../utils/logger');

class WebhookController {

    async handleOutboundMessage(req, res, next) {
        // Respond immediately to Genesys
        res.sendStatus(200);

        try {
            await genesysHandlerService.processOutboundMessage(req.body);
        } catch (error) {
            logger.error('Error handling outbound message', error);
            // We don't call next(error) because we've already sent the response
        }
    }

    async handleEvents(req, res, next) {
        res.sendStatus(200);

        try {
            await genesysHandlerService.processEvent(req.body);
        } catch (error) {
            logger.error('Error handling event', error);
        }
    }

    async handleAgentState(req, res, next) {
        res.sendStatus(200);

        try {
            await genesysHandlerService.processAgentState(req.body);
        } catch (error) {
            logger.error('Error handling agent state', error);
        }
    }

    async handleTest(req, res, next) {
        logger.info('Test webhook received', { body: req.body });
        res.json({ success: true, received: req.body });
    }
}

module.exports = new WebhookController();
