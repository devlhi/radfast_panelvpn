/**
 * CSRF double-submit helper. Active only when cookie-based auth is in use.
 *
 * Pattern:
 * - Server signs a token (HMAC over sessionId-like secret) and stores in
 *   `XSRF-TOKEN` cookie (NOT httpOnly so JS can read it).
 * - Client copies cookie value into `X-CSRF-Token` header on state-changing
 *   requests. Server compares header vs cookie.
 *
 * We bypass GET/HEAD/OPTIONS, the login endpoint, and the CSRF bootstrap
 * endpoint (which only sets the cookie).
 */
const crypto = require('crypto')
const config = require('../config')

const COOKIE_NAME = 'XSRF-TOKEN'
const HEADER_NAME = 'x-csrf-token'

function _hmac(value) {
  return crypto.createHmac('sha256', config.csrfSecret).update(value).digest('hex')
}

function _newRawToken() {
  return crypto.randomBytes(24).toString('hex')
}

/** Set/refresh the XSRF cookie (call this from /api/csrf and after login). */
function issue(res) {
  const raw = _newRawToken()
  const signed = `${raw}.${_hmac(raw)}`
  res.cookie(COOKIE_NAME, signed, {
    httpOnly: false,                  // client JS must read
    secure:   config.useHttps,        // hanya true jika HTTPS=true di .env
    sameSite: 'strict',
    path:     '/',
    maxAge:   8 * 60 * 60 * 1000,
  })
  return signed
}

/** Validate header vs cookie on every state-changing request. */
function verify(req, res, next) {
  const method = req.method.toUpperCase()
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return next()

  // Login + CSRF bootstrap don't require an existing token.
  const url = req.originalUrl || req.url || ''
  if (url.startsWith('/api/auth/login'))     return next()
  if (url.startsWith('/api/auth/verify-2fa')) return next()
  if (url.startsWith('/api/auth/csrf'))      return next()

  const cookieVal = req.cookies?.[COOKIE_NAME]
  const headerVal = req.get(HEADER_NAME)

  if (!cookieVal || !headerVal || cookieVal !== headerVal) {
    return res.status(403).json({ message: 'CSRF token tidak valid.' })
  }

  // Verify HMAC integrity (defense vs cookie injection).
  const [raw, sig] = String(cookieVal).split('.')
  if (!raw || !sig || _hmac(raw) !== sig) {
    return res.status(403).json({ message: 'CSRF token rusak.' })
  }

  next()
}

module.exports = { issue, verify, COOKIE_NAME, HEADER_NAME }
