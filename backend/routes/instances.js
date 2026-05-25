const express = require('express')
const fs = require('fs')
const path = require('path')
const { body, param, validationResult } = require('express-validator')

const audit = require('../lib/audit')
const { runCmd, runCmdSync, validateIdent, validatePort } = require('../lib/safeShell')

const router = express.Router()
const REGISTRY = path.join(__dirname, '..', 'data', 'instances.json')

const isWin = process.platform === 'win32'

// ─── Storage helpers ──────────────────────────────────────────────────────
function readRegistry() {
  if (!fs.existsSync(REGISTRY)) return []
  try { return JSON.parse(fs.readFileSync(REGISTRY, 'utf8')) }
  catch { return [] }
}

function writeRegistry(data) {
  fs.mkdirSync(path.dirname(REGISTRY), { recursive: true, mode: 0o750 })
  // Atomic-ish write: tmp + rename
  const tmp = REGISTRY + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o640 })
  fs.renameSync(tmp, REGISTRY)
}

function isPortListening(port) {
  port = validatePort(port)
  try {
    if (isWin) {
      const out = runCmdSync('netstat', ['-ano'])
      return new RegExp(`[: ]${port}\\b`).test(out)
    } else {
      runCmdSync('ss', ['-ltn', `sport = :${port}`])
      return true
    }
  } catch {
    return false
  }
}

// ─── Validation helpers ───────────────────────────────────────────────────
function handleValidation(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ message: 'Input tidak valid.' })
    return false
  }
  return true
}

// ═════════════════════════════════════════════════════════════════════════
// GET /api/instances
// ═════════════════════════════════════════════════════════════════════════
router.get('/', (req, res) => {
  const list = readRegistry().map(inst => ({
    ...inst,
    active: isPortListening(inst.ui_port),
  }))
  res.json(list)
})

// ─── Auto-assign helpers ──────────────────────────────────────────────────
function nextAvailablePort(list, field, base) {
  if (!list.length) return base
  const used = new Set(list.map(i => i[field]))
  let p = base
  while (used.has(p)) p++
  return p
}

function autoDbName(name) {
  return 'genieacs_' + name.replace(/-/g, '_').replace(/[^a-z0-9_]/gi, '')
}

// ═════════════════════════════════════════════════════════════════════════
// GET /api/instances/preview?name=xxx  — preview auto values before create
// ═════════════════════════════════════════════════════════════════════════
router.get('/preview', (req, res) => {
  const name = String(req.query.name || '').trim()
  const instances = readRegistry()
  const uiPort   = nextAvailablePort(instances, 'ui_port',   3000)
  const cwmpPort = nextAvailablePort(instances, 'cwmp_port', 7547)
  const db       = name ? autoDbName(name) : 'genieacs_...'
  res.json({ ui_port: uiPort, cwmp_port: cwmpPort, db })
})

// ═════════════════════════════════════════════════════════════════════════
// POST /api/instances — create (only name required, rest auto-assigned)
// ═════════════════════════════════════════════════════════════════════════
router.post(
  '/',
  body('name').isString().trim().matches(/^[a-z][a-z0-9-]{0,30}$/),
  // ui_port / cwmp_port / db are optional — auto-assigned if omitted
  body('ui_port').optional().isInt({ min: 1024, max: 65535 }),
  body('cwmp_port').optional().isInt({ min: 1024, max: 65535 }),
  body('db').optional().isString().trim().matches(/^[a-zA-Z0-9_]{1,64}$/),
  async (req, res, next) => {
    if (!handleValidation(req, res)) return
    try {
      const name = validateIdent(req.body.name, 'instance name')

      const instances = readRegistry()
      if (instances.find(i => i.name === name)) {
        return res.status(409).json({ message: `Instance "${name}" sudah ada.` })
      }

      // Auto-assign if caller didn't send them
      const uiPort   = req.body.ui_port   ? validatePort(req.body.ui_port)   : nextAvailablePort(instances, 'ui_port',   3000)
      const cwmpPort = req.body.cwmp_port ? validatePort(req.body.cwmp_port) : nextAvailablePort(instances, 'cwmp_port', 7547)
      const db       = req.body.db        ? String(req.body.db)              : autoDbName(name)

      if (uiPort === cwmpPort) {
        return res.status(400).json({ message: 'UI port dan CWMP port tidak boleh sama.' })
      }
      if (instances.find(i => i.ui_port === uiPort || i.cwmp_port === cwmpPort)) {
        return res.status(409).json({ message: 'Port sudah digunakan instance lain.' })
      }

      instances.push({ name, ui_port: uiPort, cwmp_port: cwmpPort, db, created: new Date().toISOString() })
      writeRegistry(instances)

      if (!isWin) {
        try { await createSystemdUnit(name, uiPort, cwmpPort, db) }
        catch (e) { console.error('systemd:', e.message) }
      }

      audit.record('instance.create', { name, uiPort, cwmpPort, db }, req)
      res.status(201).json({ message: 'Instance berhasil dibuat.', name, ui_port: uiPort, cwmp_port: cwmpPort, db })
    } catch (e) { next(e) }
  },
)

// ═════════════════════════════════════════════════════════════════════════
// POST /api/instances/:name/start | /stop
// ═════════════════════════════════════════════════════════════════════════
function makeAction(action) {
  return async (req, res, next) => {
    if (!handleValidation(req, res)) return
    try {
      const name = validateIdent(req.params.name, 'instance name')
      const inst = readRegistry().find(i => i.name === name)
      if (!inst) return res.status(404).json({ message: 'Instance tidak ditemukan.' })

      if (isWin) {
        audit.record(`instance.${action}.dev`, { name }, req)
        return res.json({ message: `${action} command (Windows dev mode).` })
      }

      await runCmd('systemctl', [action, `genieacs-${name}`])
      audit.record(`instance.${action}`, { name }, req)
      res.json({ message: `Instance ${action}ed.` })
    } catch (e) {
      const msg = e.code ? `Gagal ${action}: exit ${e.code}` : `Gagal ${action}.`
      res.status(500).json({ message: msg })
    }
  }
}

router.post('/:name/start', param('name').matches(/^[a-z][a-z0-9-]{0,30}$/), makeAction('start'))
router.post('/:name/stop',  param('name').matches(/^[a-z][a-z0-9-]{0,30}$/), makeAction('stop'))

// ═════════════════════════════════════════════════════════════════════════
// DELETE /api/instances/:name
// ═════════════════════════════════════════════════════════════════════════
router.delete(
  '/:name',
  param('name').matches(/^[a-z][a-z0-9-]{0,30}$/),
  async (req, res, next) => {
    if (!handleValidation(req, res)) return
    try {
      const name = validateIdent(req.params.name, 'instance name')
      const list = readRegistry()
      const idx = list.findIndex(i => i.name === name)
      if (idx === -1) return res.status(404).json({ message: 'Instance tidak ditemukan.' })

      if (!isWin) {
        const unit = `genieacs-${name}`
        try { await runCmd('systemctl', ['stop', unit]) } catch {}
        try { await runCmd('systemctl', ['disable', unit]) } catch {}
        try { fs.unlinkSync(`/etc/systemd/system/${unit}.service`) } catch {}
        try { await runCmd('systemctl', ['daemon-reload']) } catch {}
      }

      list.splice(idx, 1)
      writeRegistry(list)
      audit.record('instance.delete', { name }, req)
      res.json({ message: 'Instance dihapus.' })
    } catch (e) { next(e) }
  },
)

// ─── helpers ───────────────────────────────────────────────────────────────
async function createSystemdUnit(name, uiPort, cwmpPort, db) {
  // All values were validated by validators above — still defense-in-depth here.
  validateIdent(name, 'instance name')
  validatePort(uiPort); validatePort(cwmpPort)
  if (!/^[a-zA-Z0-9_]+$/.test(db)) throw new Error('invalid db')

  const unit = `[Unit]
Description=GenieACS Instance - ${name}
After=network.target mongod.service

[Service]
Type=simple
User=genieacs
ExecStart=/usr/bin/genieacs-nbi --port ${uiPort}
Environment=GENIEACS_MONGODB_CONNECTION_URL=mongodb://localhost:27017/${db}
Restart=on-failure

[Install]
WantedBy=multi-user.target
`
  fs.writeFileSync(`/etc/systemd/system/genieacs-${name}.service`, unit, { mode: 0o644 })
  await runCmd('systemctl', ['daemon-reload'])
  await runCmd('systemctl', ['enable', `genieacs-${name}`])
}

module.exports = router
