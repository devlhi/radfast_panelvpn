/**
 * Provisioning API — server-to-server endpoint for billing system.
 *
 * Authentication: X-API-Key header (validated by provisioningAuth middleware).
 * CSRF is bypassed (no cookie session).
 *
 * Provides:
 *   POST /api/provision/instance   — create a new GenieACS instance
 *   GET  /api/provision/instances  — list provisioned instances
 *   GET  /api/provision/instance/:name — get single instance details
 *   DELETE /api/provision/instance/:name — remove instance
 *
 * Instance naming: only lowercase alphanumeric + dash (max 32 chars).
 * Ports are auto-assigned if not provided (UI=3000+, CWMP=7547+, NBI=CWMP+10, FS=CWMP+20).
 */
const express = require('express')
const fs = require('fs')
const path = require('path')
const { body, param, validationResult } = require('express-validator')

const audit = require('../lib/audit')
const { runCmd, runCmdSync, validateIdent, validatePort } = require('../lib/safeShell')

const router = express.Router()
const REGISTRY = path.join(__dirname, '..', 'data', 'instances.json')

const isWin = process.platform === 'win32'

// ─── Storage: same registry as /api/instances ──────────────────────────────
function readRegistry() {
  if (!fs.existsSync(REGISTRY)) return []
  try { return JSON.parse(fs.readFileSync(REGISTRY, 'utf8')) }
  catch { return [] }
}

function writeRegistry(data) {
  fs.mkdirSync(path.dirname(REGISTRY), { recursive: true, mode: 0o750 })
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
  } catch { return false }
}

function handleValidation(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ message: 'Input tidak valid.', errors: errors.array() })
    return false
  }
  return true
}

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
// POST /api/provision/instance — create GenieACS instance from billing
// ═════════════════════════════════════════════════════════════════════════
router.post(
  '/instance',
  body('name').isString().trim().matches(/^[a-z][a-z0-9-]{0,31}$/),
  body('ui_port').optional().isInt({ min: 1024, max: 65535 }),
  body('cwmp_port').optional().isInt({ min: 1024, max: 65535 }),
  body('db').optional().isString().trim().matches(/^[a-zA-Z0-9_]{1,64}$/),
  async (req, res, next) => {
    if (!handleValidation(req, res)) return
    try {
      const name = validateIdent(req.body.name, 'instance name')

      const instances = readRegistry()
      if (instances.find(i => i.name === name)) {
        return res.status(409).json({
          message: `Instance "${name}" sudah ada.`,
          instance: instances.find(i => i.name === name),
        })
      }

      const uiPort   = req.body.ui_port   ? validatePort(req.body.ui_port)   : nextAvailablePort(instances, 'ui_port',   3000)
      const cwmpPort = req.body.cwmp_port ? validatePort(req.body.cwmp_port) : nextAvailablePort(instances, 'cwmp_port', 7547)
      const db       = req.body.db        ? String(req.body.db)              : autoDbName(name)

      if (uiPort === cwmpPort) {
        return res.status(400).json({ message: 'UI port dan CWMP port tidak boleh sama.' })
      }

      // Cek port collision dengan instance lain
      const portConflict = instances.find(i =>
        i.ui_port === uiPort || i.cwmp_port === cwmpPort || i.cwmp_port === cwmpPort + 10 || i.cwmp_port === cwmpPort + 20
      )
      if (portConflict) {
        return res.status(409).json({
          message: `Port sudah digunakan instance "${portConflict.name}".`,
          conflict: { ui_port: portConflict.ui_port, cwmp_port: portConflict.cwmp_port },
        })
      }

      const nbiPort = cwmpPort + 10
      const fsPort  = cwmpPort + 20

      instances.push({
        name,
        ui_port: uiPort,
        cwmp_port: cwmpPort,
        nbi_port: nbiPort,
        fs_port: fsPort,
        db,
        created: new Date().toISOString(),
        provisioned_by: 'billing-api',
      })
      writeRegistry(instances)

      // ── Create systemd services on Linux ─────────────────────────────
      if (!isWin) {
        try {
          await createSystemdUnit(name, uiPort, cwmpPort, db)
        } catch (e) {
          console.error('[provision] systemd error:', e.message)
          // Instance sudah terdaftar di registry meskipun systemd gagal.
          // Billing bisa retry atau hubungi admin.
        }

        // ── Start all services ─────────────────────────────────────────
        for (const svc of ['cwmp', 'nbi', 'fs', 'ui']) {
          try { await runCmd('systemctl', ['start', `genieacs-${name}-${svc}`]) } catch {}
        }
      }

      audit.record('provision.instance.create', {
        name, uiPort, cwmpPort, nbiPort, fsPort, db,
      }, req)

      res.status(201).json({
        message: 'Instance berhasil dibuat.',
        instance: {
          name,
          ui_port: uiPort,
          cwmp_port: cwmpPort,
          nbi_port: nbiPort,
          fs_port: fsPort,
          db,
          services: {
            ui:   `genieacs-${name}-ui`,
            cwmp: `genieacs-${name}-cwmp`,
            nbi:  `genieacs-${name}-nbi`,
            fs:   `genieacs-${name}-fs`,
          },
          urls: {
            ui: `http://<SERVER_IP>:${uiPort}`,
            cwmp: `http://<SERVER_IP>:${cwmpPort}`,
            nbi: `http://<SERVER_IP>:${nbiPort}`,
          },
        },
      })
    } catch (e) { next(e) }
  },
)

// ═════════════════════════════════════════════════════════════════════════
// GET /api/provision/instances — list all instances with status
// ═════════════════════════════════════════════════════════════════════════
router.get('/instances', (req, res) => {
  const instances = readRegistry()
  const list = instances.map(inst => ({
    name: inst.name,
    ui_port: inst.ui_port,
    cwmp_port: inst.cwmp_port,
    nbi_port: inst.nbi_port || (inst.cwmp_port ? inst.cwmp_port + 10 : null),
    fs_port: inst.fs_port || (inst.cwmp_port ? inst.cwmp_port + 20 : null),
    db: inst.db,
    active: inst.ui_port ? isPortListening(inst.ui_port) : false,
    created: inst.created,
  }))
  res.json({ count: list.length, instances: list })
})

// ═════════════════════════════════════════════════════════════════════════
// GET /api/provision/instance/:name — single instance detail
// ═════════════════════════════════════════════════════════════════════════
router.get(
  '/instance/:name',
  param('name').isString().matches(/^[a-z][a-z0-9-]{0,31}$/),
  (req, res) => {
    if (!handleValidation(req, res)) return
    const name = validateIdent(req.params.name, 'instance name')
    const inst = readRegistry().find(i => i.name === name)
    if (!inst) return res.status(404).json({ message: 'Instance tidak ditemukan.' })

    const nbiPort = inst.nbi_port || (inst.cwmp_port ? inst.cwmp_port + 10 : null)
    const fsPort  = inst.fs_port  || (inst.cwmp_port ? inst.cwmp_port + 20 : null)

    res.json({
      name: inst.name,
      ui_port: inst.ui_port,
      cwmp_port: inst.cwmp_port,
      nbi_port: nbiPort,
      fs_port: fsPort,
      db: inst.db,
      active: inst.ui_port ? isPortListening(inst.ui_port) : false,
      created: inst.created,
      services: {
        ui:   `genieacs-${name}-ui`,
        cwmp: `genieacs-${name}-cwmp`,
        nbi:  `genieacs-${name}-nbi`,
        fs:   `genieacs-${name}-fs`,
      },
    })
  },
)

// ═════════════════════════════════════════════════════════════════════════
// DELETE /api/provision/instance/:name — remove instance
// ═════════════════════════════════════════════════════════════════════════
router.delete(
  '/instance/:name',
  param('name').isString().matches(/^[a-z][a-z0-9-]{0,31}$/),
  async (req, res) => {
    if (!handleValidation(req, res)) return
    const name = validateIdent(req.params.name, 'instance name')
    const list = readRegistry()
    const idx = list.findIndex(i => i.name === name)
    if (idx === -1) return res.status(404).json({ message: 'Instance tidak ditemukan.' })

    if (!isWin) {
      for (const svc of ['ui', 'cwmp', 'nbi', 'fs']) {
        const unit = `genieacs-${name}-${svc}`
        try { await runCmd('systemctl', ['stop', unit]) } catch {}
        try { await runCmd('systemctl', ['disable', unit]) } catch {}
        try { fs.unlinkSync(`/etc/systemd/system/${unit}.service`) } catch {}
      }
      try { await runCmd('systemctl', ['daemon-reload']) } catch {}
    }

    list.splice(idx, 1)
    writeRegistry(list)
    audit.record('provision.instance.delete', { name }, req)
    res.json({ message: `Instance "${name}" dihapus.` })
  },
)

// ═════════════════════════════════════════════════════════════════════════
// POST /api/provision/instance/:name/start | :name/stop
// ═════════════════════════════════════════════════════════════════════════
function makeAction(action) {
  return async (req, res) => {
    if (!handleValidation(req, res)) return
    const name = validateIdent(req.params.name, 'instance name')
    const inst = readRegistry().find(i => i.name === name)
    if (!inst) return res.status(404).json({ message: 'Instance tidak ditemukan.' })

    if (isWin) {
      audit.record(`provision.instance.${action}.dev`, { name }, req)
      return res.json({ message: `${action} command (Windows dev mode).` })
    }

    for (const svc of ['cwmp', 'nbi', 'fs', 'ui']) {
      try { await runCmd('systemctl', [action, `genieacs-${name}-${svc}`]) } catch {}
    }
    audit.record(`provision.instance.${action}`, { name }, req)
    res.json({ message: `Instance ${action}ed.` })
  }
}

router.post(
  '/instance/:name/start',
  param('name').isString().matches(/^[a-z][a-z0-9-]{0,31}$/),
  makeAction('start'),
)
router.post(
  '/instance/:name/stop',
  param('name').isString().matches(/^[a-z][a-z0-9-]{0,31}$/),
  makeAction('stop'),
)

// ─── helpers ─────────────────────────────────────────────────────────────
async function createSystemdUnit(name, uiPort, cwmpPort, db) {
  validateIdent(name, 'instance name')
  validatePort(uiPort); validatePort(cwmpPort)
  if (!/^[a-zA-Z0-9_]+$/.test(db)) throw new Error('invalid db')

  const nbiPort = cwmpPort + 10
  const fsPort  = cwmpPort + 20
  const genieEnv = `GENIEACS_MONGODB_CONNECTION_URL=mongodb://127.0.0.1:27017/${db}`
  const genieBin = '/usr/bin'

  const services = [
    { svc: 'ui',   bin: 'genieacs-ui',   port: uiPort   },
    { svc: 'cwmp', bin: 'genieacs-cwmp', port: cwmpPort },
    { svc: 'nbi',  bin: 'genieacs-nbi',  port: nbiPort  },
    { svc: 'fs',   bin: 'genieacs-fs',   port: fsPort   },
  ]

  for (const { svc, bin, port } of services) {
    const unitName = `genieacs-${name}-${svc}`
    const unit = `[Unit]
Description=GenieACS ${svc.toUpperCase()} — instance ${name} (port ${port})
After=network.target mongod.service
Wants=mongod.service

[Service]
Type=simple
User=genieacs
Environment=${genieEnv}
ExecStart=${genieBin}/${bin} --port ${port}
WorkingDirectory=/var/lib/genieacs
Restart=on-failure
RestartSec=5
StandardOutput=append:/var/log/genieacs/${unitName}.log
StandardError=append:/var/log/genieacs/${unitName}.log

[Install]
WantedBy=multi-user.target
`
    fs.writeFileSync(`/etc/systemd/system/${unitName}.service`, unit, { mode: 0o644 })
  }

  await runCmd('systemctl', ['daemon-reload'])
  for (const { svc } of services) {
    await runCmd('systemctl', ['enable', `genieacs-${name}-${svc}`])
  }
}

module.exports = router
