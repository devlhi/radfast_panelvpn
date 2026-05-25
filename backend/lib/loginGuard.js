/**
 * In-memory login lockout tracker.
 * For multi-instance deployments swap with Redis/DB.
 */
const config = require('../config')

const attempts = new Map() // key -> { count, firstAttempt, lockedUntil }

function key(ip, username) { return `${ip}::${(username || '').toLowerCase()}` }

function purge() {
  const now = Date.now()
  for (const [k, v] of attempts) {
    if (v.lockedUntil && v.lockedUntil < now) attempts.delete(k)
    else if (!v.lockedUntil && (now - v.firstAttempt) > config.lockout.durationMs) attempts.delete(k)
  }
}
setInterval(purge, 60_000).unref?.()

function isLocked(ip, username) {
  const v = attempts.get(key(ip, username))
  if (!v?.lockedUntil) return null
  if (v.lockedUntil < Date.now()) {
    attempts.delete(key(ip, username))
    return null
  }
  return Math.ceil((v.lockedUntil - Date.now()) / 1000)
}

function recordFailure(ip, username) {
  const k = key(ip, username)
  const now = Date.now()
  const v = attempts.get(k) || { count: 0, firstAttempt: now }
  v.count += 1
  if (v.count >= config.lockout.threshold) {
    v.lockedUntil = now + config.lockout.durationMs
  }
  attempts.set(k, v)
  return v
}

function clear(ip, username) {
  attempts.delete(key(ip, username))
}

module.exports = { isLocked, recordFailure, clear }
