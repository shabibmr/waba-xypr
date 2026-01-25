const { GenesysUser } = require('../models/Agent');

/**
 * Get tenant's WhatsApp connection status
 * (WhatsApp is configured at organization level, not individual user level)
 */
async function getWhatsAppStatus(req, res, next) {
    try {
        const userId = req.userId;

        const whatsappConfig = await GenesysUser.getTenantWhatsAppConfig(userId);

        if (!whatsappConfig || !whatsappConfig.waba_id) {
            return res.json({
                connected: false,
                message: 'WhatsApp not configured for your organization. Please contact your administrator.'
            });
        }

        res.json({
            connected: true,
            waba_id: whatsappConfig.waba_id,
            phone_number_id: whatsappConfig.phone_number_id,
            phone_number: whatsappConfig.display_phone_number,
            organization_name: whatsappConfig.tenant_name,
            created_at: whatsappConfig.created_at,
            note: 'This WhatsApp account is shared by all users in your organization.'
        });
    } catch (error) {
        next(error);
    }
}

module.exports = {
    getWhatsAppStatus
};
