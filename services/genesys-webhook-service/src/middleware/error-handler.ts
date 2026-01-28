import { Request, Response, NextFunction } from 'express';
// @ts-ignore
import logger from '../utils/logger';

function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });

    if (res.headersSent) {
        return next(err);
    }

    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal Server Error',
            status: err.status || 500
        }
    });
}

export default errorHandler;
