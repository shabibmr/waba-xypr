const Joi = require('joi');

const conversationSchemas = {
    listConversations: Joi.object({
        limit: Joi.number().integer().min(1).max(100).default(20),
        offset: Joi.number().integer().min(0).default(0),
        status: Joi.string().valid('open', 'closed', 'all').optional()
    }),

    getMessages: Joi.object({
        limit: Joi.number().integer().min(1).max(100).default(50),
        offset: Joi.number().integer().min(0).default(0)
    }),

    transfer: Joi.object({
        to_user_id: Joi.string().uuid().required()
    })
};

module.exports = conversationSchemas;
