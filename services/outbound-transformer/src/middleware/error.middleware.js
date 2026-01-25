/**
 * Global error handling middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request
 * @param {Object} res - Express response
 * @param {Function} next - Next middleware
 */
function errorHandler(err, req, res, next) {
    console.error('Error:', err.message);

    // Handle specific error types
    if (err.response) {
        // Axios error with response
        return res.status(err.response.status || 500).json({
            error: err.message,
            details: err.response.data
        });
    }

    // Generic error
    res.status(500).json({
        error: err.message || 'Internal server error'
    });
}

module.exports = {
    errorHandler
};
