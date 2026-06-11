/**
 * Provisioning API — server-to-server endpoint for billing system.
 *
 * Linux production mode delegates to canonical scripts in /opt/radfast_acs
 * so API-created instances are fully compatible with multi-proxy + .registry.
 *
 * Windows dev mode keeps legacy JSON registry behavior for local testing.
 */
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
const ACS_APP_DIR = process.env.ACS_APP_DIR || '/opt/genieacs-app'
const ACS_REPO_DIR = process.env.ACS_REPO_DIR || '/opt/radfast_acs'
const ACS_REGISTRY = process.env.ACS_REGISTRY || path.join(ACS_INSTANCES_DIR, '.registry')
const ACS_ADD_INSTANCE_SCRIPT = process.env.ACS_ADD_INSTANCE_SCRIPT || path.join(ACS_REPO_DIR, 'add-instance.sh')
const ACS_REMOVE_INSTANCE_SCRIPT = process.env.ACS_REMOVE_INSTANCE_SCRIPT || path.join(ACS_REPO_DIR, 'remove-instance.sh')

// ─── Legacy JSON storage (Windows dev mode) ────────────────────────────────
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

// ─── Canonical Linux registry (.registry plaintext) ────────────────────────
function readLinuxRegistry() {
  if (!fs.existsSync(ACS_REGISTRY)) return []

  const lines = fs.readFileSync(ACS_REGISTRY, 'utf8')
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(Boolean)

  const items = []
  for (const line of lines) {
    const parts = line.split(/\s+/)
    const name = parts[0]
    if (!name) continue

    const kv = {}
    for (const part of parts.slice(1)) {
      const eq = part.indexOf('=')
      if (eq <= 0) continue
      const key = part.slice(0, eq)
      const val = part.slice(eq + 1)
      kv[key] = val
    }

    const ui = Number.parseInt(kv.UI, 10)
    const cwmp = Number.parseInt(kv.CWMP, 10)
    const nbi = Number.parseInt(kv.NBI, 10)
    const fsPort = Number.parseInt(kv.FS, 10)

    items.push({
      name,
      ui_port: Number.isFinite(ui) ? ui : null,
      cwmp_port: Number.isFinite(cwmp) ? cwmp : null,
      nbi_port: Number.isFinite(nbi) ? nbi : null,
      fs_port: Number.isFinite(fsPort) ? fsPort : null,
      db: kv.DB || null,
      ip: kv.IP || null,
      created: kv.DATE || null,
      source: 'registry',
    })
  }

  return items
}

function readRegistry() {
  return isWin ? readLegacyRegistry() : readLinuxRegistry()
}

function readInstanceEnv(name) {
  const envPath = path.join(ACS_INSTANCES_DIR, name, '.env')
  if (!fs.existsSync(envPath)) return {}

  const env = {}
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    env[key] = val
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
    const out = runCmdSync('systemctl', ['is-active', `genieacs-${name}-${svc}`]).trim()
    return out === 'active'
  } catch {
    return false
  }
}

function handleValidation(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ message: 'Input tidak valid.', errors: errors.array() })
    return false
  }
  return true
}

function toInstanceResponse(inst) {
  const nbiPort = inst.nbi_port || (inst.cwmp_port ? inst.cwmp_port + 10 : null)
  const fsPort = inst.fs_port || (inst.cwmp_port ? inst.cwmp_port + 20 : null)
  const active = isWin
    ? (inst.ui_port ? isPortListening(inst.ui_port) : false)
    : isServiceActive(inst.name, 'ui')

  return {
    name: inst.name,
    ui_port: inst.ui_port,
    cwmp_port: inst.cwmp_port,
    nbi_port: nbiPort,
    fs_port: fsPort,
    db: inst.db,
    ip: inst.ip || null,
    created: inst.created || null,
    active,
    services: {
      ui: `genieacs-${inst.name}-ui`,
      cwmp: `genieacs-${inst.name}-cwmp`,
      nbi: `genieacs-${inst.name}-nbi`,
      fs: `genieacs-${inst.name}-fs`,
    },
  }
}

function mustExist(filePath, label) {
  if (!fs.existsSync(filePath)) {
    const err = new Error(`${label} tidak ditemukan: ${filePath}`)
    err.status = 500
    throw err
  }
}

function runInteractive(file, args, input = '', timeout = 300_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill('SIGKILL')
      const err = new Error(`Command timeout: ${file} ${args.join(' ')}`)
      err.stdout = stdout.slice(-2000)
      err.stderr = stderr.slice(-2000)
      reject(err)
    }, timeout)

    child.stdout.on('data', d => { stdout += d.toString() })
    child.stderr.on('data', d => { stderr += d.toString() })

    child.on('error', err => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      err.stdout = stdout.slice(-2000)
      err.stderr = stderr.slice(-2000)
      reject(err)
    })

    child.on('close', code => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (code === 0) return resolve({ stdout, stderr })

      const err = new Error(`Command failed (${code}): ${file} ${args.join(' ')}`)
      err.code = code
      err.stdout = stdout.slice(-2000)
      err.stderr = stderr.slice(-2000)
      reject(err)
    })

    if (input) child.stdin.write(input)
    child.stdin.end()
  })
}

// ─── Legacy allocator (Windows dev mode) ───────────────────────────────────
function collectUsedPorts(list) {
  const used = new Set()
  for (const i of list) {
    if (i.ui_port) used.add(i.ui_port)
    if (i.cwmp_port) {
      used.add(i.cwmp_port)
      used.add(i.cwmp_port + 10)
      used.add(i.cwmp_port + 20)
    }
    if (i.nbi_port) used.add(i.nbi_port)
    if (i.fs_port) used.add(i.fs_port)
  }
  return used
}

function nextFreeUiPort(used, base = 3000) {
  let p = base
  while (used.has(p) || isPortListening(p)) p++
  return p
}

function nextFreeCwmpPort(used, base = 7547) {
  let p = base
  while (
    used.has(p) || used.has(p + 10) || used.has(p + 20) ||
    isPortListening(p) || isPortListening(p + 10) || isPortListening(p + 20)
  ) {
    p++
  }
  return p
}

function autoDbName(name) {
  return 'genieacs_' + name.replace(/-/g, '_').replace(/[^a-z0-9_]/gi, '')
}

function createLegacyInstance(name, payload) {
  const list = readLegacyRegistry()
  const usedPorts = collectUsedPorts(list)

  const uiPort = payload.ui_port ? validatePort(payload.ui_port) : nextFreeUiPort(usedPorts, 3000)
  const cwmpPort = payload.cwmp_port ? validatePort(payload.cwmp_port) : nextFreeCwmpPort(usedPorts, 7547)
  const nbiPort = cwmpPort + 10
  const fsPort = cwmpPort + 20
  const db = payload.db ? String(payload.db) : autoDbName(name)

  const requestedPorts = [uiPort, cwmpPort, nbiPort, fsPort]
  const conflictedPort = requestedPorts.find(p => usedPorts.has(p) || isPortListening(p))
  if (conflictedPort) {
    const err = new Error(`Port ${conflictedPort} sudah digunakan.`)
    err.status = 409
    throw err
  }

  const row = {
    name,
    ui_port: uiPort,
    cwmp_port: cwmpPort,
    nbi_port: nbiPort,
    fs_port: fsPort,
    db,
    created: new Date().toISOString(),
    provisioned_by: 'billing-api',
    source: 'legacy-json',
  }

  list.push(row)
  writeLegacyRegistry(list)
  return row
}

async function createLinuxInstance(name) {
  mustExist(ACS_ADD_INSTANCE_SCRIPT, 'Script add-instance')
  mustExist(ACS_APP_DIR, 'Folder GenieACS app')
  mustExist(ACS_INSTANCES_DIR, 'Folder instances')

  await runInteractive('bash', [ACS_ADD_INSTANCE_SCRIPT, name], 'Y\n', 600_000)

  const instance = readRegistry().find(i => i.name === name)
  if (!instance) {
    const err = new Error('Instance berhasil dijalankan script, tapi tidak masuk .registry.')
    err.status = 500
    throw err
  }
  return instance
}

async function removeLinuxInstance(name) {
  mustExist(ACS_REMOVE_INSTANCE_SCRIPT, 'Script remove-instance')
  await runInteractive('bash', [ACS_REMOVE_INSTANCE_SCRIPT, name], `${name}\n`, 600_000)
}

// ═════════════════════════════════════════════════════════════════════════
// POST /api/provision/instance — create GenieACS instance from billing
// ═════════════════════════════════════════════════════════════════════════
router.post(
  '/instance',
  body('name').isString().trim().matches(/^[a-z][a-z0-9_-]{1,62}$/),
  body('ui_port').optional().isInt({ min: 1024, max: 65535 }),
  body('cwmp_port').optional().isInt({ min: 1024, max: 65535 }),
  body('db').optional().isString().trim().matches(/^[a-zA-Z0-9_]{1,64}$/),
  async (req, res, next) => {
    if (!handleValidation(req, res)) return

    try {
      const name = validateIdent(req.body.name, 'instance name')
      const existing = readRegistry().find(i => i.name === name)
      if (existing) {
        return res.status(409).json({
          message: `Instance "${name}" sudah ada.`,
          instance: toInstanceResponse(existing),
        })
      }

      let instance

      if (isWin) {
        instance = createLegacyInstance(name, req.body)
      } else {
        if (req.body.ui_port || req.body.cwmp_port || req.body.db) {
          return res.status(400).json({
            message: 'Di Linux production, port/db dikelola otomatis oleh add-instance.sh. Jangan kirim ui_port/cwmp_port/db.',
          })
        }
        instance = await createLinuxInstance(name)
      }

      const env = isWin ? {} : readInstanceEnv(name)
      const responseInstance = {
        ...toInstanceResponse(instance),
        ui_internal: env.RADFAST_UI_INTERNAL ? Number.parseInt(env.RADFAST_UI_INTERNAL, 10) : null,
        nbi_gate_path: env.RADFAST_NBI_GATE_PATH || null,
        urls: {
          ui: instance.ui_port ? `http://${instance.ip || '<SERVER_IP>'}:${instance.ui_port}` : null,
          cwmp: instance.cwmp_port ? `http://${instance.ip || '<SERVER_IP>'}:${instance.cwmp_port}` : null,
          nbi: (instance.ui_port && env.RADFAST_NBI_GATE_PATH)
            ? `http://${instance.ip || '<SERVER_IP>'}:${instance.ui_port}${env.RADFAST_NBI_GATE_PATH}`
            : (instance.nbi_port ? `http://${instance.ip || '<SERVER_IP>'}:${instance.nbi_port}` : null),
        },
      }

      audit.record('provision.instance.create', {
        name,
        uiPort: responseInstance.ui_port,
        cwmpPort: responseInstance.cwmp_port,
        nbiPort: responseInstance.nbi_port,
        fsPort: responseInstance.fs_port,
        db: responseInstance.db,
        source: isWin ? 'legacy-json' : 'radfast_acs',
      }, req)

      // Auto-sync env provisioning ke instance baru. Restart multi-proxy
      // di-defer ke after-response supaya client dapat respons dulu sebelum
      // proxy bounce. Tidak menggagalkan create bila error.
      let pendingProxyRestart = false
      if (!isWin) {
        try {
          const { autoSyncOnCreate } = require('../lib/provisioningSync')
          const sync = await autoSyncOnCreate(name)
          audit.recordSync('provision.instance.autosync', {
            name,
            env_ok: sync.env?.ok || false,
            error: sync.env?.error || null,
          })
          pendingProxyRestart = !!sync.env?.ok
        } catch (syncErr) {
          audit.recordSync('provision.instance.autosync_failed', { name, msg: syncErr.message })
        }
      }

      res.status(201).json({
        message: 'Instance berhasil dibuat.',
        instance: responseInstance,
      })

      if (pendingProxyRestart) {
        res.on('finish', async () => {
          try {
            const { restartMultiProxy } = require('../lib/provisioningSync')
            const r = await restartMultiProxy()
            audit.recordSync('provision.instance.autosync_proxy', { name, ok: r.ok, error: r.error || null })
          } catch (e) {
            audit.recordSync('provision.instance.autosync_proxy_failed', { name, msg: e.message })
          }
        })
      }
    } catch (e) {
      if (!e.status && (e.stderr || e.stdout)) {
        e.status = 500
        e.message = `Provisioning gagal: ${(e.stderr || e.stdout || '').trim().slice(-500)}`
      }
      next(e)
    }
  },
)

// ═════════════════════════════════════════════════════════════════════════
// GET /api/provision/instances — list all instances
// ═════════════════════════════════════════════════════════════════════════
router.get('/instances', (_req, res) => {
  const list = readRegistry().map(toInstanceResponse)
  res.json({ count: list.length, instances: list })
})

// ═════════════════════════════════════════════════════════════════════════
// GET /api/provision/instance/:name — single instance detail
// ═════════════════════════════════════════════════════════════════════════
router.get(
  '/instance/:name',
  param('name').isString().matches(/^[a-z][a-z0-9_-]{1,62}$/),
  (req, res) => {
    if (!handleValidation(req, res)) return

    const name = validateIdent(req.params.name, 'instance name')
    const inst = readRegistry().find(i => i.name === name)
    if (!inst) return res.status(404).json({ message: 'Instance tidak ditemukan.' })

    const env = isWin ? {} : readInstanceEnv(name)
    res.json({
      ...toInstanceResponse(inst),
      ui_internal: env.RADFAST_UI_INTERNAL ? Number.parseInt(env.RADFAST_UI_INTERNAL, 10) : null,
      nbi_gate_path: env.RADFAST_NBI_GATE_PATH || null,
    })
  },
)

// ═════════════════════════════════════════════════════════════════════════
// DELETE /api/provision/instance/:name — remove instance
// ═════════════════════════════════════════════════════════════════════════
router.delete(
  '/instance/:name',
  param('name').isString().matches(/^[a-z][a-z0-9_-]{1,62}$/),
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
        await removeLinuxInstance(name)
      }

      audit.record('provision.instance.delete', {
        name,
        source: isWin ? 'legacy-json' : 'radfast_acs',
      }, req)

      res.json({ message: `Instance "${name}" dihapus.` })
    } catch (e) {
      if (!e.status && (e.stderr || e.stdout)) {
        e.status = 500
        e.message = `Remove instance gagal: ${(e.stderr || e.stdout || '').trim().slice(-500)}`
      }
      next(e)
    }
  },
)

// ═════════════════════════════════════════════════════════════════════════
// POST /api/provision/instance/:name/start | :name/stop
// ═════════════════════════════════════════════════════════════════════════
function makeAction(action) {
  return async (req, res, next) => {
    if (!handleValidation(req, res)) return

    try {
      const name = validateIdent(req.params.name, 'instance name')
      const inst = readRegistry().find(i => i.name === name)
      if (!inst) return res.status(404).json({ message: 'Instance tidak ditemukan.' })

      if (isWin) {
        audit.record(`provision.instance.${action}.dev`, { name }, req)
        return res.json({ message: `${action} command (Windows dev mode).` })
      }

      const failed = []
      for (const svc of ['cwmp', 'nbi', 'fs', 'ui']) {
        try {
          await runCmd('systemctl', [action, `genieacs-${name}-${svc}`], { timeout: 60_000 })
        } catch (e) {
          failed.push({ svc, error: (e.stderr || e.message || '').slice(-300) })
        }
      }

      if (action === 'start') {
        try {
          await runCmd('systemctl', ['restart', 'genieacs-multi-proxy'], { timeout: 60_000 })
        } catch (e) {
          failed.push({ svc: 'multi-proxy', error: (e.stderr || e.message || '').slice(-300) })
        }
      }

      audit.record(`provision.instance.${action}`, { name, failed }, req)

      if (failed.length) {
        return res.status(207).json({
          message: `Instance ${action} dieksekusi dengan beberapa kegagalan service.`,
          failed,
        })
      }

      res.json({ message: `Instance ${action} berhasil.` })
    } catch (e) {
      next(e)
    }
  }
}

router.post(
  '/instance/:name/start',
  param('name').isString().matches(/^[a-z][a-z0-9_-]{1,62}$/),
  makeAction('start'),
)
router.post(
  '/instance/:name/stop',
  param('name').isString().matches(/^[a-z][a-z0-9_-]{1,62}$/),
  makeAction('stop'),
)

// ═════════════════════════════════════════════════════════════════════════
// GET /api/provision/vpn-status — status tunnel + reachability ONT (S2S)
// Dipakai dashboard GenieACS (logo-proxy) untuk menampilkan status VPN ONT.
// Auth = X-API-Key (provisioningAuth), bukan session — beda origin/proses.
// ═════════════════════════════════════════════════════════════════════════
let _buildOntStatus = null
try {
  // Lazy require agar tidak circular & tetap jalan walau vpn.js belum dimuat.
  _buildOntStatus = require('./vpn').buildOntStatus || null
} catch (_) { _buildOntStatus = null }

// Core create/update VPN dari vpn.js (dipakai endpoint provisioning server-to-server).
let _createL2tpUser = null
let _createWgPeer = null
let _updateL2tpRoute = null
let _updateWgPeerRoute = null
try {
  const vpnMod = require('./vpn')
  _createL2tpUser = vpnMod.createL2tpUser || null
  _createWgPeer = vpnMod.createWgPeer || null
  _updateL2tpRoute = vpnMod.updateL2tpRoute || null
  _updateWgPeerRoute = vpnMod.updateWgPeerRoute || null
} catch (_) { _createL2tpUser = null; _createWgPeer = null; _updateL2tpRoute = null; _updateWgPeerRoute = null }

router.get('/vpn-status', (req, res, next) => {
  try {
    if (typeof _buildOntStatus !== 'function') {
      return res.status(503).json({ message: 'VPN status belum tersedia.' })
    }
    // Filter per-instance: hanya akun VPN milik instance pemanggil yang dikembalikan.
    // Nama instance divalidasi dengan pola yang sama seperti registry GenieACS.
    let instanceFilter = ''
    const raw = req.query.instance
    if (typeof raw === 'string' && raw.trim()) {
      if (!/^[a-zA-Z0-9_-]{1,64}$/.test(raw.trim())) {
        return res.status(400).json({ message: 'Parameter instance tidak valid.' })
      }
      instanceFilter = raw.trim()
    }
    const data = _buildOntStatus(instanceFilter)
    audit.record('provision.vpn_status', {
      instance: instanceFilter || 'all',
      l2tp: Array.isArray(data.l2tp) ? data.l2tp.length : 0,
      wireguard: Array.isArray(data.wireguard) ? data.wireguard.length : 0,
    }, req)
    res.json(data)
  } catch (e) {
    next(e)
  }
})

// ═════════════════════════════════════════════════════════════════════════
// POST /api/provision/vpn/route — update static route akun VPN existing.
// Dipakai proxy GenieACS agar tenant hanya bisa set route, bukan create akun.
// ═════════════════════════════════════════════════════════════════════════
router.post(
  '/vpn/route',
  body('type').isString().isIn(['l2tp', 'wireguard']),
  body('name').isString().isLength({ min: 1, max: 64 }),
  body('instance').optional().isString().isLength({ max: 64 }).matches(/^[a-zA-Z0-9_-]*$/),
  body('lan_subnet').optional({ nullable: true }).isString().isLength({ max: 32 }),
  body('ont_ip').optional({ nullable: true }).isString().isLength({ max: 18 }),
  (req, res, next) => {
    if (!handleValidation(req, res)) return
    try {
      if (typeof _updateL2tpRoute !== 'function' || typeof _updateWgPeerRoute !== 'function') {
        return res.status(503).json({ message: 'Update static route VPN belum tersedia.' })
      }
      const type = String(req.body.type || '').trim().toLowerCase()
      const payload = {
        instance: req.body.instance,
        lan_subnet: req.body.lan_subnet,
        ont_ip: req.body.ont_ip,
      }

      let result
      if (type === 'wireguard') {
        payload.name = req.body.name
        result = _updateWgPeerRoute(payload)
      } else {
        payload.username = req.body.name
        result = _updateL2tpRoute(payload)
      }

      if (result.status === 200) {
        audit.record('provision.vpn.route_update', {
          type,
          name: req.body.name,
          instance: req.body.instance || '',
          lan_subnet: result.body.lan_subnet || '',
        }, req)
      }
      res.status(result.status).json(result.body)
    } catch (e) {
      next(e)
    }
  },
)

// ═════════════════════════════════════════════════════════════════════════
// POST /api/provision/vpn/l2tp — buat akun L2TP via API (server-to-server)
// Dipakai sistem billing/portal untuk provisioning VPN otomatis saat order.
// Auth = X-API-Key (provisioningAuth).
// ═════════════════════════════════════════════════════════════════════════
router.post(
  '/vpn/l2tp',
  body('username').isString().matches(/^[a-zA-Z0-9_.-]{1,64}$/),
  body('password').isString().isLength({ min: 8, max: 128 }).matches(/^[\x21\x23-\x5b\x5d-\x7e]+$/),
  body('instance').optional().isString().isLength({ max: 64 }).matches(/^[a-zA-Z0-9_-]*$/),
  body('note').optional().isString().isLength({ max: 200 }),
  body('ros_version').optional().isIn(['6', '7', 6, 7]),
  body('lan_subnet').optional({ nullable: true }).isString().isLength({ max: 32 }),
  body('ont_ip').optional({ nullable: true }).isString().isLength({ max: 18 }),
  body('rate_down').optional({ nullable: true }).isInt({ min: 0, max: 10000 }),
  body('rate_up').optional({ nullable: true }).isInt({ min: 0, max: 10000 }),
  (req, res, next) => {
    if (!handleValidation(req, res)) return
    try {
      if (typeof _createL2tpUser !== 'function') {
        return res.status(503).json({ message: 'VPN provisioning belum tersedia.' })
      }
      const result = _createL2tpUser({
        username: req.body.username,
        password: req.body.password,
        instance: req.body.instance,
        note: req.body.note,
        ros_version: req.body.ros_version,
        lan_subnet: req.body.lan_subnet,
        ont_ip: req.body.ont_ip,
        rate_down: req.body.rate_down,
        rate_up: req.body.rate_up,
        source: 'api',
      })
      if (result.status === 201) {
        audit.record('provision.vpn.l2tp_create', {
          username: req.body.username,
          instance: req.body.instance || '',
          ros: result.body.ros_version,
          lan_subnet: result.body.lan_subnet || '',
        }, req)
      }
      res.status(result.status).json(result.body)
    } catch (e) {
      next(e)
    }
  },
)

// ═════════════════════════════════════════════════════════════════════════
// POST /api/provision/vpn/wireguard — buat peer WireGuard via API (S2S)
// Auth = X-API-Key (provisioningAuth).
// ═════════════════════════════════════════════════════════════════════════
router.post(
  '/vpn/wireguard',
  body('name').isString().matches(/^[a-z][a-z0-9-]{0,40}$/),
  body('instance').optional().isString().isLength({ max: 64 }).matches(/^[a-zA-Z0-9_-]*$/),
  body('note').optional().isString().isLength({ max: 200 }),
  body('lan_subnet').optional({ nullable: true }).isString().isLength({ max: 32 }),
  body('ont_ip').optional({ nullable: true }).isString().isLength({ max: 18 }),
  body('rate_down').optional({ nullable: true }).isInt({ min: 0, max: 10000 }),
  body('rate_up').optional({ nullable: true }).isInt({ min: 0, max: 10000 }),
  async (req, res, next) => {
    if (!handleValidation(req, res)) return
    try {
      if (typeof _createWgPeer !== 'function') {
        return res.status(503).json({ message: 'VPN provisioning belum tersedia.' })
      }
      const result = await _createWgPeer({
        name: req.body.name,
        instance: req.body.instance,
        note: req.body.note,
        ros_version: req.body.ros_version,
        lan_subnet: req.body.lan_subnet,
        ont_ip: req.body.ont_ip,
        rate_down: req.body.rate_down,
        rate_up: req.body.rate_up,
        source: 'api',
      })
      if (result.status === 201) {
        audit.record('provision.vpn.wg_create', {
          name: req.body.name,
          instance: req.body.instance || '',
          peerIP: result.body.peer ? result.body.peer.peer_ip : '',
          lan_subnet: result.body.peer ? (result.body.peer.lan_subnet || '') : '',
        }, req)
      }
      res.status(result.status).json(result.body)
    } catch (e) {
      next(e)
    }
  },
)

module.exports = router
