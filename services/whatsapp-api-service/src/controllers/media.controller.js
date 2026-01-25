/**
 * Media Controller
 * Handles media retrieval and download
 */
const whatsappService = require('../services/whatsapp.service');
const tenantService = require('../services/tenant.service');
const Logger = require('../utils/logger');

class MediaController {
    async getMediaUrl(req, res, next) {
        try {
            const { mediaId } = req.params;
            const tenantId = req.tenant.id;

            const response = await whatsappService.getMediaUrl(tenantId, mediaId);

            res.json({
                mediaId,
                url: response.url,
                mimeType: response.mime_type,
                size: response.file_size,
                tenantId
            });
        } catch (error) {
            next(error);
        }
    }

    async downloadMedia(req, res, next) {
        try {
            const { mediaId } = req.params;
            const tenantId = req.tenant.id;

            // 1. Get credentials (needed for both calls)
            const credentials = await tenantService.getWhatsAppCredentials(tenantId);

            // 2. Get Media URL info
            const mediaInfo = await whatsappService.getMediaUrl(tenantId, mediaId);

            // 3. Download Media Stream
            const mediaResponse = await whatsappService.downloadMedia(
                tenantId,
                mediaInfo.url,
                credentials.accessToken
            );

            // 4. Pipe response
            res.setHeader('Content-Type', mediaInfo.mime_type);
            res.setHeader('Content-Disposition', `attachment; filename="${mediaId}"`);
            mediaResponse.data.pipe(res);

        } catch (error) {
            next(error);
        }
    }
}

module.exports = new MediaController();
