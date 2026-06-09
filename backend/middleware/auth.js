const jwt = require('jsonwebtoken')
const config = require('../config')
const audit = require('../lib/audit')
const tokenStore = require('../lib/tokenStore')
const secLog = require('../lib/securityLog')

/**
 * Verify the JWT from either:
 *   1. httpOnly cookie  (preferred — set by /api/auth/login)
 *   2. Authorization Bearer header (legacy / external integrations)
 *
 * Adds revoke-list check via tokenStore.
 */
function recordTokenReject(req, type, status = 401) {
  secLog.record(req, {
    score: 30,
    category: 'medium',
    tags: ['admin-panel', 'auth-reject', 'token-reject'],
  }, {
    type,
    status,
    action: 'blocked',
    blocked: true,
  })
}

module.exports = function authMiddleware(req, res, next) {
  let token

  // Cookie first
  if (req.cookies && req.cookies[config.cookieName]) {
    token = req.cookies[config.cookieName]
  } else {
    const header = req.headers.authorization
    if (header && header.startsWith('Bearer ')) {
      token = header.slice(7).trim()
    }
  }

  if (!token) {
    recordTokenReject(req, 'admin.auth.token_missing')
    return res.status(401).json({ message: 'Token tidak ditemukan.' })
  }
  if (token.length > 4096) {
    recordTokenReject(req, 'admin.auth.token_too_large')
    return res.status(401).json({ message: 'Token tidak valid.' })
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret, {
      algorithms:     ['HS256'],
      issuer:         config.jwt.issuer,
      audience:       config.jwt.audience,
      clockTolerance: 5,
    })

    if (!decoded.sub) {
      recordTokenReject(req, 'admin.auth.token_invalid_subject')
      return res.status(401).json({ message: 'Token tidak valid.' })
    }
    if (decoded.amr && !decoded.amr.includes('pwd')) {
      // Pre-2FA partial token reaching protected resource
      recordTokenReject(req, 'admin.auth.partial_session_rejected')
      return res.status(401).json({ message: 'Sesi belum lengkap.' })
    }

    if (tokenStore.isRevoked(decoded.jti)) {
      audit.record('auth.token_revoked_attempt', { jti: decoded.jti }, req)
      recordTokenReject(req, 'admin.auth.token_revoked')
      return res.status(401).json({ message: 'Sesi sudah dicabut.' })
    }

    req.admin = decoded
    req.token = token
    return next()
  } catch (err) {
    audit.record('auth.token_rejected', { reason: err.name || 'unknown' }, req)
    recordTokenReject(req, 'admin.auth.token_rejected')
    return res.status(401).json({ message: 'Token tidak valid atau sudah kadaluarsa.' })
  }
}
