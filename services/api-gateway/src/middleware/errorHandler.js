// Global error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error('Gateway error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        requestId: req.headers['x-request-id']
    });
};

module.exports = errorHandler;
