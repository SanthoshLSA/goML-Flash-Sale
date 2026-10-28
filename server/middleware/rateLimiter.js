const rateLimit = require('express-rate-limit');

/**
 * Standard checkout endpoint rate limiter:
 * Limits rapid repetitive clicks and malicious bots per IP/user.
 * Allows 10 requests per second with standard headers.
 */
const checkoutLimiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 10, // Max 10 requests per second per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'RATE_LIMITED',
    message: 'Too many checkout requests detected from this client. Please wait a moment before trying again.',
  },
  keyGenerator: (req) => {
    // Generate key based on IP and optional user auth/fingerprint
    return req.headers['x-forwarded-for'] || req.ip || 'global';
  },
});

/**
 * General API rate limiter
 */
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // 1000 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'RATE_LIMITED',
    message: 'API rate limit exceeded.',
  },
});

module.exports = {
  checkoutLimiter,
  generalLimiter,
};
