const Joi = require('joi');

const dashboardSchemas = {
    getMetrics: Joi.object({
        from: Joi.date().iso().required(),
        to: Joi.date().iso().min(Joi.ref('from')).required(),
        metric: Joi.string().valid('messages', 'conversations', 'response_time').default('conversations'),
        interval: Joi.string().valid('hour', 'day', 'week').default('day')
    })
};

module.exports = dashboardSchemas;
