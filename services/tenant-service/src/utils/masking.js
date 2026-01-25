// Mask sensitive WhatsApp data
function maskWhatsAppConfig(config) {
    return {
        wabaId: config.waba_id,
        phoneNumberId: config.phone_number_id,
        accessToken: maskToken(config.access_token),
        businessId: config.business_id,
        displayPhoneNumber: config.display_phone_number,
        qualityRating: config.quality_rating,
        isActive: config.is_active,
        createdAt: config.created_at
    };
}

function maskToken(token) {
    if (!token || token.length < 8) return '****';
    return `****${token.slice(-4)}`;
}

module.exports = {
    maskWhatsAppConfig,
    maskToken
};
