/**
 * Error handler middleware
 * Centralized error handling with consistent formatting
 */

import { Request, Response, NextFunction } from 'express';
// @ts-ignore
import logger from '../utils/logger';

/**
 * Error handling middleware
 */
function errorHandler(err: any, req: any, res: Response, next: NextFunction) {
    const tenantId = req.tenant?.id || null;

    // Log the error
    logger.error(tenantId, 'Error occurred:', err.response?.data || err.message);

    // Determine status code
    const statusCode = err.response?.status || err.statusCode || 500;

    // Send error response
    res.status(statusCode).json({
        error: err.message || 'Internal server error',
        details: err.response?.data || undefined,
        tenantId
    });
}

export default errorHandler;
