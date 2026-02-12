const Joi = require('joi');

const authSchemas = {
    refreshToken: Joi.object({
        refreshToken: Joi.string().required().messages({
            'any.required': 'Refresh token is required'
        })
    }),

    demoLogin: Joi.object({
        email: Joi.string().email().required(),
        tenantId: Joi.string().required(),
        name: Joi.string().optional()
    })
};

module.exports = authSchemas;
