const Joi = require('joi');

const onboardingSchemas = {
    step1: Joi.object({
        genesysClientId: Joi.string().required(),
        genesysClientSecret: Joi.string().required(),
        genesysRegion: Joi.string().required()
    }),

    step2: Joi.object({
        organizationName: Joi.string().required(),
        industry: Joi.string().required(),
        contactEmail: Joi.string().email().required()
    }),

    step3: Joi.object({
        wabaId: Joi.string().required(),
        phoneNumberId: Joi.string().required(),
        systemUserToken: Joi.string().required()
    }),

    step4: Joi.object({
        syncUsers: Joi.boolean().default(true)
    }),

    step5: Joi.object({
        webhookUrl: Joi.string().uri().optional(), // For confirm
        complete: Joi.boolean().valid(true).required()
    })
};

module.exports = onboardingSchemas;
