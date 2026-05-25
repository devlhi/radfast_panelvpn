/**
 * Reusable rate limiters.
 */
const rateLimit = require('express-rate-limit')
const config = require('../config')
const audit = require('./audit')

function buildLimiter(opts) {
  return rateLimit({
    windowMs: opts.windowMs,
    max:      opts.max,
    standardHeaders: 'draft-7',
    legacyHeaders:   false,
    message: { message: 'Terlalu banyak request, coba lagi nanti.' },
    skipSuccessfulRequests: opts.skipSuccessful || false,
    handler: (req, res, _next, options) => {
      audit.record('ratelimit.hit', {
        scope: opts.label,
        retryAfterMs: options.windowMs,
      }, req)
      res.status(options.statusCode).json(options.message)
    },
  })
}

module.exports = {
  loginLimiter: buildLimiter({
    windowMs: config.rateLimit.loginWinMs,
    max:      config.rateLimit.loginMax,
    label:    'login',
    skipSuccessful: true,
  }),
  apiLimiter: buildLimiter({
    windowMs: config.rateLimit.apiWinMs,
    max:      config.rateLimit.apiMax,
    label:    'api',
  }),
}
