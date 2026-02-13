import { Request, Response, NextFunction } from 'express';
// @ts-ignore
import genesysHandlerService from '../services/genesys-handler.service';
// @ts-ignore
import logger from '../utils/logger';

const ECHO_PREFIXES = ['mw-', 'middleware-', 'injected-'];

class WebhookController {

    /**
     * Main webhook handler.
     *
     * 05-A: Validation (tenant lookup + signature) already done by middleware BEFORE this runs.
     *       HealthCheck and echo are handled here synchronously, then 200 is sent,
     *       then actual processing happens async.
     * 02-B: HealthCheck handled immediately.
     * 02-C/D: Echo detection filters middleware-injected messages.
     */
    handleWebhook = async (req: any, res: Response, next: NextFunction) => {
        const body = req.body;
        const tenantId = req.tenantId;

        // 02-B: HealthCheck — respond immediately, no processing needed
        if (body.type === 'HealthCheck') {
            logger.info('Genesys HealthCheck received', { tenantId });
            return res.json({ status: 'healthy' });
        }

        // 02-C/D: Echo detection — filter messages injected by this middleware
        const messageId: string = body.channel?.messageId || '';
        if (ECHO_PREFIXES.some(p => messageId.startsWith(p))) {
            logger.info('Echo event filtered', { tenantId, messageId });
            return res.json({ echo_filtered: true });
        }

        // 05-A: Validation is done. Respond 200 now, then process async.
        res.json({ status: 'accepted' });

        genesysHandlerService.processWebhookEvent(body, tenantId).catch((err: any) => {
            logger.error('Async webhook processing error', { tenantId, error: err.message });
        });
    }

    handleTest = async (req: Request, res: Response, next: NextFunction) => {
        logger.info('Test webhook received', { body: req.body });
        res.json({ success: true, received: req.body });
    }
}

export default new WebhookController();
