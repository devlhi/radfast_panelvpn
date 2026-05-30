/**
 * JWT blacklist + replay-protection store with file-backed persistence.
 *
 * On startup, loads previously revoked JTIs from disk so that logouts
 * survive pm2 restarts / server reboots. Entries are persisted atomically
 * (write to temp file then rename) on every `revoke()` call and during
 * the periodic cleanup sweep.
 *
 * Production note: ganti ke Redis bila scale-out. Interface tetap sama
 * (`revoke`, `isRevoked`) supaya migrasi mudah.
 */
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'data')
const BLACKLIST_FILE = path.join(DATA_DIR, 'token-blacklist.json')

const revoked = new Map() // jti -> exp epoch ms

// ─── persistence helpers ───────────────────────────────────────────────
function _loadFromDisk() {
  try {
    const raw = fs.readFileSync(BLACKLIST_FILE, 'utf8')
    const obj = JSON.parse(raw)
    if (!obj || typeof obj !== 'object') return
    const now = Date.now()
    for (const [jti, exp] of Object.entries(obj)) {
      if (typeof exp === 'number' && exp > now) revoked.set(jti, exp)
    }
  } catch (_ignored) {
    // file doesn't exist or is invalid — start with empty Map
  }
}

function _persistToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    const obj = Object.fromEntries(revoked)
    const tmp = BLACKLIST_FILE + '.' + process.pid + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(obj), { mode: 0o600 })
    fs.renameSync(tmp, BLACKLIST_FILE)
  } catch (e) {
    // non-fatal — in-memory still works, log for debugging
    console.error('[tokenStore] persist failed:', e.message)
  }
}

// Load any persisted blacklist on startup.
_loadFromDisk()

// ─── public API ────────────────────────────────────────────────────────
function revoke(jti, expSeconds) {
  if (!jti) return
  const expMs = (Number(expSeconds) || (Date.now() / 1000 + 8 * 3600)) * 1000
  revoked.set(jti, expMs)
  _persistToDisk()
}

function isRevoked(jti) {
  if (!jti) return false
  const exp = revoked.get(jti)
  if (!exp) return false
  if (exp < Date.now()) {
    revoked.delete(jti)
    return false
  }
  return true
}

function size() { return revoked.size }

// Sweeper: drop expired entries every minute.
setInterval(() => {
  const now = Date.now()
  let changed = false
  for (const [jti, exp] of revoked) {
    if (exp < now) { revoked.delete(jti); changed = true }
  }
  if (changed) _persistToDisk()
}, 60_000).unref?.()

module.exports = { revoke, isRevoked, size }
