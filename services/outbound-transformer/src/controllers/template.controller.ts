import { Request, Response, NextFunction } from 'express';
// @ts-ignore
import { getConversationMapping } from '../services/state.service';
import { dispatch } from '../services/dispatcher.service';
import crypto from 'crypto';

/**
 * Send template message endpoint handler
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {NextFunction} next - Express next function
 */
export async function sendTemplate(req: Request, res: Response, next: NextFunction) {
    try {
        const { conversationId, templateName, parameters, buttonParams } = req.body;

        // Get WhatsApp ID from conversation
        const { waId, phoneNumberId, tenantId } = await getConversationMapping(conversationId);

        // Construct OutputMessage format
        const internalId = crypto.randomUUID();
        
        const message = {
            metadata: {
                tenantId,
                phoneNumberId,
                internalId,
                correlationId: internalId
            },
            wabaPayload: {
                to: waId,
                type: 'template',
                template: {
                    name: templateName,
                    language: { code: 'en' },
                    components: parameters || []
                }
            }
        };

        if (buttonParams) {
            // Logic to add button params would go here
        }

        // Dispatch template message to outbound ready queue
        await dispatch(message as any);

        res.json({ success: true, messageId: internalId });
    } catch (error) {
        next(error);
    }
}
