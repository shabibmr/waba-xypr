const { ErrorCode } = require('../../models/errors');

function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        error: {
          code: ErrorCode.INVALID_REQUEST,
          message: `Validation failed: ${error.details.map(d => d.message).join('; ')}`,
        },
      });
    }

    req.body = value;
    next();
  };
}

module.exports = { validateBody };
