/**
 * In-memory JWT blacklist + replay-protection store.
 *
 * Production note: ganti ke Redis bila scale-out. Interface dijaga sederhana
 * (`revoke`, `isRevoked`) supaya migrasi mudah.
 */

const revoked = new Map() // jti -> exp epoch ms

function revoke(jti, expSeconds) {
  if (!jti) return
  const expMs = (Number(expSeconds) || (Date.now() / 1000 + 8 * 3600)) * 1000
  revoked.set(jti, expMs)
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
  for (const [jti, exp] of revoked) {
    if (exp < now) revoked.delete(jti)
  }
}, 60_000).unref?.()

module.exports = { revoke, isRevoked, size }
