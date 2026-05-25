const express = require('express')
const os = require('os')

const { runCmdSync } = require('../lib/safeShell')

const router = express.Router()
const isWin = process.platform === 'win32'

// ─── helpers ───────────────────────────────────────────────────────────────
function formatBytes(bytes) {
  if (bytes >= 1e9) return (bytes / 1e9).toFixed(1) + ' GB'
  if (bytes >= 1e6) return (bytes / 1e6).toFixed(1) + ' MB'
  return (bytes / 1e3).toFixed(1) + ' KB'
}

function safe(fn, fallback) { try { return fn() } catch { return fallback } }

function getCpuPercent() {
  // Pure-JS fallback: works everywhere, no shell.
  return safe(() => {
    const cpus = os.cpus()
    let totalIdle = 0, totalTick = 0
    for (const cpu of cpus) {
      for (const t in cpu.times) totalTick += cpu.times[t]
      totalIdle += cpu.times.idle
    }
    return Math.round(100 - (totalIdle / totalTick) * 100)
  }, 0)
}

function getRamInfo() {
  const total = os.totalmem()
  const free = os.freemem()
  const used = total - free
  return {
    ram: Math.round((used / total) * 100),
    ram_used: formatBytes(used),
    ram_total: formatBytes(total),
  }
}

function getDiskInfo() {
  if (isWin) {
    return safe(() => {
      const out = runCmdSync('wmic', ['logicaldisk', 'get', 'size,freespace,caption', '/value'])
      let total = 0, free = 0
      for (const line of out.split('\n')) {
        if (line.startsWith('Size=')) total += parseInt(line.split('=')[1]) || 0
        if (line.startsWith('FreeSpace=')) free += parseInt(line.split('=')[1]) || 0
      }
      const used = total - free
      return { disk: total ? Math.round((used / total) * 100) : 0,
        disk_used: formatBytes(used), disk_total: formatBytes(total) }
    }, { disk: 0, disk_used: '—', disk_total: '—' })
  }
  return safe(() => {
    const out = runCmdSync('df', ['--output=used,size', '--no-header', '/'])
    const [usedK, totalK] = out.trim().split(/\s+/).map(Number)
    return {
      disk: Math.round((usedK / totalK) * 100),
      disk_used: formatBytes(usedK * 1024),
      disk_total: formatBytes(totalK * 1024),
    }
  }, { disk: 0, disk_used: '—', disk_total: '—' })
}

function getUptime() {
  const sec = os.uptime()
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m`
}

function getLoad() { return os.loadavg().map(l => l.toFixed(2)).join(', ') }

// ═════════════════════════════════════════════════════════════════════════
router.get('/quick', (req, res) => {
  res.json({ cpu: getCpuPercent(), ram: getRamInfo().ram })
})

router.get('/stats', (req, res) => {
  res.json({
    cpu: getCpuPercent(),
    ...getRamInfo(),
    ...getDiskInfo(),
    uptime: getUptime(),
    load: getLoad(),
  })
})

const SERVICES = [
  { name: 'genieacs-cwmp', desc: 'TR-069 CWMP Server' },
  { name: 'genieacs-nbi',  desc: 'Northbound Interface API' },
  { name: 'genieacs-fs',   desc: 'File Server' },
  { name: 'mongod',        desc: 'MongoDB Database' },
  { name: 'openvpn@server', desc: 'OpenVPN Server' },
]

router.get('/services', (req, res) => {
  if (isWin) return res.json(SERVICES.map(s => ({ ...s, running: false })))

  const result = SERVICES.map(svc => {
    let running = false
    try {
      runCmdSync('systemctl', ['is-active', '--quiet', svc.name])
      running = true
    } catch {}
    return { ...svc, running }
  })
  res.json(result)
})

router.get('/processes', (req, res) => {
  if (isWin) {
    return res.json([
      { pid: '1234', name: 'node',   cpu: '2.1', mem: '45 MB' },
      { pid: '5678', name: 'mongod', cpu: '0.8', mem: '120 MB' },
    ])
  }

  try {
    const out = runCmdSync('ps', ['axo', 'pid,comm,%cpu,rss', '--sort=-%cpu', '--no-headers'])
    const procs = out.trim().split('\n').slice(0, 8).map(line => {
      const [pid, name, cpu, memKb] = line.trim().split(/\s+/)
      return {
        pid,
        name: (name || '').split('/').pop(),
        cpu,
        mem: formatBytes((parseInt(memKb) || 0) * 1024),
      }
    })
    res.json(procs)
  } catch {
    res.json([])
  }
})

module.exports = router
