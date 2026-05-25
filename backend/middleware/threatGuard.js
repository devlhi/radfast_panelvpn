/**
 * threatGuard middleware — runs early in the request pipeline.
 *
 * Behaviour per request:
 *   1. If IP is hard-banned → 403 + Retry-After, log "blocked".
 *   2. Inspect the request with threatDetector.
 *   3. If score >= 20 OR tags non-empty → record to securityLog (neutralised).
 *   4. Feed ipBlocker; on `soft` action, deny THIS request only;
 *      on `ban` action, the IP gets put in the ban map and the request 403s.
 *
 * Localhost is exempt from blocking (developer safety) but still logged so
 * we can see attacks even in dev.
 */

const detector = require('../lib/threatDetector')
const secLog   = require('../lib/securityLog')
const blocker  = require('../lib/ipBlocker')

function ipOf(req) {
  return (req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '')
    .toString().split(',')[0].trim()
}

module.exports = function threatGuard(req, res, next) {
  const ip = ipOf(req)

  // Step 1: existing ban
  const existing = blocker.isBanned(ip)
  if (existing) {
    secLog.record(req, { score: 0, category: 'blocked', tags: ['banned'] }, {
      type: 'attack.blocked', status: 403, action: 'blocked', blocked: true,
    })
    res.setHeader('Retry-After', existing.retryAfter)
    return res.status(403).json({ message: 'Akses diblokir karena aktivitas mencurigakan.' })
  }

  // Step 2: inspect (cheap regex pass)
  const threat = detector.inspect(req)

  // Step 3: log + feed scorer
  if (threat.score >= 20 || (threat.tags && threat.tags.length > 0)) {
    const decision = blocker.feed(ip, threat.score, threat.tags)

    if (decision.action === 'ban') {
      secLog.record(req, threat, {
        type: 'attack.banned', status: 403, action: 'banned',
        blocked: true, banned: true,
      })
      res.setHeader('Retry-After', decision.banInfo?.retryAfter || 3600)
      return res.status(403).json({ message: 'Akses diblokir karena aktivitas mencurigakan.' })
    }

    if (decision.action === 'soft') {
      secLog.record(req, threat, {
        type: 'attack.blocked', status: 403, action: 'blocked', blocked: true,
      })
      return res.status(403).json({ message: 'Permintaan ditolak (anomali keamanan).' })
    }

    // Just log — request continues.
    secLog.record(req, threat, {
      type: 'attack.detected', action: 'logged',
    })
  }

  next()
}
