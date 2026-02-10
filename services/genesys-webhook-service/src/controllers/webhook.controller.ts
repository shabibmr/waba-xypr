import { Request, Response, NextFunction } from 'express';
// @ts-ignore
import genesysHandlerService from '../services/genesys-handler.service';
// @ts-ignore
import logger from '../utils/logger';

class WebhookController {

    /**
     * Unified webhook handler - routes based on eventType
     * Genesys Open Messaging sends all events to a single URL
     */
    handleWebhook = async (req: Request, res: Response, next: NextFunction) => {
        // Respond immediately to Genesys
        res.sendStatus(200);

        try {
            const { eventType } = req.body;
            logger.info('Genesys webhook received', { eventType });

            // Route based on eventType
            const messageEvents = ['agent.message', 'message.sent', 'Message'];
            if (messageEvents.includes(eventType) || req.body.message?.text) {
                await genesysHandlerService.processOutboundMessage(req.body);
            } else {
                await genesysHandlerService.processEvent(req.body);
            }
        } catch (error) {
            logger.error('Error handling webhook', error);
        }
    }

    handleOutboundMessage = async (req: Request, res: Response, next: NextFunction) => {
        // Respond immediately to Genesys
        res.sendStatus(200);

        try {
            await genesysHandlerService.processOutboundMessage(req.body);
        } catch (error) {
            logger.error('Error handling outbound message', error);
            // We don't call next(error) because we've already sent the response
        }
    }

    handleEvents = async (req: Request, res: Response, next: NextFunction) => {
        res.sendStatus(200);

        try {
            await genesysHandlerService.processEvent(req.body);
        } catch (error) {
            logger.error('Error handling event', error);
        }
    }

    handleAgentState = async (req: Request, res: Response, next: NextFunction) => {
        res.sendStatus(200);

        try {
            await genesysHandlerService.processAgentState(req.body);
        } catch (error) {
            logger.error('Error handling agent state', error);
        }
    }

    handleTest = async (req: Request, res: Response, next: NextFunction) => {
        logger.info('Test webhook received', { body: req.body });
        res.json({ success: true, received: req.body });
    }
}

export default new WebhookController();
