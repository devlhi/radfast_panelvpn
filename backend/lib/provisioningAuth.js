/**
 * Server-to-server API key authentication for provisioning endpoints.
 *
 * Expects: X-API-Key header matching PROVISIONING_API_KEY env var.
 * No JWT/session/CSRF required — designed for billing scripts calling
 * RadFast Admin over a trusted network (VPN, internal LAN).
 *
 * Rate-limited separately via provisionLimiter in limiters.js.
 */
const audit = require('./audit')
const keyStore = require('./provisioningKeyStore')

module.exports = function provisioningAuth(req, res, next) {
  const apiKey = req.headers['x-api-key']

  if (!apiKey) {
    audit.record('provision.auth_missing', { path: req.originalUrl }, req)
    return res.status(401).json({ message: 'X-API-Key header tidak ditemukan.' })
  }

  // Constant-time compare lewat crypto.timingSafeEqual
  const crypto = require('crypto')
  const expected = keyStore.getKey()
  if (!expected) {
    return res.status(503).json({ message: 'Provisioning API belum dikonfigurasi di server.' })
  }

  const a = Buffer.from(String(apiKey), 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    audit.record('provision.auth_fail', { path: req.originalUrl }, req)
    return res.status(403).json({ message: 'API key tidak valid.' })
  }

  audit.record('provision.auth_ok', { path: req.originalUrl }, req)
  next()
}
