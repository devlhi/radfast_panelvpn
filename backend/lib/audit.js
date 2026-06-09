/**
 * Append-only audit logger.
 * Writes JSON-lines events for security-relevant actions.
 */
const fs = require('fs')
const path = require('path')
const config = require('../config')

let logStream = null
let currentDay = ''

function ensureStream() {
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  if (today === currentDay && logStream) return logStream

  try {
    fs.mkdirSync(config.auditLogDir, { recursive: true, mode: 0o750 })
  } catch {}

  if (logStream) try { logStream.end() } catch {}

  const file = path.join(config.auditLogDir, `audit-${today}.log`)
  logStream = fs.createWriteStream(file, { flags: 'a', mode: 0o640 })
  currentDay = today
  return logStream
}

function clientIp(req) {
  if (!req) return ''
  // Express normalises this when trust proxy is enabled
  return (req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim()
}

/**
 * Record an audit event.
 * @param {string} type     short event identifier (e.g. login.success)
 * @param {object} payload  arbitrary metadata (no secrets!)
 * @param {object} req      express request (optional)
 */
function record(type, payload = {}, req = null) {
  try {
    const event = {
      ts: new Date().toISOString(),
      type,
      ip: clientIp(req),
      ua: req?.headers?.['user-agent']?.slice(0, 200) || '',
      path: req?.originalUrl || '',
      method: req?.method || '',
      actor: req?.admin?.sub || req?.admin?.username || payload.actor || '',
      ...payload,
    }
    // Never log secrets — strip common ones
    delete event.password
    delete event.token
    delete event.psk
    delete event.privkey

    ensureStream().write(JSON.stringify(event) + '\n')
  } catch (e) {
    // Audit failures must never break the calling route.
    try { console.error('[audit] record failed:', e.message, type) } catch {}
  }
}

/**
 * Synchronous audit write — for crash handlers where the process is about to
 * exit and async stream writes may be lost before flush. Uses appendFileSync
 * so the event is guaranteed on disk before process.exit().
 */
function recordSync(type, payload = {}) {
  try {
    const today = new Date().toISOString().slice(0, 10)
    try { fs.mkdirSync(config.auditLogDir, { recursive: true, mode: 0o750 }) } catch {}
    const file = path.join(config.auditLogDir, `audit-${today}.log`)
    const event = { ts: new Date().toISOString(), type, ...payload }
    delete event.password
    delete event.token
    fs.appendFileSync(file, JSON.stringify(event) + '\n', { mode: 0o640 })
  } catch (e) {
    try { console.error('[audit] recordSync failed:', e.message, type) } catch {}
  }
}

module.exports = { record, recordSync, clientIp }
