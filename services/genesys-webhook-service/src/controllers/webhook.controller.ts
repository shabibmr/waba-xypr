import { Request, Response, NextFunction } from 'express';
// @ts-ignore
import genesysHandlerService from '../services/genesys-handler.service';
// @ts-ignore
import logger from '../utils/logger';

class WebhookController {

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
