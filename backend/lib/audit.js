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
  const event = {
    ts: new Date().toISOString(),
    type,
    ip: clientIp(req),
    ua: req?.headers?.['user-agent']?.slice(0, 200) || '',
    path: req?.originalUrl || '',
    method: req?.method || '',
    actor: req?.admin?.username || payload.actor || '',
    ...payload,
  }
  // Never log secrets — strip common ones
  delete event.password
  delete event.token
  delete event.psk
  delete event.privkey

  try {
    ensureStream().write(JSON.stringify(event) + '\n')
  } catch (e) {
    // Last-resort console fallback
    console.error('[audit] write failed:', e.message, event.type)
  }
}

module.exports = { record, clientIp }
