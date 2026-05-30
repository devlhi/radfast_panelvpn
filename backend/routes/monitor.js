const express = require('express')
const os = require('os')

const { runCmd, runCmdSync } = require('../lib/safeShell')
const { param } = require('express-validator')

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

// ─── Network traffic (per-interface) ───────────────────────────────────────
// Baca counter RX/TX dari /proc/net/dev lalu hitung laju (bytes/detik) dari
// selisih antar-sampel. State disimpan di memori antar request.
const fs = require('fs')
let prevNet = { time: 0, ifaces: {} }

function readProcNetDev() {
  const out = fs.readFileSync('/proc/net/dev', 'utf8')
  const lines = out.trim().split('\n').slice(2) // buang 2 baris header
  const result = {}
  for (const line of lines) {
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const name = line.slice(0, idx).trim()
    const cols = line.slice(idx + 1).trim().split(/\s+/).map(Number)
    // cols[0] = RX bytes, cols[8] = TX bytes
    result[name] = { rx: cols[0] || 0, tx: cols[8] || 0 }
  }
  return result
}

function isVirtualIface(name) {
  return name === 'lo' ||
    /^(veth|br-|docker|virbr|vmnet|tun|tap|wg|kube|cni|flannel|cali)/.test(name)
}

function getNetworkInfo() {
  if (isWin) return []
  return safe(() => {
    const now = Date.now()
    const cur = readProcNetDev()
    const ifaceAddrs = os.networkInterfaces()
    const dt = prevNet.time ? (now - prevNet.time) / 1000 : 0
    const list = []

    for (const [name, val] of Object.entries(cur)) {
      if (isVirtualIface(name)) continue

      const prev = prevNet.ifaces[name]
      let rxSec = 0, txSec = 0
      if (prev && dt > 0) {
        rxSec = Math.max(0, (val.rx - prev.rx) / dt)
        txSec = Math.max(0, (val.tx - prev.tx) / dt)
      }

      const addrs = ifaceAddrs[name] || []
      const ipv4 = addrs.find(a => a.family === 'IPv4' || a.family === 4)

      list.push({
        name,
        ip: ipv4 ? ipv4.address : null,
        mac: ipv4 ? ipv4.mac : (addrs[0] ? addrs[0].mac : null),
        up: !!ipv4,
        rx_sec: Math.round(rxSec),
        tx_sec: Math.round(txSec),
        rx_total: val.rx,
        tx_total: val.tx,
      })
    }

    prevNet = { time: now, ifaces: cur }

    // Interface dengan IP & traffic tertinggi tampil dulu.
    list.sort((a, b) => (b.up - a.up) || ((b.rx_sec + b.tx_sec) - (a.rx_sec + a.tx_sec)))
    return list
  }, [])
}

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
    net: getNetworkInfo(),
  })
})

router.get('/network', (req, res) => {
  res.json(getNetworkInfo())
})

// ─── ACS admin actions ──────────────────────────────────────
const ACS_REPO = process.env.RADFAST_ACS_REPO || '/opt/radfast_acs'

router.post('/acs/enable-multi-proxy', async (req, res) => {
  if (isWin) return res.status(501).json({ message: 'Hanya tersedia di Linux.' })
  try {
    const { stdout, stderr } = await runCmd('bash', [`${ACS_REPO}/enable-multi-proxy.sh`], { timeout: 180_000 })
    res.json({ message: 'enable-multi-proxy selesai.', stdout: stdout.slice(-3000), stderr: stderr.slice(-1000) })
  } catch (e) {
    res.status(500).json({ message: (e.stderr || e.message || '').slice(-1000) })
  }
})

router.post('/processes/:pid/kill',
  param('pid').isInt({ min: 2, max: 4194304 }).toInt(),
  async (req, res) => {
    if (isWin) return res.status(501).json({ message: 'Hanya tersedia di Linux.' })
    const pid = req.params.pid
    if (pid === process.ppid || pid === process.pid) {
      return res.status(400).json({ message: 'Tidak boleh kill proses backend ini.' })
    }
    const force = !!req.body?.force
    const sig = force ? '-9' : '-15'
    try {
      await runCmd('kill', [sig, String(pid)], { timeout: 10_000 })
      res.json({ message: `Signal ${force ? 'SIGKILL' : 'SIGTERM'} dikirim ke PID ${pid}.` })
    } catch (e) {
      if ((e.stderr || '').includes('No such process')) {
        res.json({ message: `PID ${pid} sudah tidak aktif.` })
      } else {
        res.status(500).json({ message: (e.stderr || e.message || '').slice(-500) })
      }
    }
  },
)

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
