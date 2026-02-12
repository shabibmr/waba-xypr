const Joi = require('joi');
const AppError = require('../utils/AppError');
const ERROR_CODES = require('../utils/errorCodes');
const logger = require('../utils/logger');

/**
 * Generic validation middleware factory
 * @param {Joi.ObjectSchema} schema - Joi schema to validate against
 * @param {string} source - Request property to validate ('body', 'query', 'params')
 */
const validate = (schema, source = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[source], {
            abortEarly: false, // Return all errors
            stripUnknown: true, // Remove unknown fields
            allowUnknown: false // Don't allow unknown fields unless specified in schema
        });

        if (error) {
            const details = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));

            logger.warn('Validation failed', {
                path: req.path,
                method: req.method,
                source,
                details
            });

            // Map validation source to specific error code
            let errorCode = ERROR_CODES.VALIDATION_001;
            if (source === 'query') errorCode = ERROR_CODES.VALIDATION_002;
            if (source === 'params') errorCode = ERROR_CODES.VALIDATION_003;

            return next(new AppError('Validation failed', 400, errorCode, details));
        }

        // Replace request data with validated (and stripped) data
        req[source] = value;
        next();
    };
};

module.exports = validate;
