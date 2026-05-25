/**
 * IP blocker — adaptive ban based on threat scores.
 *
 * Two tiers:
 *   - soft block : 1 minute (request-level, after a single score >= 50)
 *   - hard ban   : 1 hour, lifted automatically. Triggered when the rolling
 *                  threat score for an IP exceeds BAN_THRESHOLD within
 *                  BAN_WINDOW_MS, OR a single critical event hits >= 100.
 *
 * Allow-list: localhost / loopback never gets banned (developer safety).
 * Manual unban exposed via /api/security/unblock for admin.
 */

const config = require('../config')

const BAN_THRESHOLD  = parseInt(process.env.SECURITY_BAN_THRESHOLD, 10)  || 150
const BAN_WINDOW_MS  = parseInt(process.env.SECURITY_BAN_WINDOW_MIN, 10) * 60_000 || 10 * 60_000
const BAN_DURATION   = parseInt(process.env.SECURITY_BAN_DURATION_MIN, 10) * 60_000 || 60 * 60_000
const SOFT_DURATION  = 60_000

const ALLOW = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

const bans  = new Map()  // ip -> { until, reason }
const score = new Map()  // ip -> { total, firstAt, history: [{ts, s}] }

function isAllowlisted(ip) { return ALLOW.has(ip) }

function purge() {
  const now = Date.now()
  for (const [ip, b] of bans) if (b.until < now) bans.delete(ip)
  for (const [ip, s] of score) {
    s.history = s.history.filter(h => now - h.ts < BAN_WINDOW_MS)
    if (s.history.length === 0) score.delete(ip)
    else s.total = s.history.reduce((a, c) => a + c.s, 0)
  }
}
setInterval(purge, 60_000).unref?.()

function isBanned(ip) {
  if (isAllowlisted(ip)) return null
  const b = bans.get(ip)
  if (!b) return null
  if (b.until < Date.now()) { bans.delete(ip); return null }
  return { until: b.until, reason: b.reason, retryAfter: Math.ceil((b.until - Date.now()) / 1000) }
}

function ban(ip, durationMs, reason) {
  if (isAllowlisted(ip)) return null
  const until = Date.now() + durationMs
  bans.set(ip, { until, reason })
  return { until, reason }
}

/**
 * Feed a request's threat score. Returns:
 *   { action: 'allow' | 'soft' | 'ban', banInfo? }
 */
function feed(ip, threatScore, threatTags = []) {
  if (isAllowlisted(ip)) return { action: 'allow' }

  // Already banned? Just return current ban.
  const existing = isBanned(ip)
  if (existing) return { action: 'ban', banInfo: existing }

  if (threatScore <= 0) return { action: 'allow' }

  // Update rolling score
  const s = score.get(ip) || { total: 0, firstAt: Date.now(), history: [] }
  s.history.push({ ts: Date.now(), s: threatScore })
  s.history = s.history.filter(h => Date.now() - h.ts < BAN_WINDOW_MS)
  s.total = s.history.reduce((a, c) => a + c.s, 0)
  score.set(ip, s)

  // Critical single event → instant hard ban
  if (threatScore >= 100 || threatTags.includes('log4shell')) {
    const info = ban(ip, BAN_DURATION, `critical:${threatTags.join(',')}`)
    return { action: 'ban', banInfo: info }
  }

  // Cumulative threshold → hard ban
  if (s.total >= BAN_THRESHOLD) {
    const info = ban(ip, BAN_DURATION, `cumulative:${s.total}`)
    score.delete(ip)
    return { action: 'ban', banInfo: info }
  }

  // High single event → soft block this request only
  if (threatScore >= 50) {
    return { action: 'soft' }
  }

  return { action: 'allow' }
}

function unban(ip) { return bans.delete(ip) }

function listBans() {
  const now = Date.now()
  const out = []
  for (const [ip, b] of bans) {
    if (b.until < now) continue
    out.push({ ip, until: new Date(b.until).toISOString(), reason: b.reason,
      retryAfterSec: Math.ceil((b.until - now) / 1000) })
  }
  return out
}

module.exports = {
  feed,
  isBanned,
  ban,
  unban,
  listBans,
  isAllowlisted,
  BAN_DURATION,
  SOFT_DURATION,
}
