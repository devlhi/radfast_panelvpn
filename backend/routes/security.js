const express = require('express')
const path = require('path')
const fs = require('fs')

const auth     = require('../middleware/auth')
const secLog   = require('../lib/securityLog')
const blocker  = require('../lib/ipBlocker')
const audit    = require('../lib/audit')
const config   = require('../config')

const router = express.Router()

// All routes here require an authenticated admin
router.use(auth)

// ─── GET /api/security/recent ─────────────────────────────────────────────
router.get('/recent', (req, res) => {
  const limit    = Math.min(parseInt(req.query.limit, 10) || 100, 500)
  const minScore = parseInt(req.query.minScore, 10) || 0
  const ip       = req.query.ip ? String(req.query.ip).slice(0, 64) : null
  const tag      = req.query.tag ? String(req.query.tag).slice(0, 64) : null

  res.json({
    events: secLog.recent({ limit, minScore, ip, tag }),
  })
})

// ─── GET /api/security/summary ────────────────────────────────────────────
router.get('/summary', (req, res) => {
  res.json({
    summary: secLog.summary(),
    bans:    blocker.listBans(),
  })
})

// ─── POST /api/security/decode ────────────────────────────────────────────
// Decode a stored base64 payload — admin only, on-demand, not logged with
// the decoded content. Used by UI when admin clicks "Reveal payload".
router.post('/decode', (req, res) => {
  const b64 = String(req.body?.b64 || '')
  if (!b64) return res.status(400).json({ message: 'b64 wajib.' })
  if (b64.length > 16384) return res.status(400).json({ message: 'Payload terlalu besar.' })
  audit.record('security.decode_payload', { len: b64.length }, req)
  res.json({ text: secLog.decodePayload(b64) })
})

// ─── GET /api/security/bans ───────────────────────────────────────────────
router.get('/bans', (req, res) => {
  res.json({ bans: blocker.listBans() })
})

// ─── POST /api/security/unblock { ip } ────────────────────────────────────
router.post('/unblock', (req, res) => {
  const ip = String(req.body?.ip || '').slice(0, 64)
  if (!ip) return res.status(400).json({ message: 'ip wajib.' })
  const ok = blocker.unban(ip)
  audit.record('security.ip_unbanned', { ip, ok }, req)
  res.json({ ok })
})

// ─── GET /api/security/files ──────────────────────────────────────────────
router.get('/files', (req, res) => {
  try {
    const files = fs.readdirSync(secLog.SECURITY_DIR)
      .filter(f => f.startsWith('security-') && f.endsWith('.log'))
      .sort().reverse()
      .map(name => {
        const full = path.join(secLog.SECURITY_DIR, name)
        const st = fs.statSync(full)
        return { name, sizeBytes: st.size, mtime: st.mtime.toISOString() }
      })
    res.json({ files })
  } catch (e) {
    res.json({ files: [], error: e.message })
  }
})

// ─── GET /api/security/file/:name ─ stream NDJSON, last N lines  ─────────
router.get('/file/:name', (req, res) => {
  const name = String(req.params.name || '')
  if (!/^security-\d{4}-\d{2}-\d{2}\.log$/.test(name)) {
    return res.status(400).json({ message: 'Nama file tidak valid.' })
  }
  const full = path.join(secLog.SECURITY_DIR, name)
  if (!full.startsWith(secLog.SECURITY_DIR)) {
    return res.status(400).json({ message: 'Path tidak valid.' })
  }
  if (!fs.existsSync(full)) return res.status(404).json({ message: 'File tidak ada.' })

  const tail = Math.min(parseInt(req.query.tail, 10) || 200, 2000)
  try {
    const text = fs.readFileSync(full, 'utf8')
    const lines = text.split('\n').filter(Boolean).slice(-tail)
    const events = []
    for (const l of lines) { try { events.push(JSON.parse(l)) } catch {} }
    res.json({ name, events: events.reverse() })
  } catch (e) {
    res.status(500).json({ message: e.message })
  }
})

// ─── GET /api/security/audit-files ─ daftar file activity/audit log ───────
router.get('/audit-files', (req, res) => {
  try {
    const files = fs.readdirSync(config.auditLogDir)
      .filter(f => f.startsWith('audit-') && f.endsWith('.log'))
      .sort().reverse()
      .map(name => {
        const full = path.join(config.auditLogDir, name)
        const st = fs.statSync(full)
        return { name, sizeBytes: st.size, mtime: st.mtime.toISOString() }
      })
    res.json({ files })
  } catch (e) {
    res.json({ files: [], error: e.message })
  }
})

// ─── GET /api/security/audit-file/:name ─ baca activity/audit log ─────────
router.get('/audit-file/:name', (req, res) => {
  const name = String(req.params.name || '')
  if (!/^audit-\d{4}-\d{2}-\d{2}\.log$/.test(name)) {
    return res.status(400).json({ message: 'Nama file tidak valid.' })
  }
  // BUG FIX: config.auditLogDir bisa relatif (mis. './data/logs'). path.join
  // membuang prefix './' sehingga full.startsWith(config.auditLogDir) selalu
  // false → endpoint balas 400 dan Activity Log tampak kosong. Resolve ke
  // absolut dulu supaya perbandingan path-traversal valid.
  const baseDir = path.resolve(config.auditLogDir)
  const full = path.resolve(baseDir, name)
  if (!full.startsWith(baseDir)) {
    return res.status(400).json({ message: 'Path tidak valid.' })
  }
  if (!fs.existsSync(full)) return res.status(404).json({ message: 'File tidak ada.' })

  const tail = Math.min(parseInt(req.query.tail, 10) || 300, 3000)
  try {
    const text = fs.readFileSync(full, 'utf8')
    const lines = text.split('\n').filter(Boolean).slice(-tail)
    const events = []
    for (const l of lines) { try { events.push(JSON.parse(l)) } catch {} }
    res.json({ name, events: events.reverse() })
  } catch (e) {
    res.status(500).json({ message: e.message })
  }
})

module.exports = router
