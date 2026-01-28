import { Request, Response, NextFunction } from 'express';

/**
 * Global error handling middleware
 * @param {Error} err - Error object
 * @param {Request} req - Express request
 * @param {Response} res - Express response
 * @param {NextFunction} next - Next middleware
 */
export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
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
