/**
 * CSRF double-submit helper. Active only when cookie-based auth is in use.
 *
 * Pattern:
 * - Server signs a token (HMAC over raw token + session jti) and stores it in
 *   `XSRF-TOKEN` cookie (NOT httpOnly so JS can read it).
 * - Client copies cookie value into `X-CSRF-Token` header on state-changing
 *   requests. Server compares header vs cookie with timing-safe compare, then
 *   verifies the HMAC against the current session jti.
 *
 * We bypass GET/HEAD/OPTIONS, the login endpoint, and the CSRF bootstrap
 * endpoint (which only sets an anonymous pre-login cookie).
 */
const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const config = require('../config')

const COOKIE_NAME = 'XSRF-TOKEN'
const HEADER_NAME = 'x-csrf-token'

function _hmac(raw, sessionJti = '') {
  return crypto
    .createHmac('sha256', config.csrfSecret)
    .update(`${raw}:${sessionJti}`)
    .digest('hex')
}

function _newRawToken() {
  return crypto.randomBytes(24).toString('hex')
}

function _safeEqual(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8')
  const right = Buffer.from(String(b || ''), 'utf8')
  if (left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}

function _sessionJtiFromRequest(req) {
  const token = req.cookies?.[config.cookieName]
  if (!token || String(token).length > 4096) return ''

  try {
    const decoded = jwt.verify(token, config.jwt.secret, {
      algorithms:     ['HS256'],
      issuer:         config.jwt.issuer,
      audience:       config.jwt.audience,
      clockTolerance: 5,
    })
    return decoded?.jti || ''
  } catch (_err) {
    return ''
  }
}

/** Set/refresh the XSRF cookie (call this from /api/csrf and after login). */
function issue(res, sessionJti = '') {
  const raw = _newRawToken()
  const signed = `${raw}.${_hmac(raw, sessionJti)}`
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
  // Provisioning API uses X-API-Key, no session/CSRF
  if (url.startsWith('/api/provision'))      return next()

  const cookieVal = req.cookies?.[COOKIE_NAME]
  const headerVal = req.get(HEADER_NAME)

  if (!cookieVal || !headerVal || !_safeEqual(cookieVal, headerVal)) {
    return res.status(403).json({ message: 'CSRF token tidak valid.' })
  }

  // Verify HMAC integrity and bind token to the current session jti.
  const [raw, sig] = String(cookieVal).split('.')
  const sessionJti = _sessionJtiFromRequest(req)
  if (!raw || !sig || !sessionJti || !_safeEqual(_hmac(raw, sessionJti), sig)) {
    return res.status(403).json({ message: 'CSRF token rusak.' })
  }

  next()
}

module.exports = { issue, verify, COOKIE_NAME, HEADER_NAME }
