const jwt = require('jsonwebtoken')
const config = require('../config')
const audit = require('../lib/audit')
const tokenStore = require('../lib/tokenStore')

/**
 * Verify the JWT from either:
 *   1. httpOnly cookie  (preferred — set by /api/auth/login)
 *   2. Authorization Bearer header (legacy / external integrations)
 *
 * Adds revoke-list check via tokenStore.
 */
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

  if (!token) return res.status(401).json({ message: 'Token tidak ditemukan.' })
  if (token.length > 4096) return res.status(401).json({ message: 'Token tidak valid.' })

  try {
    const decoded = jwt.verify(token, config.jwt.secret, {
      algorithms:     ['HS256'],
      issuer:         config.jwt.issuer,
      audience:       config.jwt.audience,
      clockTolerance: 5,
    })

    if (!decoded.sub) return res.status(401).json({ message: 'Token tidak valid.' })
    if (decoded.amr && !decoded.amr.includes('pwd')) {
      // Pre-2FA partial token reaching protected resource
      return res.status(401).json({ message: 'Sesi belum lengkap.' })
    }

    if (tokenStore.isRevoked(decoded.jti)) {
      audit.record('auth.token_revoked_attempt', { jti: decoded.jti }, req)
      return res.status(401).json({ message: 'Sesi sudah dicabut.' })
    }

    req.admin = decoded
    req.token = token
    return next()
  } catch (err) {
    audit.record('auth.token_rejected', { reason: err.name || 'unknown' }, req)
    return res.status(401).json({ message: 'Token tidak valid atau sudah kadaluarsa.' })
  }
}
