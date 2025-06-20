import rateLimit from 'express-rate-limit';

// Basic rate limiting for general routes
export const basicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
});

// More strict limiter for authentication routes
export const authLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // limit each IP to 10 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many authentication attempts, please try again after an hour'
});

// Limiter for sensitive operations
export const sensitiveOpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // limit each IP to 5 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many sensitive operations attempted, please try again after an hour'
});