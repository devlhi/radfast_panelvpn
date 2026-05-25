/**
 * TOTP 2FA helpers — speakeasy + qrcode + recovery codes.
 *
 * Storage: backend/data/admin-2fa.json
 * Shape:   { username: { secret, enabledAt, recoveryCodes: [bcryptHash] } }
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const speakeasy = require('speakeasy')
const QRCode = require('qrcode')
const bcrypt = require('bcryptjs')

const DATA_FILE = path.join(__dirname, '..', 'data', 'admin-2fa.json')

function _read() {
  if (!fs.existsSync(DATA_FILE)) return {}
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) } catch { return {} }
}

function _write(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true, mode: 0o750 })
  const tmp = DATA_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 })
  fs.renameSync(tmp, DATA_FILE)
}

function isEnabled(username) {
  const all = _read()
  return !!all[username]?.enabledAt
}

function hasPending(username) {
  const all = _read()
  return !!all[username]?.secret && !all[username]?.enabledAt
}

/** Generate fresh secret + QR data URL. Stored as PENDING until verified. */
async function startEnroll(username, issuer = 'RadFast Admin') {
  const secret = speakeasy.generateSecret({
    length: 32,
    name:   `${issuer}:${username}`,
    issuer,
  })
  const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url, { width: 256, margin: 1 })

  const all = _read()
  all[username] = {
    secret: secret.base32,
    enabledAt: null,
    recoveryCodes: [],
  }
  _write(all)

  return { qrDataUrl, otpauthUrl: secret.otpauth_url, base32: secret.base32 }
}

/**
 * Verify a 6-digit TOTP code against the stored secret.
 * Set `enable=true` to flip pending → active and emit recovery codes.
 */
async function verifyAndEnable(username, code) {
  const all = _read()
  const rec = all[username]
  if (!rec?.secret) return { ok: false, reason: 'no-pending' }
  if (!speakeasy.totp.verify({ secret: rec.secret, encoding: 'base32', token: code, window: 1 })) {
    return { ok: false, reason: 'invalid-code' }
  }

  // Generate 10 recovery codes (formatted XXXX-XXXX-XXXX, hashed with bcrypt cost 8 for speed).
  const plainCodes = Array.from({ length: 10 }, () => {
    const raw = crypto.randomBytes(6).toString('hex').toUpperCase()
    return raw.match(/.{1,4}/g).join('-') // e.g. AB12-CD34-EF56
  })
  rec.recoveryCodes = plainCodes.map(c => bcrypt.hashSync(c, 8))
  rec.enabledAt = new Date().toISOString()
  _write(all)

  return { ok: true, recoveryCodes: plainCodes }
}

/** Verify code OR recovery code at login time. */
function verifyChallenge(username, codeOrRecovery) {
  const all = _read()
  const rec = all[username]
  if (!rec?.secret || !rec.enabledAt) return { ok: false, reason: 'not-enrolled' }

  const code = String(codeOrRecovery || '').trim()

  // Normal 6-digit TOTP
  if (/^\d{6}$/.test(code)) {
    const ok = speakeasy.totp.verify({ secret: rec.secret, encoding: 'base32', token: code, window: 1 })
    return { ok, reason: ok ? null : 'invalid-code' }
  }

  // Recovery code path: XXXX-XXXX-XXXX (one-shot)
  if (/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(code)) {
    const upper = code.toUpperCase()
    const idx = rec.recoveryCodes.findIndex(h => bcrypt.compareSync(upper, h))
    if (idx === -1) return { ok: false, reason: 'invalid-recovery' }
    rec.recoveryCodes.splice(idx, 1) // burn it
    _write(all)
    return { ok: true, recovery: true, remaining: rec.recoveryCodes.length }
  }

  return { ok: false, reason: 'bad-format' }
}

function disable(username) {
  const all = _read()
  delete all[username]
  _write(all)
}

function getRecoveryRemaining(username) {
  const all = _read()
  return all[username]?.recoveryCodes?.length ?? 0
}

module.exports = {
  isEnabled, hasPending,
  startEnroll, verifyAndEnable, verifyChallenge, disable,
  getRecoveryRemaining,
}
