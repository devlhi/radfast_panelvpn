const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const { body, validationResult } = require('express-validator')

const config = require('../config')
const audit = require('../lib/audit')
const guard = require('../lib/loginGuard')
const auth = require('../middleware/auth')
const { loginLimiter } = require('../lib/limiters')
const tokenStore = require('../lib/tokenStore')
const twofa = require('../lib/twofa')
const csrf = require('../lib/csrf')

const router = express.Router()

// Pre-computed dummy hash to keep timing constant when user is unknown.
const DUMMY_HASH = '$2b$12$CwTycUXWue0Thq9StjUM0uJ8xY9YwR1jQz0xY9YwR1jQz0xY9YwR1G'

const COOKIE_OPTS = () => ({
  httpOnly: true,
  // secure hanya aktif jika HTTPS=true di .env
  // jangan pakai isProd — production HTTP bikin browser reject cookie (tidak dikirim balik → logout terus)
  secure:   config.useHttps,
  sameSite: 'strict',
  path:     '/',
  maxAge:   8 * 60 * 60 * 1000,
})

// ─── helpers ───────────────────────────────────────────────────────────────
function signToken(payload, ttl = config.jwt.expiresIn) {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: ttl,
    issuer:    config.jwt.issuer,
    audience:  config.jwt.audience,
    algorithm: 'HS256',
  })
}

function setSessionCookie(res, token) {
  res.cookie(config.cookieName, token, COOKIE_OPTS())
}

function getSessionJti(req) {
  const token = req.cookies?.[config.cookieName]
  if (!token || String(token).length > 4096) return ''

  try {
    const payload = jwt.verify(token, config.jwt.secret, {
      algorithms: ['HS256'],
      issuer: config.jwt.issuer,
      audience: config.jwt.audience,
      clockTolerance: 5,
    })
    return payload?.jti || ''
  } catch (_err) {
    return ''
  }
}

// ═════════════════════════════════════════════════════════════════════════
// POST /api/auth/login
// On success: either issues full session or partial token requesting 2FA.
// ═════════════════════════════════════════════════════════════════════════
router.post(
  '/login',
  loginLimiter,
  body('username').isString().trim().isLength({ min: 1, max: 64 }).matches(/^[a-zA-Z0-9_.-]+$/),
  body('password').isString().isLength({ min: 1, max: 256 }),
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      audit.record('login.invalid_input', {}, req)
      return res.status(400).json({ message: 'Username atau password salah.' })
    }

    const { username, password } = req.body
    const ip = audit.clientIp(req)

    const lockSec = guard.isLocked(ip, username)
    if (lockSec) {
      audit.record('login.locked', { username, retryInSec: lockSec }, req)
      return res.status(429).json({
        message: `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(lockSec / 60)} menit.`,
      })
    }

    const cfgUser = Buffer.from(config.admin.username)
    const reqUser = Buffer.from(username)
    const usernameMatches =
      reqUser.length === cfgUser.length &&
      crypto.timingSafeEqual(reqUser, cfgUser)

    const hashToCompare = usernameMatches ? config.admin.passwordHash : DUMMY_HASH
    const passwordMatches = await bcrypt.compare(password, hashToCompare)

    if (!usernameMatches || !passwordMatches) {
      const v = guard.recordFailure(ip, username)
      audit.record('login.failure', {
        username, attempts: v.count, locked: !!v.lockedUntil,
      }, req)
      return res.status(401).json({ message: 'Username atau password salah.' })
    }

    guard.clear(ip, username)
    const jti = crypto.randomBytes(12).toString('hex')

    // ── 2FA gate ─────────────────────────────────────────────────────────
    if (twofa.isEnabled(username)) {
      // Issue short-lived "challenge" token — only accepted by /verify-2fa.
      const challenge = signToken(
        { sub: username, jti, amr: ['pwd'], step: '2fa' },
        '5m',
      )
      audit.record('login.password_ok_awaiting_2fa', { username }, req)
      return res.json({
        challengeToken: challenge,
        requires2FA: true,
        expiresIn: '5m',
      })
    }

    // ── Full session (no 2FA enrolled) ──────────────────────────────────
    const token = signToken({ sub: username, role: 'superadmin', jti, amr: ['pwd'] })
    setSessionCookie(res, token)
    csrf.issue(res, jti)

    audit.record('login.success', { username, jti, twofa: false }, req)
    return res.json({
      ok: true,
      admin: { username, role: 'superadmin', twofaEnabled: false },
      expiresIn: config.jwt.expiresIn,
    })
  },
)

// ═════════════════════════════════════════════════════════════════════════
// POST /api/auth/verify-2fa  { challengeToken, code }
// ═════════════════════════════════════════════════════════════════════════
router.post(
  '/verify-2fa',
  loginLimiter,
  body('challengeToken').isString().isLength({ min: 20, max: 4096 }),
  body('code').isString().isLength({ min: 6, max: 32 }),
  (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Input tidak valid.' })

    const { challengeToken, code } = req.body
    let payload
    try {
      payload = jwt.verify(challengeToken, config.jwt.secret, {
        algorithms: ['HS256'],
        issuer:     config.jwt.issuer,
        audience:   config.jwt.audience,
      })
    } catch {
      return res.status(401).json({ message: 'Challenge token tidak valid / kadaluarsa.' })
    }
    if (payload.step !== '2fa' || !payload.sub) {
      return res.status(401).json({ message: 'Challenge token tidak valid.' })
    }

    const result = twofa.verifyChallenge(payload.sub, code)
    if (!result.ok) {
      const v = guard.recordFailure(audit.clientIp(req), payload.sub)
      audit.record('2fa.verify_fail', {
        username: payload.sub, reason: result.reason, attempts: v.count,
      }, req)
      return res.status(401).json({ message: '2FA code salah.' })
    }

    // Burn challenge jti so it can't be replayed.
    tokenStore.revoke(payload.jti, payload.exp)

    const newJti = crypto.randomBytes(12).toString('hex')
    const session = signToken({
      sub: payload.sub, role: 'superadmin', jti: newJti, amr: ['pwd', 'mfa'],
    })
    setSessionCookie(res, session)
    csrf.issue(res, newJti)

    audit.record('login.success', {
      username: payload.sub, jti: newJti, twofa: true,
      recovery: !!result.recovery,
    }, req)

    return res.json({
      ok: true,
      admin: { username: payload.sub, role: 'superadmin', twofaEnabled: true },
      recoveryRemaining: result.recovery ? result.remaining : undefined,
    })
  },
)

// ═════════════════════════════════════════════════════════════════════════
// POST /api/auth/logout — revoke jti + clear cookies
// ═════════════════════════════════════════════════════════════════════════
router.post('/logout', auth, (req, res) => {
  if (req.admin?.jti && req.admin?.exp) {
    tokenStore.revoke(req.admin.jti, req.admin.exp)
  }
  res.clearCookie(config.cookieName, { path: '/' })
  res.clearCookie(csrf.COOKIE_NAME, { path: '/' })
  audit.record('logout', { jti: req.admin?.jti }, req)
  res.json({ ok: true, message: 'Logged out.' })
})

// ═════════════════════════════════════════════════════════════════════════
// GET /api/auth/me — verify session
// ═════════════════════════════════════════════════════════════════════════
router.get('/me', auth, (req, res) => {
  res.json({
    admin: {
      username:    req.admin.sub,
      role:        req.admin.role,
      twofaEnabled: twofa.isEnabled(req.admin.sub),
      recoveryRemaining: twofa.getRecoveryRemaining(req.admin.sub),
    },
  })
})

// ═════════════════════════════════════════════════════════════════════════
// 2FA enrollment endpoints (protected)
// ═════════════════════════════════════════════════════════════════════════
router.post('/2fa/setup', auth, async (req, res) => {
  const username = req.admin.sub
  const result = await twofa.startEnroll(username)
  audit.record('2fa.enroll_start', { username }, req)
  res.json({
    qrDataUrl:  result.qrDataUrl,
    otpauthUrl: result.otpauthUrl,
    base32:     result.base32, // shown once for manual entry
  })
})

router.post(
  '/2fa/enable',
  auth,
  body('code').isString().matches(/^\d{6}$/),
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Kode harus 6 digit.' })

    const username = req.admin.sub
    const result = await twofa.verifyAndEnable(username, req.body.code)
    if (!result.ok) {
      audit.record('2fa.enroll_fail', { username, reason: result.reason }, req)
      return res.status(400).json({ message: 'Kode TOTP salah. Coba lagi.' })
    }
    audit.record('2fa.enroll_success', { username }, req)
    res.json({ ok: true, recoveryCodes: result.recoveryCodes })
  },
)

router.post(
  '/2fa/disable',
  auth,
  body('password').isString().isLength({ min: 1, max: 256 }),
  async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ message: 'Password wajib.' })

    const username = req.admin.sub
    const ok = await bcrypt.compare(req.body.password, config.admin.passwordHash)
    if (!ok) {
      audit.record('2fa.disable_fail', { username }, req)
      return res.status(401).json({ message: 'Password salah.' })
    }
    twofa.disable(username)
    audit.record('2fa.disable_success', { username }, req)
    res.json({ ok: true })
  },
)

// ═════════════════════════════════════════════════════════════════════════
// Provisioning API Key management (JWT-protected)
// ═════════════════════════════════════════════════════════════════════════
const keyStore = require('../lib/provisioningKeyStore')

router.get('/provisioning-key', auth, (req, res) => {
  const meta = keyStore.getMeta()
  res.json(meta)
})

router.post('/provisioning-key/generate', auth, (req, res) => {
  try {
    const apiKeyPlain = keyStore.generateKey()
    keyStore.setKey(apiKeyPlain)
    audit.record('provision.key_generated', { username: req.admin.sub }, req)

    res.json({
      apiKey: apiKeyPlain,
      mask: keyStore.mask(apiKeyPlain),
      warning: 'Simpan key ini sekarang — tidak akan ditampilkan lagi.',
    })
  } catch (e) {
    return res.status(500).json({ message: e.message || 'Gagal generate API key.' })
  }
})

router.put('/provisioning-key', auth,
  body('apiKey').isString().isLength({ min: 32, max: 256 }),
  (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'API key minimal 32 karakter.' })
    }
    try {
      const result = keyStore.setKey(req.body.apiKey.trim())
      audit.record('provision.key_set', { username: req.admin.sub, source: 'manual' }, req)
      res.json({
        ok: true,
        mask: result.apiKey ? keyStore.mask(result.apiKey) : '',
        updatedAt: result.updatedAt,
      })
    } catch (e) {
      return res.status(400).json({ message: e.message || 'Gagal menyimpan API key.' })
    }
  },
)

// CSRF bootstrap — frontend calls this once at app boot.
router.get('/csrf', (req, res) => {
  const jti = getSessionJti(req)
  csrf.issue(res, jti)
  res.json({ ok: true })
})

module.exports = router
