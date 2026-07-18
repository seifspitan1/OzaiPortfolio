import { ZodError } from 'zod';
import { logger } from './logger.js';
import crypto from 'crypto';

export function wrapRoute(handler) {
    return async (req, res) => {
        const requestId = req.headers['x-request-id'] || crypto.randomUUID();
        req.headers['x-request-id'] = requestId;

        res.setHeader('X-Request-ID', requestId);
        res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; sandbox;");
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

        try {
            await handler(req, res);
        } catch (error) {
            handleApiError(error, req, res);
        }
    };
}

export class AppError extends Error {
    constructor(message, status = 500, code = 'INTERNAL_ERROR', details = []) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

export function handleApiError(error, req, res) {
    const requestId = req.headers['x-request-id'] || 'unknown';
    
    let status = 500;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal Server Error.';
    let details = [];

    if (error instanceof ZodError) {
        status = 400;
        code = 'VALIDATION_ERROR';
        message = 'Schema validation failed.';
        details = error.errors;
        logger.warn('Validation error', { requestId, code, details });
    } else if (error instanceof AppError) {
        status = error.status;
        code = error.code;
        message = error.message;
        details = error.details;
        logger.warn('Application error', { requestId, code, message, status });
    } else {
        message = error.message || 'Internal Server Error.';
        logger.error('Unhandled system exception', { 
            requestId, 
            message, 
            stack: error.stack 
        });
    }

    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; sandbox;");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Content-Type', 'application/json');

    return res.status(status).json({
        success: false,
        error: message,
        requestId,
        code,
        details
    });
}
