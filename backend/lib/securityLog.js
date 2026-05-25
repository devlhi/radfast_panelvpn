/**
 * Security log — append-only NDJSON for attack telemetry.
 *
 * Every entry is recorded with the offending payload **neutralised**:
 *   - URL   : stored as-is (truncated)
 *   - body  : base64-encoded + sha256 + length only (never the raw text)
 *   - query : same treatment as body
 *
 * Rationale: an admin reading the log file should NEVER be able to copy a
 * stored payload back into a shell, browser, or DB. They get enough info to
 * understand the shape of the attack without holding a working exploit.
 *
 * Files rotate per UTC day:  data/security/security-YYYY-MM-DD.log
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const config = require('../config')

const SECURITY_DIR = path.join(config.auditLogDir, 'security')
const MAX_PAYLOAD_BYTES = 4096            // truncate before encoding
const RING_SIZE = 500                     // recent-events buffer for UI

let stream = null
let currentDay = ''
const ring = []                           // newest first

function ensureStream() {
  const today = new Date().toISOString().slice(0, 10)
  if (today === currentDay && stream) return stream

  try { fs.mkdirSync(SECURITY_DIR, { recursive: true, mode: 0o750 }) } catch {}

  if (stream) try { stream.end() } catch {}

  const file = path.join(SECURITY_DIR, `security-${today}.log`)
  stream = fs.createWriteStream(file, { flags: 'a', mode: 0o640 })
  currentDay = today
  return stream
}

function neutralise(value) {
  if (value == null) return null
  const fullStr = typeof value === 'string' ? value : safeStringify(value)
  if (!fullStr) return null

  // Original length BEFORE any truncation — admin sees true payload size.
  const fullLen = Buffer.byteLength(fullStr, 'utf8')

  let str = fullStr
  let truncated = false
  if (str.length > MAX_PAYLOAD_BYTES) {
    str = str.slice(0, MAX_PAYLOAD_BYTES)
    truncated = true
  }

  // sha256 + b64 are computed over the SAME bytes that get stored, so
  // hashing the b64 round-trip gives back the same digest. This keeps
  // forensic tooling consistent.
  const buf = Buffer.from(str, 'utf8')
  return {
    len: fullLen,
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    b64: buf.toString('base64'),
    truncated,
  }
}

function safeStringify(obj) {
  try {
    return JSON.stringify(obj, (_k, v) => {
      if (typeof v === 'string' && v.length > MAX_PAYLOAD_BYTES) {
        return v.slice(0, MAX_PAYLOAD_BYTES) + '…[truncated]'
      }
      return v
    })
  } catch {
    return ''
  }
}

function clientIp(req) {
  return (req.ip || req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '')
    .toString().split(',')[0].trim()
}

/**
 * Record a security event from a request + threat result.
 */
function record(req, threat, extra = {}) {
  // Strip query-string from path so the on-disk log can never be a working
  // copy-paste exploit URL. The querystring lives only in `query` (b64).
  const fullPath = (req.originalUrl || req.url || '').slice(0, 1024)
  const qIdx = fullPath.indexOf('?')
  const cleanPath = qIdx >= 0 ? fullPath.slice(0, qIdx) : fullPath

  const event = {
    ts:       new Date().toISOString(),
    type:     extra.type || 'attack.detected',
    ip:       clientIp(req),
    method:   req.method,
    path:     cleanPath,
    status:   extra.status || null,
    score:    threat?.score ?? 0,
    category: threat?.category || 'low',
    tags:     threat?.tags || [],
    ua:       (req.headers?.['user-agent'] || '').slice(0, 300),
    referer:  (req.headers?.referer || '').slice(0, 300),
    actor:    req.admin?.sub || req.admin?.username || null,
    action:   extra.action || 'logged',          // logged | blocked | banned
    blocked:  !!extra.blocked,
    banned:   !!extra.banned,
    // Neutralised payloads — base64 only, never raw on disk:
    query:    qIdx >= 0
      ? neutralise(fullPath.slice(qIdx + 1))
      : (Object.keys(req.query || {}).length ? neutralise(req.query) : null),
    body:     req.body && Object.keys(req.body).length ? neutralise(req.body) : null,
    headers:  neutraliseHeaders(req.headers || {}),
  }

  // Push to in-memory ring for the UI
  ring.unshift(event)
  if (ring.length > RING_SIZE) ring.length = RING_SIZE

  // Append to disk
  try { ensureStream().write(JSON.stringify(event) + '\n') } catch (e) {
    console.error('[security-log] write failed:', e.message)
  }

  return event
}

function neutraliseHeaders(h) {
  const allow = ['user-agent', 'referer', 'x-forwarded-for', 'x-real-ip',
    'accept', 'accept-language', 'content-type', 'host', 'origin']
  const out = {}
  for (const k of allow) if (h[k]) out[k] = String(h[k]).slice(0, 300)
  // Anything else → just record name + length so we know it was present
  const others = []
  for (const k of Object.keys(h)) {
    if (allow.includes(k)) continue
    if (k.toLowerCase() === 'cookie' || k.toLowerCase() === 'authorization') {
      others.push({ name: k, len: String(h[k]).length, redacted: true })
    } else {
      others.push({ name: k, len: String(h[k]).length })
    }
  }
  if (others.length) out._others = others.slice(0, 30)
  return out
}

/**
 * Read recent events directly from the ring buffer.
 */
function recent({ limit = 100, minScore = 0, ip = null, tag = null } = {}) {
  let out = ring
  if (minScore > 0) out = out.filter(e => e.score >= minScore)
  if (ip)           out = out.filter(e => e.ip === ip)
  if (tag)          out = out.filter(e => (e.tags || []).includes(tag))
  return out.slice(0, Math.min(limit, RING_SIZE))
}

/**
 * Aggregate ring stats for dashboard chart.
 */
function summary() {
  const byCat = { critical: 0, high: 0, medium: 0, low: 0, normal: 0 }
  const byTag = Object.create(null)
  const byIp  = Object.create(null)
  for (const e of ring) {
    byCat[e.category] = (byCat[e.category] || 0) + 1
    for (const t of e.tags || []) byTag[t] = (byTag[t] || 0) + 1
    if (e.ip) byIp[e.ip] = (byIp[e.ip] || 0) + 1
  }
  const topTags = Object.entries(byTag).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const topIps  = Object.entries(byIp).sort((a, b) => b[1] - a[1]).slice(0, 10)
  return {
    total: ring.length,
    byCategory: byCat,
    topTags: topTags.map(([k, v]) => ({ tag: k, count: v })),
    topIps:  topIps.map(([k, v])  => ({ ip: k, count: v })),
    windowFirstTs: ring.length ? ring[ring.length - 1].ts : null,
    windowLastTs:  ring.length ? ring[0].ts : null,
  }
}

/**
 * Decode the base64 payload back to text on demand (admin-only route).
 * The decoded value is returned to the API caller; it never goes back into
 * the persisted log.
 */
function decodePayload(b64) {
  if (!b64 || typeof b64 !== 'string') return ''
  try {
    return Buffer.from(b64, 'base64').toString('utf8')
  } catch { return '' }
}

module.exports = {
  record,
  recent,
  summary,
  decodePayload,
  SECURITY_DIR,
}
