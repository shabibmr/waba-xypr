const Joi = require('joi');

const createOAuthClient = Joi.object({
    name: Joi.string().required().min(3).max(255),
    description: Joi.string().allow('').optional(),
    roleIds: Joi.array().items(Joi.string()).optional()
});

const provisionMessaging = Joi.object({
    name: Joi.string().required().min(3).max(255),
    webhookUrl: Joi.string().uri().required()
});

module.exports = {
    createOAuthClient,
    provisionMessaging
};
