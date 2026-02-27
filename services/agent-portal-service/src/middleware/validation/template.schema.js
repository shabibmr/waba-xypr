const Joi = require('joi');

const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
const STATUSES = ['APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED'];
const HEADER_TYPES = ['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'];
const BUTTON_TYPES = ['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE', 'ONE_TAP'];

const componentSchema = Joi.object({
    type: Joi.string().valid('HEADER', 'BODY', 'FOOTER', 'BUTTONS', 'CAROUSEL').required(),
    format: Joi.string().valid(...HEADER_TYPES).when('type', { is: 'HEADER', then: Joi.optional() }),
    text: Joi.string().max(1024).optional(),
    example: Joi.object().optional(),
    buttons: Joi.array().items(Joi.object({
        type: Joi.string().valid(...BUTTON_TYPES).required(),
        text: Joi.string().max(25).optional(),
        url: Joi.string().uri().optional(),
        phone_number: Joi.string().optional(),
        example: Joi.alternatives().try(Joi.string(), Joi.array()).optional()
    })).max(10).optional(),
    cards: Joi.array().max(10).optional()
}).unknown(true);

const templateSchemas = {
    list: Joi.object({
        category: Joi.string().valid(...CATEGORIES).optional(),
        status: Joi.string().valid(...STATUSES).optional(),
        search: Joi.string().max(256).optional(),
        language: Joi.string().max(16).optional(),
        limit: Joi.number().integer().min(1).max(100).default(50),
        offset: Joi.number().integer().min(0).default(0)
    }),

    create: Joi.object({
        name: Joi.string().pattern(/^[a-z0-9_]{1,512}$/).required()
            .messages({ 'string.pattern.base': 'Template name must contain only lowercase letters, numbers, and underscores' }),
        category: Joi.string().valid(...CATEGORIES).required(),
        language: Joi.string().max(16).required(),
        components: Joi.array().items(componentSchema).min(1).required(),
        sampleValues: Joi.object().optional().default({})
    }),

    update: Joi.object({
        name: Joi.string().pattern(/^[a-z0-9_]{1,512}$/).optional(),
        category: Joi.string().valid(...CATEGORIES).optional(),
        language: Joi.string().max(16).optional(),
        components: Joi.array().items(componentSchema).min(1).optional(),
        sampleValues: Joi.object().optional()
    }).min(1),

    duplicate: Joi.object({
        name: Joi.string().pattern(/^[a-z0-9_]{1,512}$/).optional(),
        language: Joi.string().max(16).optional()
    }).or('name', 'language')
};

module.exports = templateSchemas;
