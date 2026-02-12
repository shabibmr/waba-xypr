const Joi = require('joi');

const messageSchemas = {
    sendMessage: Joi.object({
        to: Joi.string().pattern(/^\d+$/).required().messages({
            'string.pattern.base': 'Recipient must be a numeric phone number without symbols'
        }),
        text: Joi.string().max(4096).required()
    }),

    sendTemplate: Joi.object({
        to: Joi.string().pattern(/^\d+$/).required(),
        template_name: Joi.string().required(),
        parameters: Joi.array().items(
            Joi.object({
                type: Joi.string().valid('text', 'currency', 'date_time', 'image', 'document', 'video').required(),
                text: Joi.string().when('type', { is: 'text', then: Joi.required() }),
                currency: Joi.object().when('type', { is: 'currency', then: Joi.required() }),
                date_time: Joi.object().when('type', { is: 'date_time', then: Joi.required() }),
                image: Joi.object().when('type', { is: 'image', then: Joi.required() }),
                document: Joi.object().when('type', { is: 'document', then: Joi.required() }),
                video: Joi.object().when('type', { is: 'video', then: Joi.required() })
            })
        ).optional().default([])
    })
};

module.exports = messageSchemas;
