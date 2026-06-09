const express = require('express')
const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const { body, param, validationResult } = require('express-validator')

const audit = require('../lib/audit')
const { runCmd, runCmdSync, validateIdent, validatePort } = require('../lib/safeShell')

const router = express.Router()

const LEGACY_REGISTRY = path.join(__dirname, '..', 'data', 'instances.json')
const isWin = process.platform === 'win32'

const ACS_INSTANCES_DIR = process.env.ACS_INSTANCES_DIR || '/opt/genieacs-instances'
const ACS_REPO_DIR = process.env.ACS_REPO_DIR || '/opt/radfast_acs'
const ACS_REGISTRY = process.env.ACS_REGISTRY || path.join(ACS_INSTANCES_DIR, '.registry')
const ACS_ADD_INSTANCE_SCRIPT = process.env.ACS_ADD_INSTANCE_SCRIPT || path.join(ACS_REPO_DIR, 'add-instance.sh')
const ACS_REMOVE_INSTANCE_SCRIPT = process.env.ACS_REMOVE_INSTANCE_SCRIPT || path.join(ACS_REPO_DIR, 'remove-instance.sh')

function readLegacyRegistry() {
  if (!fs.existsSync(LEGACY_REGISTRY)) return []
  try { return JSON.parse(fs.readFileSync(LEGACY_REGISTRY, 'utf8')) }
  catch { return [] }
}

function writeLegacyRegistry(data) {
  fs.mkdirSync(path.dirname(LEGACY_REGISTRY), { recursive: true, mode: 0o750 })
  const tmp = LEGACY_REGISTRY + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o640 })
  fs.renameSync(tmp, LEGACY_REGISTRY)
}

function readLinuxRegistry() {
  if (!fs.existsSync(ACS_REGISTRY)) return []

  return fs.readFileSync(ACS_REGISTRY, 'utf8')
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split(/\s+/)
      const name = parts[0]
      const kv = {}
      for (const part of parts.slice(1)) {
        const eq = part.indexOf('=')
        if (eq > 0) kv[part.slice(0, eq)] = part.slice(eq + 1)
      }
      return {
        name,
        ui_port: num(kv.UI),
        cwmp_port: num(kv.CWMP),
        nbi_port: num(kv.NBI),
        fs_port: num(kv.FS),
        db: kv.DB || null,
        ip: kv.IP || null,
        created: kv.DATE || null,
        source: 'registry',
      }
    })
    .filter(i => i.name)
}

function readRegistry() {
  return isWin ? readLegacyRegistry() : readLinuxRegistry()
}

function num(value) {
  const n = Number.parseInt(value, 10)
  return Number.isFinite(n) ? n : null
}

function readInstanceEnv(name) {
  const file = path.join(ACS_INSTANCES_DIR, name, '.env')
  if (!fs.existsSync(file)) return {}

  const env = {}
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq > 0) env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1)
  }
  return env
}

function isPortListening(port) {
  port = validatePort(port)
  try {
    if (isWin) {
      const out = runCmdSync('netstat', ['-ano'])
      return new RegExp(`[: ]${port}\\b`).test(out)
    }
    runCmdSync('ss', ['-ltn', `sport = :${port}`])
    return true
  } catch {
    return false
  }
}

function isServiceActive(name, svc = 'ui') {
  if (isWin) return false
  try {
    return runCmdSync('systemctl', ['is-active', `genieacs-${name}-${svc}`]).trim() === 'active'
  } catch {
    return false
  }
}

function handleValidation(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ message: 'Input tidak valid.' })
    return false
  }
  return true
}

function toResponse(inst) {
  const env = isWin ? {} : readInstanceEnv(inst.name)
  return {
    name: inst.name,
    ui_port: inst.ui_port,
    cwmp_port: inst.cwmp_port,
    nbi_port: inst.nbi_port || (inst.cwmp_port ? inst.cwmp_port + 10 : null),
    fs_port: inst.fs_port || (inst.cwmp_port ? inst.cwmp_port + 20 : null),
    ui_internal: env.RADFAST_UI_INTERNAL ? num(env.RADFAST_UI_INTERNAL) : null,
    nbi_gate_path: env.RADFAST_NBI_GATE_PATH || null,
    nbi_proxy_port: env.RADFAST_NBI_PROXY_PORT ? num(env.RADFAST_NBI_PROXY_PORT) : null,
    db: inst.db,
    ip: inst.ip || null,
    created: inst.created || null,
    active: isWin ? (inst.ui_port ? isPortListening(inst.ui_port) : false) : isServiceActive(inst.name, 'ui'),
    source: inst.source || (isWin ? 'legacy-json' : 'registry'),
  }
}

function runInteractive(file, args, input = '', timeout = 600_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let done = false

    const finish = (err, result) => {
      if (done) return
      done = true
      clearTimeout(timer)
      try { child.stdin.destroy() } catch {}
      if (err) {
        err.stdout = stdout.slice(-2000)
        err.stderr = stderr.slice(-2000)
        return reject(err)
      }
      resolve(result)
    }

    const timer = setTimeout(() => {
      try { child.kill('SIGKILL') } catch {}
      finish(new Error(`Command timeout: ${file} ${args.join(' ')}`))
    }, timeout)

    child.stdout.on('data', d => { stdout += d.toString() })
    child.stderr.on('data', d => { stderr += d.toString() })
    // Attach error handlers to ALL streams to prevent EPIPE crashing the process
    child.stdout.on('error', () => {})
    child.stderr.on('error', () => {})
    child.stdin.on('error', () => {})
    child.on('error', err => finish(err))
    child.on('close', code => {
      if (code === 0) return finish(null, { stdout, stderr })
      finish(new Error(`Command failed (${code}): ${file} ${args.join(' ')}`))
    })

    // Write input safely — if pipe already closed, error event handler swallows it
    try {
      if (input) child.stdin.write(input)
      child.stdin.end()
    } catch {
      // ignore — close/error event will resolve the promise
    }
  })
}

function nextAvailablePort(list, field, base) {
  const used = new Set(list.map(i => i[field]).filter(Boolean))
  let p = base
  while (used.has(p) || isPortListening(p)) p++
  return p
}

function autoDbName(name) {
  return 'genieacs_' + name.replace(/-/g, '_').replace(/[^a-z0-9_]/gi, '')
}

// GET /api/instances — dashboard list. Linux uses the real .registry only.
router.get('/', (_req, res) => {
  res.json(readRegistry().map(toResponse))
})

// GET /api/instances/preview?name=xxx
router.get('/preview', (req, res) => {
  const name = String(req.query.name || '').trim()
  const instances = readRegistry()
  const uiPort = nextAvailablePort(instances, 'ui_port', isWin ? 3000 : 3001)
  const cwmpPort = nextAvailablePort(instances, 'cwmp_port', isWin ? 7547 : 7548)
  res.json({ ui_port: uiPort, cwmp_port: cwmpPort, db: name ? autoDbName(name) : 'genieacs_...' })
})

// POST /api/instances — dashboard create. Linux delegates to add-instance.sh.
router.post(
  '/',
  body('name').isString().trim().matches(/^[a-z][a-z0-9_-]{0,62}$/),
  body('ui_port').optional().isInt({ min: 1024, max: 65535 }),
  body('cwmp_port').optional().isInt({ min: 1024, max: 65535 }),
  body('db').optional().isString().trim().matches(/^[a-zA-Z0-9_]{1,64}$/),
  async (req, res, next) => {
    if (!handleValidation(req, res)) return
    try {
      const name = validateIdent(req.body.name, 'instance name')
      if (readRegistry().find(i => i.name === name)) {
        return res.status(409).json({ message: `Instance "${name}" sudah ada.` })
      }

      let inst
      if (isWin) {
        const list = readLegacyRegistry()
        const uiPort = req.body.ui_port ? validatePort(req.body.ui_port) : nextAvailablePort(list, 'ui_port', 3000)
        const cwmpPort = req.body.cwmp_port ? validatePort(req.body.cwmp_port) : nextAvailablePort(list, 'cwmp_port', 7547)
        inst = {
          name,
          ui_port: uiPort,
          cwmp_port: cwmpPort,
          nbi_port: cwmpPort + 10,
          fs_port: cwmpPort + 20,
          db: req.body.db ? String(req.body.db) : autoDbName(name),
          created: new Date().toISOString(),
          source: 'legacy-json',
        }
        list.push(inst)
        writeLegacyRegistry(list)
      } else {
        if (req.body.ui_port || req.body.cwmp_port || req.body.db) {
          return res.status(400).json({ message: 'Port/db di Linux dikelola otomatis oleh add-instance.sh.' })
        }
        if (!fs.existsSync(ACS_ADD_INSTANCE_SCRIPT)) {
          return res.status(500).json({ message: `Script add-instance tidak ditemukan: ${ACS_ADD_INSTANCE_SCRIPT}` })
        }
        await runInteractive('bash', [ACS_ADD_INSTANCE_SCRIPT, name], 'Y\n', 170_000)
        inst = readRegistry().find(i => i.name === name)
      }

      if (!inst) return res.status(500).json({ message: 'Instance dibuat tapi tidak ditemukan di registry.' })

      audit.record('instance.create', { name, source: isWin ? 'legacy-json' : 'radfast_acs' }, req)
      res.status(201).json({ message: 'Instance berhasil dibuat.', ...toResponse(inst) })
    } catch (e) {
      if (!e.status && (e.stderr || e.stdout)) {
        e.status = 500
        e.message = `Create instance gagal: ${(e.stderr || e.stdout || '').trim().slice(-500)}`
      }
      next(e)
    }
  },
)

function makeAction(action) {
  return async (req, res, next) => {
    if (!handleValidation(req, res)) return
    try {
      const name = validateIdent(req.params.name, 'instance name')
      if (!readRegistry().find(i => i.name === name)) return res.status(404).json({ message: 'Instance tidak ditemukan.' })

      if (isWin) {
        audit.record(`instance.${action}.dev`, { name }, req)
        return res.json({ message: `${action} command (Windows dev mode).` })
      }

      const failed = []
      for (const svc of ['cwmp', 'nbi', 'fs', 'ui']) {
        try { await runCmd('systemctl', [action, `genieacs-${name}-${svc}`], { timeout: 60_000 }) }
        catch (e) { failed.push({ svc, error: (e.stderr || e.message || '').slice(-300) }) }
      }
      // CATATAN: multi-proxy TIDAK lagi di-restart otomatis di sini.
      // Alasan: restart multi-proxy memutus koneksi panel sendiri (panel
      // disajikan lewat genieacs-multi-proxy), sehingga frontend bisa
      // tampak crash padahal proxy sedang restart. Admin harus klik
      // tombol "Restart Proxy" terpisah saat butuh refresh routing.

      audit.record(`instance.${action}`, { name, failed }, req)
      if (failed.length) return res.status(207).json({ message: `Instance ${action} dieksekusi dengan beberapa kegagalan.`, failed })
      res.json({ message: `Instance ${action} berhasil.` })
    } catch (e) {
      next(e)
    }
  }
}

// POST /api/instances/multi-proxy/restart — restart hanya genieacs-multi-proxy.
// Berguna kalau setelah edit registry/port routing terlihat tidak update.
router.post('/multi-proxy/restart', async (req, res, next) => {
  try {
    if (isWin) {
      audit.record('instance.multi_proxy.restart.dev', {}, req)
      return res.json({ ok: true, message: 'multi-proxy restart (Windows dev mode).' })
    }

    // Cek apakah service ada sebelum restart
    let svcExists = false
    try {
      const out = await runCmd('systemctl', ['list-unit-files', 'genieacs-multi-proxy.service'], { timeout: 10_000 })
      svcExists = out.stdout.includes('genieacs-multi-proxy.service')
    } catch { /* ignore */ }

    if (!svcExists) {
      return res.status(404).json({ ok: false, message: 'Service genieacs-multi-proxy tidak ditemukan di VPS ini.' })
    }

    await runCmd('systemctl', ['restart', 'genieacs-multi-proxy'], { timeout: 60_000 })
    audit.record('instance.multi_proxy.restart', {}, req)
    res.json({ ok: true, message: 'genieacs-multi-proxy berhasil di-restart.' })
  } catch (e) {
    const detail = (e.stderr || e.stdout || '').trim().slice(-500)
    e.status = 500
    e.message = detail ? `Restart multi-proxy gagal: ${detail}` : 'Restart multi-proxy gagal (timeout atau service error).'
    next(e)
  }
})

// CATATAN: route ":name" HARUS didefinisikan SETELAH "/multi-proxy/restart"
// supaya request /multi-proxy/restart tidak ke-shadow oleh ":name" (string
// "multi-proxy" lolos regex param name).
router.post('/:name/start', param('name').matches(/^[a-z][a-z0-9_-]{0,62}$/), makeAction('start'))
router.post('/:name/stop', param('name').matches(/^[a-z][a-z0-9_-]{0,62}$/), makeAction('stop'))
router.post('/:name/restart', param('name').matches(/^[a-z][a-z0-9_-]{0,62}$/), makeAction('restart'))

// DELETE /api/instances/:name. Linux delegates to remove-instance.sh.
router.delete(
  '/:name',
  param('name').matches(/^[a-z][a-z0-9_-]{0,62}$/),
  async (req, res, next) => {
    if (!handleValidation(req, res)) return
    try {
      const name = validateIdent(req.params.name, 'instance name')
      const list = readRegistry()
      const idx = list.findIndex(i => i.name === name)
      if (idx === -1) return res.status(404).json({ message: 'Instance tidak ditemukan.' })

      if (isWin) {
        list.splice(idx, 1)
        writeLegacyRegistry(list)
      } else {
        if (!fs.existsSync(ACS_REMOVE_INSTANCE_SCRIPT)) {
          return res.status(500).json({ message: `Script remove-instance tidak ditemukan: ${ACS_REMOVE_INSTANCE_SCRIPT}` })
        }
        await runInteractive('bash', [ACS_REMOVE_INSTANCE_SCRIPT, name], `${name}\n`)
      }

      audit.record('instance.delete', { name, source: isWin ? 'legacy-json' : 'radfast_acs' }, req)
      res.json({ message: 'Instance dihapus.' })
    } catch (e) {
      if (!e.status && (e.stderr || e.stdout)) {
        e.status = 500
        e.message = `Delete instance gagal: ${(e.stderr || e.stdout || '').trim().slice(-500)}`
      }
      next(e)
    }
  },
)

module.exports = router
