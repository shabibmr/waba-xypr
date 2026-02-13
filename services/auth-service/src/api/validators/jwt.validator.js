const Joi = require('joi');

const VALID_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-2', 'ca-central-1',
  'eu-west-1', 'eu-west-2', 'eu-central-1',
  'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2', 'ap-south-1',
];

const jwtValidationRequestSchema = Joi.object({
  token:  Joi.string().required().min(1),
  region: Joi.string().valid(...VALID_REGIONS).required(),
});

module.exports = { jwtValidationRequestSchema, VALID_REGIONS };
