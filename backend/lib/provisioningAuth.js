/**
 * Server-to-server API key authentication for provisioning endpoints.
 *
 * Expects: X-API-Key header matching PROVISIONING_API_KEY env var.
 * No JWT/session/CSRF required — designed for billing scripts calling
 * RadFast Admin over a trusted network (VPN, internal LAN).
 *
 * Rate-limited separately via provisionLimiter in limiters.js.
 * Key expiry check (optional enforcement) with per-request audit warnings.
 */

const crypto = require('crypto')
const audit = require('./audit')
const keyStore = require('./provisioningKeyStore')
const ipStore = require('./provisioningIpStore')
const secLog = require('./securityLog')

// Track last warning/expiration audit event per key-age bucket
// to avoid filling logs with the same warning on every single request.
const LAST_EMIT = { bucket: '', ts: 0 }

function emitAudit(type, req) {
  const meta = keyStore.getMeta()
  const ageDays = meta.ageDays ?? null
  const bucket = ageDays !== null ? String(Math.floor(ageDays / 7)) : 'unknown'
  const now = Date.now()

  // Only emit once per 6-hr window per risk bucket
  if (LAST_EMIT.bucket === bucket && (now - LAST_EMIT.ts) < 21_600_000) return
  LAST_EMIT.bucket = bucket
  LAST_EMIT.ts     = now

  audit.record(type, {
    ageDays,
    maxAgeDays:      meta.maxAgeDays,
    warnAgeDays:     meta.warnAgeDays,
    rotateRecommended: meta.rotateRecommended,
    expired:         meta.expired,
    masked:          meta.masked,
  }, req)
}

function recordProvisionReject(req, type, tags = [], extra = {}) {
  secLog.record(req, {
    score: extra.score ?? 40,
    category: extra.category || 'medium',
    tags: ['acs-provision', 'api-auth-reject', ...tags],
  }, {
    type,
    status: extra.status || 403,
    action: 'blocked',
    blocked: true,
  })
}

module.exports = function provisioningAuth(req, res, next) {
  const apiKey = req.headers['x-api-key']
  const clientIp = ipStore.normalizeIp(req.ip)

  // IP allowlist dicek dulu: kalau allowlist aktif, request dari IP lain ditolak
  // bahkan sebelum validasi API key supaya key tidak bisa dicoba dari sembarang IP.
  if (!ipStore.isAllowed(clientIp)) {
    audit.record('provision.ip_blocked', { path: req.originalUrl, ip: clientIp }, req)
    recordProvisionReject(req, 'acs.provision.ip_blocked', ['ip-blocked', 'allowlist'], { status: 403, score: 50, category: 'high' })
    return res.status(403).json({ message: 'IP tidak diizinkan mengakses Provisioning API.' })
  }

  if (!apiKey) {
    audit.record('provision.auth_missing', { path: req.originalUrl, ip: clientIp }, req)
    recordProvisionReject(req, 'acs.provision.auth_missing', ['missing-api-key'], { status: 401, score: 35 })
    return res.status(401).json({ message: 'X-API-Key header tidak ditemukan.' })
  }

  // Constant-time compare lewat crypto.timingSafeEqual
  const expected = keyStore.getKey()
  if (!expected) {
    return res.status(503).json({ message: 'Provisioning API belum dikonfigurasi di server.' })
  }

  const a = Buffer.from(String(apiKey), 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    audit.record('provision.auth_fail', { path: req.originalUrl }, req)
    recordProvisionReject(req, 'acs.provision.auth_fail', ['bad-api-key'], { status: 403, score: 45 })
    return res.status(403).json({ message: 'API key tidak valid.' })
  }

  // ── Key expiry check ──────────────────────────────────────────────────
  const meta = keyStore.getMeta()
  if (meta.expired) {
    emitAudit('provision.key_expired', req)
    if (meta.enforceExpiry) {
      recordProvisionReject(req, 'acs.provision.key_expired', ['expired-api-key'], { status: 403, score: 45 })
      return res.status(403).json({
        message: 'API key sudah kedaluwarsa. Silakan rotate key di dashboard.',
      })
    }
    // lenient mode — allow through but flag it
    res.setHeader('X-RFKey-Expired', 'true')
  } else if (meta.rotateRecommended) {
    emitAudit('provision.key_expiring', req)
    res.setHeader('X-RFKey-Expiring', 'true')
    res.setHeader('X-RFKey-Age-Days', String(meta.ageDays ?? ''))
  }

  audit.record('provision.auth_ok', { path: req.originalUrl }, req)
  next()
}
