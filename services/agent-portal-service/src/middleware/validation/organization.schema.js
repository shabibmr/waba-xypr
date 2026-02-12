const Joi = require('joi');

const organizationSchemas = {
    updateProfile: Joi.object({
        organizationName: Joi.string().min(2).max(100).optional(),
        industry: Joi.string().optional(),
        companySize: Joi.string().optional(),
        country: Joi.string().length(2).optional(), // ISO 2-char code
        timezone: Joi.string().optional()
    }),

    completeOnboarding: Joi.object({
        whatsappConfigured: Joi.boolean().required(),
        skippedWhatsApp: Joi.boolean().optional()
    })
};

module.exports = organizationSchemas;
