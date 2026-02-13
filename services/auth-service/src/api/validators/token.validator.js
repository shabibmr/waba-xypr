const Joi = require('joi');

const tokenRequestSchema = Joi.object({
  tenantId:      Joi.string().required().min(1).max(200),
  type:          Joi.string().valid('genesys', 'whatsapp').required(),
  forceRefresh:  Joi.boolean().optional().default(false),
  correlationId: Joi.string().max(100).optional(),
});

module.exports = { tokenRequestSchema };
