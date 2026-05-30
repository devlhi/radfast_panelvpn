const express = require('express')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { body, param, validationResult } = require('express-validator')

const audit = require('../lib/audit')
const {
  runCmd, runCmdSync,
  validateIdent, validateUsername, validatePort,
} = require('../lib/safeShell')

const router = express.Router()

const DATA_DIR = path.join(__dirname, '..', 'data')
const L2TP_USERS_FILE = path.join(DATA_DIR, 'l2tp-users.json')
const L2TP_CFG_FILE   = path.join(DATA_DIR, 'l2tp-config.json')
const WG_PEERS_FILE   = path.join(DATA_DIR, 'wg-peers.json')
const WG_CFG_FILE     = path.join(DATA_DIR, 'wg-config.json')
const VPN_DATA        = path.join(DATA_DIR, 'vpn-clients.json')

const isWin = process.platform === 'win32'
const isLinux = process.platform === 'linux'

// ─── helpers ───────────────────────────────────────────────────────────────
function readJSON(file) {
  if (!fs.existsSync(file)) return []
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return [] }
}

function writeJSON(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o750 })
  const tmp = file + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o640 })
  fs.renameSync(tmp, file)
}

function getServerIP() {
  if (isWin) return '127.0.0.1'
  try {
    return runCmdSync('hostname', ['-I']).trim().split(/\s+/)[0] || 'YOUR_SERVER_IP'
  } catch {
    return 'YOUR_SERVER_IP'
  }
}

function svcRunning(name) {
  if (!isLinux) return false
  // Systemd service names can contain '@' for template units (e.g. wg-quick@wg0)
  // Use a dedicated regex instead of validateIdent which doesn't allow '@'
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_@.-]{0,99}$/.test(String(name))) return false
  try { runCmdSync('systemctl', ['is-active', '--quiet', name]); return true }
  catch { return false }
}

function randomPSK() { return crypto.randomBytes(16).toString('hex') }

function handleValidation(req, res) {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    res.status(400).json({ message: 'Input tidak valid.' })
    return false
  }
  return true
}

const safeNote = (s) => String(s || '').slice(0, 200).replace(/[\x00-\x1f\x7f]/g, '')

// ─── IP pool helpers ─────────────────────────────────────────────────────
/** Validasi satu alamat IPv4 (mis. 192.168.42.10). */
function isValidIPv4(ip) {
  const m = String(ip).match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return false
  return m.slice(1).every((o) => { const n = Number(o); return n >= 0 && n <= 255 })
}

/** Validasi subnet /24 (mis. 192.168.42.0/24). Hanya /24 yang didukung. */
function isValidCidr24(s) {
  const m = String(s).match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.0\/24$/)
  if (!m) return false
  return m.slice(1, 4).every((o) => { const n = Number(o); return n >= 0 && n <= 255 })
}

/** Ambil prefix "a.b.c." dari subnet "a.b.c.0/24", atau null jika invalid. */
function cidr24Prefix(subnet) {
  const m = String(subnet).match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.0\/24$/)
  return m ? m[1] + '.' : null
}

/** Default IP pool L2TP. */
function l2tpPoolDefaults() {
  return {
    subnet:      '192.168.42.0/24',
    local_ip:    '192.168.42.1',
    range_start: '192.168.42.10',
    range_end:   '192.168.42.100',
  }
}

/** Tulis /etc/xl2tpd/xl2tpd.conf dari konfigurasi pool & restart xl2tpd. */
function writeXl2tpdConf(cfg) {
  if (!isLinux) return
  const d = l2tpPoolDefaults()
  const localIp    = cfg.local_ip    || d.local_ip
  const rangeStart = cfg.range_start || d.range_start
  const rangeEnd   = cfg.range_end   || d.range_end
  try {
    fs.mkdirSync('/etc/xl2tpd', { recursive: true })
    fs.writeFileSync('/etc/xl2tpd/xl2tpd.conf', [
      '[global]', 'port = 1701', '',
      '[lns default]',
      `ip range = ${rangeStart}-${rangeEnd}`,
      `local ip = ${localIp}`,
      'require chap = yes', 'refuse pap = yes', 'require authentication = yes',
      'name = RadFastVPN', 'pppoptfile = /etc/ppp/options.xl2tpd',
      'length bit = yes',
    ].join('\n') + '\n', { mode: 0o644 })
    try { runCmdSync('systemctl', ['restart', 'xl2tpd']) } catch {}
  } catch (e) { console.error('xl2tpd.conf:', e.message) }
}

/**
 * Validasi 1 set pool L2TP. Mengembalikan { ok, message?, pool? }.
 * Semua IP (local, range start/end) wajib berada dalam subnet /24 yang sama.
 */
function validateL2tpPool({ subnet, local_ip, range_start, range_end }) {
  if (!isValidCidr24(subnet)) return { ok: false, message: 'Subnet harus format x.x.x.0/24.' }
  const prefix = cidr24Prefix(subnet)
  for (const [label, ip] of [['Local IP', local_ip], ['IP awal', range_start], ['IP akhir', range_end]]) {
    if (!isValidIPv4(ip)) return { ok: false, message: `${label} bukan IPv4 valid.` }
    if (!ip.startsWith(prefix)) return { ok: false, message: `${label} harus berada dalam subnet ${subnet}.` }
  }
  const startOctet = Number(range_start.split('.')[3])
  const endOctet   = Number(range_end.split('.')[3])
  const localOctet = Number(local_ip.split('.')[3])
  if (startOctet > endOctet) return { ok: false, message: 'IP awal harus lebih kecil atau sama dengan IP akhir.' }
  if (localOctet >= startOctet && localOctet <= endOctet) {
    return { ok: false, message: 'Local IP (gateway) tidak boleh berada di dalam range pool client.' }
  }
  return { ok: true, pool: { subnet, local_ip, range_start, range_end } }
}

/** Default IP pool WireGuard. */
function wireguardPoolDefaults() {
  return {
    subnet: '10.8.1.0/24',
    server_vpn_ip: '10.8.1.1',
    next_ip: 2,
  }
}

/** Validasi pool WireGuard. */
function validateWireGuardPool({ subnet, server_vpn_ip, next_ip }) {
  if (!isValidCidr24(subnet)) return { ok: false, message: 'Subnet harus format x.x.x.0/24.' }
  const prefix = cidr24Prefix(subnet)
  if (!isValidIPv4(server_vpn_ip)) return { ok: false, message: 'Server VPN IP bukan IPv4 valid.' }
  if (!server_vpn_ip.startsWith(prefix)) return { ok: false, message: `Server VPN IP harus berada dalam subnet ${subnet}.` }
  const serverOctet = Number(server_vpn_ip.split('.')[3])
  if (serverOctet < 1 || serverOctet > 254) return { ok: false, message: 'Server VPN IP tidak boleh memakai .0 atau .255.' }
  const next = Number(next_ip)
  if (!Number.isInteger(next) || next < 2 || next > 254) return { ok: false, message: 'Next IP harus angka 2-254.' }
  if (next === serverOctet) return { ok: false, message: 'Next IP tidak boleh sama dengan Server VPN IP.' }
  return { ok: true, pool: { subnet, server_vpn_ip, next_ip: next } }
}

function updateWireGuardAddress(serverVpnIp) {
  if (!isLinux || !fs.existsSync('/etc/wireguard/wg0.conf')) return
  try {
    const conf = fs.readFileSync('/etc/wireguard/wg0.conf', 'utf8')
    const nextConf = conf.replace(/^Address\s*=.*$/m, `Address = ${serverVpnIp}/24`)
    fs.writeFileSync('/etc/wireguard/wg0.conf', nextConf, { mode: 0o600 })
    try { runCmdSync('systemctl', ['restart', 'wg-quick@wg0']) } catch {}
  } catch (e) { console.error('wg0.conf address:', e.message) }
}

// ═════════════════════════════════════════════════════════════════════════
// STATUS
// ═════════════════════════════════════════════════════════════════════════
router.get('/status', (req, res) => {
  // strongswan bisa jalan sebagai 'strongswan-starter' (Ubuntu 20+) atau 'strongswan'
  const strongswanRunning = svcRunning('strongswan-starter') || svcRunning('strongswan')
  res.json({
    server_ip: getServerIP(),
    l2tp:      { running: strongswanRunning && svcRunning('xl2tpd'), port: 1701 },
    wireguard: { running: svcRunning('wg-quick@wg0'),                port: 51820 },
  })
})

// ═════════════════════════════════════════════════════════════════════════
// L2TP
// ═════════════════════════════════════════════════════════════════════════
router.post(
  '/l2tp/install',
  body('psk').optional().isString().isLength({ min: 0, max: 64 }).matches(/^[a-zA-Z0-9!@#$%^&*()_+=-]*$/),
  async (req, res) => {
    if (!handleValidation(req, res)) return
    if (isWin) return res.status(400).json({ message: 'Hanya bisa di Linux.' })

    // Detect package manager safely
    let pkgArgs = ['install', '-y', 'strongswan', 'xl2tpd', 'ppp']
    let pkgBin  = 'apt-get'
    try {
      const osr = fs.readFileSync('/etc/os-release', 'utf8').toLowerCase()
      if (osr.includes('centos') || osr.includes('rhel') || osr.includes('fedora')) pkgBin = 'yum'
    } catch {}

    const psk = req.body.psk?.trim() || randomPSK()
    const vpnUser = 'radfast'
    const vpnPass = crypto.randomBytes(8).toString('hex')

    try {
      // ── Install packages ──────────────────────────────────────────────────
      await runCmd(pkgBin, pkgArgs, { timeout: 120_000 })

      // ── Write ipsec.conf ──────────────────────────────────────────────────
      // rightprotoport=17/0 lebih kompatibel dengan MikroTik dibanding 17/%any
      fs.writeFileSync('/etc/ipsec.conf', [
        'config setup',
        '  charondebug="ike 1, knl 1, cfg 0"',
        '',
        'conn %default',
        '  ikelifetime=60m',
        '  keylife=20m',
        '  rekeymargin=3m',
        '  keyingtries=1',
        '',
        'conn L2TP-PSK',
        '  authby=secret',
        '  auto=add',
        '  keyexchange=ikev1',
        '  type=transport',
        '  left=%defaultroute',
        '  leftprotoport=17/1701',
        '  right=%any',
        '  rightprotoport=17/0',
        '  dpddelay=10',
        '  dpdtimeout=20',
        '  dpdaction=clear',
      ].join('\n') + '\n', { mode: 0o600 })

      fs.writeFileSync('/etc/ipsec.secrets', `: PSK "${psk}"\n`, { mode: 0o600 })

      // ── Write xl2tpd.conf (pakai pool default) ────────────────────────────
      const l2tpPool = l2tpPoolDefaults()
      writeXl2tpdConf(l2tpPool)

      fs.mkdirSync('/etc/ppp', { recursive: true })
      fs.writeFileSync('/etc/ppp/options.xl2tpd', [
        'ipcp-accept-local', 'ipcp-accept-remote',
        'ms-dns 8.8.8.8', 'ms-dns 8.8.4.4',
        'noccp', 'auth', 'crtscts', 'idle 1800',
        'mtu 1450', 'mru 1450',
        'nodefaultroute', 'lock', 'proxyarp', 'connect-delay 5000',
      ].join('\n') + '\n', { mode: 0o644 })

      // Buat chap-secrets jika belum ada
      if (!fs.existsSync('/etc/ppp/chap-secrets')) {
        fs.writeFileSync('/etc/ppp/chap-secrets', '# RadFast VPN users\n', { mode: 0o600 })
      }

      // ── PPP device (dibutuhkan di LXC container) ──────────────────────────
      try { runCmdSync('modprobe', ['ppp_generic']) } catch {}
      if (!fs.existsSync('/dev/ppp')) {
        try { runCmdSync('mknod', ['/dev/ppp', 'c', '108', '0']) } catch {}
        try { fs.chmodSync('/dev/ppp', 0o600) } catch {}
      }

      // ── Enable IP forwarding ──────────────────────────────────────────────
      try { fs.writeFileSync('/proc/sys/net/ipv4/ip_forward', '1') } catch {}
      try { runCmdSync('sysctl', ['-w', 'net.ipv4.ip_forward=1']) } catch {}

      // ── Start services ────────────────────────────────────────────────────
      // Ubuntu 20+: strongswan-starter; Ubuntu 18 / Debian: strongswan
      const strongswanSvc = (() => {
        try { runCmdSync('systemctl', ['cat', 'strongswan-starter']); return 'strongswan-starter' } catch {}
        return 'strongswan'
      })()

      await runCmd('systemctl', ['enable', '--now', strongswanSvc])
      await runCmd('systemctl', ['enable', '--now', 'xl2tpd'])

      // ── Reload ipsec config (wajib agar conn L2TP-PSK dimuat charon) ──────
      try { await runCmd('ipsec', ['reload']) } catch {}
      // Restart xl2tpd agar baca config baru
      try { await runCmd('systemctl', ['restart', 'xl2tpd']) } catch {}

      // ── PPP ip-up script untuk rate limiting ──────────────────────────────
      writePppIpUpScript()

      // ── Save config & default user ────────────────────────────────────────
      writeJSON(L2TP_CFG_FILE, { psk, server_ip: getServerIP(), ...l2tpPool })

      const users = readJSON(L2TP_USERS_FILE)
      if (!users.find(u => u.username === vpnUser)) {
        // Tambah ke chap-secrets
        try {
          fs.appendFileSync('/etc/ppp/chap-secrets', `${vpnUser} * "${vpnPass}" *\n`, { mode: 0o600 })
        } catch {}
        users.push({ username: vpnUser, password: vpnPass, instance: '', note: 'default', created: new Date().toISOString() })
        writeJSON(L2TP_USERS_FILE, users)
      }

      audit.record('vpn.l2tp.install', { server_ip: getServerIP() }, req)
      res.json({ message: 'L2TP/IPsec berhasil diinstall.', psk, default_user: vpnUser, default_pass: vpnPass })
    } catch (e) {
      console.error('[vpn.l2tp.install] ERROR:', e.message, e.stderr || '')
      res.status(500).json({
        message: `Install gagal: ${e.message?.slice(0, 200) || 'unknown error'}`,
      })
    }
  },
)

router.get('/l2tp/config', (req, res) => {
  const cfg = fs.existsSync(L2TP_CFG_FILE) ? (readJSON(L2TP_CFG_FILE) || {}) : {}
  const d = l2tpPoolDefaults()
  res.json({
    psk: cfg.psk || null,
    subnet: cfg.subnet || d.subnet,
    local_ip: cfg.local_ip || d.local_ip,
    range_start: cfg.range_start || d.range_start,
    range_end: cfg.range_end || d.range_end,
    server_ip: getServerIP(),
  })
})

router.put(
  '/l2tp/config',
  body('psk').optional().isString().isLength({ min: 12, max: 64 }).matches(/^[a-zA-Z0-9!@#$%^&*()_+=-]+$/),
  body('subnet').optional().isString(),
  body('local_ip').optional().isString(),
  body('range_start').optional().isString(),
  body('range_end').optional().isString(),
  (req, res) => {
    if (!handleValidation(req, res)) return

    const existing = fs.existsSync(L2TP_CFG_FILE) ? (readJSON(L2TP_CFG_FILE) || {}) : {}
    const next = { ...l2tpPoolDefaults(), ...existing }

    let pskChanged = false
    let poolChanged = false

    if (typeof req.body.psk === 'string') {
      next.psk = req.body.psk
      pskChanged = true
    }

    const poolKeys = ['subnet', 'local_ip', 'range_start', 'range_end']
    const requestedPoolChange = poolKeys.some((k) => typeof req.body[k] === 'string' && req.body[k].trim() !== '')
    if (requestedPoolChange) {
      const candidate = {
        subnet: req.body.subnet || next.subnet,
        local_ip: req.body.local_ip || next.local_ip,
        range_start: req.body.range_start || next.range_start,
        range_end: req.body.range_end || next.range_end,
      }
      const v = validateL2tpPool(candidate)
      if (!v.ok) return res.status(400).json({ message: v.message })
      next.subnet = v.pool.subnet
      next.local_ip = v.pool.local_ip
      next.range_start = v.pool.range_start
      next.range_end = v.pool.range_end
      poolChanged = true
    }

    writeJSON(L2TP_CFG_FILE, next)

    if (isLinux && pskChanged) {
      try {
        fs.writeFileSync('/etc/ipsec.secrets', `: PSK "${next.psk}"\n`, { mode: 0o600 })
        try { runCmdSync('ipsec', ['rereadsecrets']) } catch {}
        try { runCmdSync('ipsec', ['reload']) } catch {}
      } catch {}
    }

    if (isLinux && poolChanged) {
      writeXl2tpdConf(next)
    }

    audit.record('vpn.l2tp.config_update', {
      pskChanged,
      poolChanged,
      subnet: next.subnet,
      range: `${next.range_start}-${next.range_end}`,
    }, req)

    res.json({
      message: 'Konfigurasi L2TP berhasil diperbarui.',
      config: {
        psk: next.psk || null,
        subnet: next.subnet,
        local_ip: next.local_ip,
        range_start: next.range_start,
        range_end: next.range_end,
        server_ip: getServerIP(),
      },
    })
  },
)

router.get('/l2tp/users', (req, res) => {
  const users = readJSON(L2TP_USERS_FILE)
  let connected = []
  if (isLinux) {
    try {
      const out = runCmdSync('ls', ['/var/run/ppp']) || ''
      connected = out.trim().split('\n').filter(Boolean).map(f => f.replace('.pid', ''))
    } catch {}
  }
  res.json(users.map(u => ({
    ...u,
    password: undefined, // never expose plaintext over wire — see /l2tp/users/:name/secret
    connected: connected.includes(u.username),
  })))
})

// Reveal password endpoint (separate, audited)
router.get(
  '/l2tp/users/:name/secret',
  param('name').isString().matches(/^[a-zA-Z0-9_.-]{1,64}$/),
  (req, res) => {
    if (!handleValidation(req, res)) return
    const u = readJSON(L2TP_USERS_FILE).find(x => x.username === req.params.name)
    if (!u) return res.status(404).json({ message: 'User tidak ditemukan.' })
    audit.record('vpn.l2tp.password_view', { username: u.username }, req)
    res.json({ username: u.username, password: u.password })
  },
)

router.post(
  '/l2tp/users',
  body('username').isString().matches(/^[a-zA-Z0-9_.-]{1,64}$/),
  // Printable ASCII EXCEPT space (0x20), double-quote (0x22) dan backslash (0x5c):
  // keduanya bisa merusak parsing field di /etc/ppp/chap-secrets.
  body('password').isString().isLength({ min: 8, max: 128 }).matches(/^[\x21\x23-\x5b\x5d-\x7e]+$/),
  body('instance').optional().isString().isLength({ max: 64 }).matches(/^[a-zA-Z0-9_-]*$/),
  body('note').optional().isString().isLength({ max: 200 }),
  (req, res) => {
    if (!handleValidation(req, res)) return
    const { username, password, instance, note } = req.body
    validateUsername(username)

    const users = readJSON(L2TP_USERS_FILE)
    if (users.find(u => u.username === username)) {
      return res.status(409).json({ message: `User "${username}" sudah ada.` })
    }

    users.push({
      username, password,
      instance: instance || '',
      note: safeNote(note),
      created: new Date().toISOString(),
    })
    writeJSON(L2TP_USERS_FILE, users)

    if (isLinux) {
      try {
        // Append a single line; values already validated as printable ASCII.
        fs.appendFileSync(
          '/etc/ppp/chap-secrets',
          `\n${username} * "${password}" *\n`,
          { mode: 0o600 },
        )
      } catch (e) { console.error('chap-secrets:', e.message) }
    }

    audit.record('vpn.l2tp.user_create', { username, instance: instance || '' }, req)
    res.status(201).json({ message: `User ${username} ditambahkan.` })
  },
)

router.delete(
  '/l2tp/users/:name',
  param('name').isString().matches(/^[a-zA-Z0-9_.-]{1,64}$/),
  (req, res) => {
    if (!handleValidation(req, res)) return
    const name = req.params.name
    const users = readJSON(L2TP_USERS_FILE).filter(u => u.username !== name)
    writeJSON(L2TP_USERS_FILE, users)

    if (isLinux) {
      try {
        const lines = fs.readFileSync('/etc/ppp/chap-secrets', 'utf8').split('\n')
        const filtered = lines.filter(l => !l.startsWith(name + ' '))
        fs.writeFileSync('/etc/ppp/chap-secrets', filtered.join('\n'), { mode: 0o600 })
      } catch {}
    }
    audit.record('vpn.l2tp.user_delete', { username: name }, req)
    res.json({ message: 'User dihapus.' })
  },
)

// PUT /api/vpn/l2tp/users/:name/limit
router.put(
  '/l2tp/users/:name/limit',
  param('name').isString().matches(/^[a-zA-Z0-9_.-]{1,64}$/),
  body('rate_down').isInt({ min: 0, max: 10000 }),
  body('rate_up').isInt({ min: 0, max: 10000 }),
  (req, res) => {
    if (!handleValidation(req, res)) return
    const name = req.params.name
    const users = readJSON(L2TP_USERS_FILE)
    const idx = users.findIndex(u => u.username === name)
    if (idx === -1) return res.status(404).json({ message: 'User tidak ditemukan.' })

    const rateDown = parseInt(req.body.rate_down, 10) || 0
    const rateUp   = parseInt(req.body.rate_up,   10) || 0
    users[idx].rate_down = rateDown
    users[idx].rate_up   = rateUp
    writeJSON(L2TP_USERS_FILE, users)

    // Tulis ip-up script agar limit diterapkan saat user connect
    if (isLinux) writePppIpUpScript()

    audit.record('vpn.l2tp.user_limit', { username: name, rateDown, rateUp }, req)
    res.json({
      message: rateDown || rateUp
        ? `Limit diterapkan: ↓${rateDown}M ↑${rateUp}M`
        : 'Speed limit dihapus.',
    })
  },
)

/** Tulis /etc/ppp/ip-up.d/radfast-limit — dibaca tiap kali ppp connect */
function writePppIpUpScript() {
  const dataFile = L2TP_USERS_FILE.replace(/\\/g, '/')
  const script = `#!/bin/bash
# RadFast — apply tc rate limit saat PPP connect
IFACE="$1"
[ -z "$IFACE" ] && exit 0
[ -z "$PEERNAME" ] && exit 0

# Simpan mapping interface→username untuk traffic monitoring
mkdir -p /var/run/radfast-ppp
echo "$PEERNAME" > "/var/run/radfast-ppp/${IFACE}.user"

DATA_FILE="${dataFile}"
[ -f "$DATA_FILE" ] || exit 0

read RATE_DOWN RATE_UP < <(python3 -c "
import json
try:
  users = json.load(open('$DATA_FILE'))
  u = next((x for x in users if x.get('username') == '$PEERNAME'), None)
  d = int(u.get('rate_down') or 0) if u else 0
  up = int(u.get('rate_up') or 0) if u else 0
  print(d, up)
except: print(0, 0)
" 2>/dev/null)

[ "\${RATE_DOWN:-0}" -gt 0 ] && {
  tc qdisc add dev "$IFACE" root handle 1: htb default 9999 2>/dev/null
  tc class add dev "$IFACE" parent 1: classid 1:1 htb rate "\${RATE_DOWN}mbit" ceil "\${RATE_DOWN}mbit" burst 15k 2>/dev/null
  tc filter add dev "$IFACE" parent 1: protocol ip prio 1 u32 match ip dst 0.0.0.0/0 flowid 1:1 2>/dev/null
}

[ "\${RATE_UP:-0}" -gt 0 ] && {
  tc qdisc add dev "$IFACE" handle ffff: ingress 2>/dev/null
  tc filter add dev "$IFACE" parent ffff: protocol ip prio 1 u32 match ip src 0.0.0.0/0 \\
    police rate "\${RATE_UP}mbit" burst 1mbit drop flowid :1 2>/dev/null
}
`
  const ipDown = `#!/bin/bash
# RadFast — cleanup mapping saat PPP disconnect
rm -f "/var/run/radfast-ppp/$1.user"
`
  try {
    fs.mkdirSync('/etc/ppp/ip-up.d',   { recursive: true })
    fs.mkdirSync('/etc/ppp/ip-down.d', { recursive: true })
    fs.writeFileSync('/etc/ppp/ip-up.d/radfast-limit',   script,  { mode: 0o755 })
    fs.writeFileSync('/etc/ppp/ip-down.d/radfast-limit', ipDown,  { mode: 0o755 })
  } catch (e) { console.error('ppp ip-up:', e.message) }
}

// RouterOS config — render only from validated stored data.
router.get(
  '/l2tp/mikrotik/:username',
  param('username').isString().matches(/^[a-zA-Z0-9_.-]{1,64}$/),
  (req, res) => {
    if (!handleValidation(req, res)) return
    const user = readJSON(L2TP_USERS_FILE).find(u => u.username === req.params.username)
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan.' })

    const cfg = { ...l2tpPoolDefaults(), ...(fs.existsSync(L2TP_CFG_FILE) ? (readJSON(L2TP_CFG_FILE) || {}) : {}) }
    const serverIP = getServerIP()
    const psk = cfg.psk || 'YOUR_PSK'

    audit.record('vpn.l2tp.mikrotik_view', { username: user.username }, req)

    const config = `/interface l2tp-client
add name="vpn-radfast" connect-to=${serverIP} user="${user.username}" password="${user.password}" \\
    use-ipsec=yes ipsec-secret="${psk}" \\
    disabled=no add-default-route=no profile=default-encryption

/ip route
add dst-address=${cfg.subnet} gateway="vpn-radfast" comment="RadFast ACS VPN"

# Verifikasi:
/interface l2tp-client print
/ip route print where gateway="vpn-radfast"`

    res.json({ config, server_ip: serverIP, username: user.username })
  },
)

// ═════════════════════════════════════════════════════════════════════════
// WireGuard
// ═════════════════════════════════════════════════════════════════════════
router.post(
  '/wireguard/install',
  body('port').optional().isInt({ min: 1024, max: 65535 }),
  async (req, res) => {
    if (!handleValidation(req, res)) return
    if (isWin) return res.status(400).json({ message: 'Hanya bisa di Linux.' })

    const port = validatePort(req.body.port || 51820)
    const wgPool = wireguardPoolDefaults()

    try {
      await runCmd('apt-get', ['install', '-y', 'wireguard'], { timeout: 120_000 })
      fs.mkdirSync('/etc/wireguard', { recursive: true, mode: 0o700 })

      const priv = (await runCmd('wg', ['genkey'])).stdout.trim()
      const pub  = await new Promise((resolve, reject) => {
        const { spawn } = require('child_process')
        const p = spawn('wg', ['pubkey'])
        let out = ''; let err = ''
        p.stdout.on('data', d => out += d)
        p.stderr.on('data', d => err += d)
        p.on('close', code => code === 0 ? resolve(out.trim()) : reject(new Error(err)))
        p.stdin.end(priv + '\n')
      })

      fs.writeFileSync('/etc/wireguard/server_private.key', priv, { mode: 0o600 })
      fs.writeFileSync('/etc/wireguard/server_public.key',  pub,  { mode: 0o644 })

      fs.writeFileSync('/etc/wireguard/wg0.conf', [
        '[Interface]',
        `Address = ${wgPool.server_vpn_ip}/24`,
        `ListenPort = ${port}`,
        `PrivateKey = ${priv}`,
        'PostUp   = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE',
        'PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE',
      ].join('\n') + '\n', { mode: 0o600 })

      try { fs.writeFileSync('/proc/sys/net/ipv4/ip_forward', '1') } catch {}
      await runCmd('systemctl', ['enable', '--now', 'wg-quick@wg0'])

      writeJSON(WG_CFG_FILE, {
        port, server_ip: getServerIP(),
        server_pubkey: pub, ...wgPool,
      })

      audit.record('vpn.wg.install', { port }, req)
      res.json({ message: 'WireGuard berhasil diinstall.', server_pubkey: pub, port })
    } catch (e) {
      res.status(500).json({ message: 'Install WireGuard gagal.' })
    }
  },
)

router.get('/wireguard/config', (req, res) => {
  const cfg = fs.existsSync(WG_CFG_FILE) ? (readJSON(WG_CFG_FILE) || {}) : {}
  const d = wireguardPoolDefaults()
  res.json({
    port: cfg.port || 51820,
    server_pubkey: cfg.server_pubkey || null,
    subnet: cfg.subnet || d.subnet,
    server_vpn_ip: cfg.server_vpn_ip || d.server_vpn_ip,
    next_ip: cfg.next_ip != null ? cfg.next_ip : d.next_ip,
    server_ip: getServerIP(),
  })
})

router.put(
  '/wireguard/config',
  body('subnet').optional().isString(),
  body('server_vpn_ip').optional().isString(),
  body('next_ip').optional().isInt({ min: 2, max: 254 }),
  (req, res) => {
    if (!handleValidation(req, res)) return

    const existing = fs.existsSync(WG_CFG_FILE) ? (readJSON(WG_CFG_FILE) || {}) : {}
    const next = { ...wireguardPoolDefaults(), ...existing }

    let poolChanged = false
    const requestedPoolChange =
      typeof req.body.subnet === 'string' ||
      typeof req.body.server_vpn_ip === 'string' ||
      req.body.next_ip != null

    if (requestedPoolChange) {
      const candidate = {
        subnet: req.body.subnet || next.subnet,
        server_vpn_ip: req.body.server_vpn_ip || next.server_vpn_ip,
        next_ip: req.body.next_ip != null ? req.body.next_ip : next.next_ip,
      }
      const v = validateWireGuardPool(candidate)
      if (!v.ok) return res.status(400).json({ message: v.message })
      next.subnet = v.pool.subnet
      next.server_vpn_ip = v.pool.server_vpn_ip
      next.next_ip = v.pool.next_ip
      poolChanged = true
    }

    writeJSON(WG_CFG_FILE, next)

    if (poolChanged) {
      updateWireGuardAddress(next.server_vpn_ip)
    }

    audit.record('vpn.wg.config_update', {
      poolChanged,
      subnet: next.subnet,
      server_vpn_ip: next.server_vpn_ip,
      next_ip: next.next_ip,
    }, req)

    res.json({
      message: 'Konfigurasi WireGuard berhasil diperbarui.',
      config: {
        port: next.port || 51820,
        server_pubkey: next.server_pubkey || null,
        subnet: next.subnet,
        server_vpn_ip: next.server_vpn_ip,
        next_ip: next.next_ip,
        server_ip: getServerIP(),
      },
    })
  },
)

router.get('/wireguard/peers', (req, res) => {
  const peers = readJSON(WG_PEERS_FILE)
  let activePubkeys = []
  if (isLinux) {
    try {
      const out = runCmdSync('wg', ['show', 'wg0', 'peers'])
      activePubkeys = out.trim().split('\n').filter(Boolean)
    } catch {}
  }
  res.json(peers.map(p => ({
    ...p,
    privkey: undefined, // never leak private key on listing
    connected: activePubkeys.includes(p.pubkey),
  })))
})

router.post(
  '/wireguard/peers',
  body('name').isString().matches(/^[a-z][a-z0-9-]{0,40}$/),
  body('instance').optional().isString().isLength({ max: 64 }).matches(/^[a-zA-Z0-9_-]*$/),
  body('note').optional().isString().isLength({ max: 200 }),
  async (req, res) => {
    if (!handleValidation(req, res)) return
    const name = validateIdent(req.body.name, 'peer name')
    const { instance, note } = req.body

    const cfg = fs.existsSync(WG_CFG_FILE)
      ? (readJSON(WG_CFG_FILE) || {})
      : { port: 51820, ...wireguardPoolDefaults() }

    const peers = readJSON(WG_PEERS_FILE)
    if (peers.find(p => p.name === name)) {
      return res.status(409).json({ message: 'Nama sudah dipakai.' })
    }

    let privKey, pubKey
    if (isLinux) {
      try {
        privKey = (await runCmd('wg', ['genkey'])).stdout.trim()
        pubKey  = await new Promise((resolve, reject) => {
          const { spawn } = require('child_process')
          const p = spawn('wg', ['pubkey'])
          let o = '', e = ''
          p.stdout.on('data', d => o += d)
          p.stderr.on('data', d => e += d)
          p.on('close', c => c === 0 ? resolve(o.trim()) : reject(new Error(e)))
          p.stdin.end(privKey + '\n')
        })
      } catch {
        return res.status(500).json({ message: 'Gagal generate keys.' })
      }
    } else {
      privKey = crypto.randomBytes(32).toString('base64')
      pubKey  = crypto.randomBytes(32).toString('base64')
    }

    const wgPrefix = cidr24Prefix(cfg.subnet) || '10.8.1.'
    const usedOctets = new Set(
      peers
        .map(p => Number(String(p.peer_ip || '').split('.')[3]))
        .filter(n => Number.isInteger(n)),
    )
    const serverOctet = Number(String(cfg.server_vpn_ip || '').split('.')[3])
    if (Number.isInteger(serverOctet)) usedOctets.add(serverOctet)

    let octet = Number(cfg.next_ip) || 2
    if (octet < 2) octet = 2
    while (octet <= 254 && usedOctets.has(octet)) octet++
    if (octet > 254) {
      return res.status(409).json({ message: 'Pool IP WireGuard penuh (max .254).' })
    }

    const peerIP = `${wgPrefix}${octet}`
    cfg.next_ip = octet + 1
    writeJSON(WG_CFG_FILE, cfg)

    const peer = {
      name, pubkey: pubKey, privkey: privKey,
      peer_ip: peerIP,
      instance: instance || '',
      note: safeNote(note),
      created: new Date().toISOString(),
    }
    peers.push(peer)
    writeJSON(WG_PEERS_FILE, peers)

    if (isLinux) {
      try {
        await runCmd('wg', ['set', 'wg0', 'peer', pubKey, 'allowed-ips', `${peerIP}/32`])
        fs.appendFileSync('/etc/wireguard/wg0.conf',
          `\n[Peer] # ${name}\nPublicKey = ${pubKey}\nAllowedIPs = ${peerIP}/32\n`,
          { mode: 0o600 })
      } catch (e) { console.error('wg set:', e.message) }
    }

    audit.record('vpn.wg.peer_create', { name, peerIP }, req)
    // Strip privkey from response — admin can fetch it via /secret endpoint.
    res.status(201).json({
      message: `Peer ${name} ditambahkan.`,
      peer: { ...peer, privkey: undefined },
    })
  },
)

router.delete(
  '/wireguard/peers/:name',
  param('name').isString().matches(/^[a-z][a-z0-9-]{0,40}$/),
  async (req, res) => {
    if (!handleValidation(req, res)) return
    const name = req.params.name
    const peers = readJSON(WG_PEERS_FILE)
    const peer = peers.find(p => p.name === name)
    if (!peer) return res.status(404).json({ message: 'Peer tidak ditemukan.' })

    if (isLinux) {
      try { await runCmd('wg', ['set', 'wg0', 'peer', peer.pubkey, 'remove']) } catch {}
      // Hapus tc rules untuk peer ini
      if (peer.peer_ip) removePeerTcLimit(peer.peer_ip)
    }

    writeJSON(WG_PEERS_FILE, peers.filter(p => p.name !== name))
    audit.record('vpn.wg.peer_delete', { name }, req)
    res.json({ message: 'Peer dihapus.' })
  },
)

// ═════════════════════════════════════════════════════════════════════════
// WireGuard Speed Limit (tc HTB)
// ═════════════════════════════════════════════════════════════════════════

/**
 * Hapus tc rules untuk satu peer berdasarkan IP.
 * Cukup delete class — filter akan ikut terhapus.
 */
function removePeerTcLimit(peerIp) {
  const classId = parseInt(String(peerIp).split('.')[3], 10)
  if (!classId || classId < 2 || classId > 254) return
  try { runCmdSync('tc', ['class', 'del', 'dev', 'wg0', 'classid', `1:${classId}`]) } catch {}
  // Hapus ingress police filter (match ip src)
  try {
    const filters = runCmdSync('tc', ['filter', 'show', 'dev', 'wg0', 'parent', 'ffff:'])
    // Cari handle filter yang match src IP ini dan hapus
    const lines = filters.split('\n')
    let handle = null
    for (const line of lines) {
      const hm = line.match(/filter\s+\S+\s+\S+\s+(\S+)\s+/)
      if (hm) handle = hm[1]
      if (handle && line.includes(peerIp)) {
        try { runCmdSync('tc', ['filter', 'del', 'dev', 'wg0', 'parent', 'ffff:', 'handle', handle, 'prio', '1', 'u32']) } catch {}
        handle = null
      }
    }
  } catch {}
}

/**
 * Terapkan HTB rate limit untuk satu WireGuard peer.
 * rateDown = limit download ke peer (Mbps), rateUp = limit upload dari peer (Mbps)
 * 0 = hapus limit (unlimited)
 */
function applyPeerTcLimit(peerIp, rateDownMbps, rateUpMbps) {
  if (!isLinux) return
  const classId = parseInt(String(peerIp).split('.')[3], 10)
  if (!classId || classId < 2 || classId > 254) return

  // Hapus rules lama dulu
  removePeerTcLimit(peerIp)

  if (!rateDownMbps && !rateUpMbps) return

  // ── Egress (download → ke peer) via HTB ──────────────────────────────
  if (rateDownMbps > 0) {
    const rate = `${rateDownMbps}mbit`
    // Pastikan root qdisc HTB ada
    try { runCmdSync('tc', ['qdisc', 'add', 'dev', 'wg0', 'root', 'handle', '1:', 'htb', 'default', '9999']) } catch {}
    // Class untuk peer
    try {
      runCmdSync('tc', ['class', 'add', 'dev', 'wg0', 'parent', '1:', 'classid', `1:${classId}`,
        'htb', 'rate', rate, 'ceil', rate, 'burst', '15k'])
    } catch {}
    // Filter: traffic dst = peer_ip → class ini
    try {
      runCmdSync('tc', ['filter', 'add', 'dev', 'wg0', 'parent', '1:', 'protocol', 'ip',
        'prio', '1', 'u32', 'match', 'ip', 'dst', `${peerIp}/32`, 'flowid', `1:${classId}`])
    } catch {}
  }

  // ── Ingress (upload ← dari peer) via police ───────────────────────────
  if (rateUpMbps > 0) {
    const rate = `${rateUpMbps}mbit`
    // Pastikan ingress qdisc ada
    try { runCmdSync('tc', ['qdisc', 'add', 'dev', 'wg0', 'handle', 'ffff:', 'ingress']) } catch {}
    try {
      runCmdSync('tc', ['filter', 'add', 'dev', 'wg0', 'parent', 'ffff:', 'protocol', 'ip',
        'prio', '1', 'u32', 'match', 'ip', 'src', `${peerIp}/32`,
        'police', 'rate', rate, 'burst', '1mbit', 'drop', 'flowid', ':1'])
    } catch {}
  }
}

// PUT /api/vpn/wireguard/peers/:name/limit
router.put(
  '/wireguard/peers/:name/limit',
  param('name').isString().matches(/^[a-z][a-z0-9-]{0,40}$/),
  body('rate_down').isInt({ min: 0, max: 10000 }),
  body('rate_up').isInt({ min: 0, max: 10000 }),
  (req, res) => {
    if (!handleValidation(req, res)) return
    const name = req.params.name
    const peers = readJSON(WG_PEERS_FILE)
    const idx = peers.findIndex(p => p.name === name)
    if (idx === -1) return res.status(404).json({ message: 'Peer tidak ditemukan.' })

    const rateDown = parseInt(req.body.rate_down, 10) || 0
    const rateUp   = parseInt(req.body.rate_up,   10) || 0

    peers[idx].rate_down = rateDown
    peers[idx].rate_up   = rateUp
    writeJSON(WG_PEERS_FILE, peers)

    if (isLinux) applyPeerTcLimit(peers[idx].peer_ip, rateDown, rateUp)

    audit.record('vpn.wg.peer_limit', { name, rateDown, rateUp }, req)
    res.json({
      message: rateDown || rateUp
        ? `Limit diterapkan: ↓${rateDown}M ↑${rateUp}M`
        : 'Speed limit dihapus (unlimited).',
    })
  },
)

router.get(
  '/wireguard/mikrotik/:name',
  param('name').isString().matches(/^[a-z][a-z0-9-]{0,40}$/),
  (req, res) => {
    if (!handleValidation(req, res)) return
    const peer = readJSON(WG_PEERS_FILE).find(p => p.name === req.params.name)
    if (!peer) return res.status(404).json({ message: 'Peer tidak ditemukan.' })

    const cfg = { ...wireguardPoolDefaults(), ...(fs.existsSync(WG_CFG_FILE) ? (readJSON(WG_CFG_FILE) || {}) : {}) }
    const serverIP = getServerIP()
    const serverPubkey = cfg.server_pubkey || 'SERVER_PUBKEY'
    const port = validatePort(cfg.port || 51820)

    audit.record('vpn.wg.mikrotik_view', { name: peer.name }, req)

    const config = `# ── WireGuard RadFast VPN ──────────────────────────────
# RouterOS 7.x — paste di terminal MikroTik

/interface wireguard
add name="wg-radfast" private-key="${peer.privkey}" listen-port=13231

/interface wireguard peers
add interface="wg-radfast" \\
    public-key="${serverPubkey}" \\
    endpoint-address=${serverIP} \\
    endpoint-port=${port} \\
    allowed-address=${cfg.subnet} \\
    persistent-keepalive=25s

/ip address
add interface="wg-radfast" address="${peer.peer_ip}/24"

/ip route
add dst-address=${cfg.subnet} gateway="wg-radfast" comment="RadFast ACS"

# Verifikasi:
/interface wireguard peers print`

    res.json({ config, server_ip: serverIP, peer_ip: peer.peer_ip })
  },
)

// Legacy compat
router.get('/clients', (req, res) => {
  res.json({ clients: readJSON(VPN_DATA), status: { running: svcRunning('openvpn@server') } })
})

// ═════════════════════════════════════════════════════════════════════════
// TRAFFIC STATS — rx/tx bytes per peer/user (untuk grafik)
// ═════════════════════════════════════════════════════════════════════════
router.get('/traffic', (req, res) => {
  const wg   = []
  const l2tp = []
  const ts   = Date.now()

  if (isLinux) {
    // ── WireGuard: wg show wg0 transfer ────────────────────────────────
    try {
      const peers = readJSON(WG_PEERS_FILE)
      const out   = runCmdSync('wg', ['show', 'wg0', 'transfer'])
      // Format: pubkey\trx_bytes\ttx_bytes per baris
      for (const line of out.trim().split('\n')) {
        const parts = line.split('\t')
        if (parts.length < 3) continue
        const [pubkey, rxStr, txStr] = parts
        const peer = peers.find(p => p.pubkey === pubkey)
        if (peer) {
          wg.push({
            name:    peer.name,
            peer_ip: peer.peer_ip,
            rx:      parseInt(rxStr, 10) || 0,
            tx:      parseInt(txStr, 10) || 0,
          })
        }
      }
    } catch {}

    // ── L2TP: scan ppp interfaces + mapping username ────────────────────
    try {
      const netDir = '/sys/class/net'
      const ifaces = fs.readdirSync(netDir).filter(d => d.startsWith('ppp'))
      for (const iface of ifaces) {
        try {
          const rx = parseInt(fs.readFileSync(`${netDir}/${iface}/statistics/rx_bytes`,  'utf8').trim(), 10) || 0
          const tx = parseInt(fs.readFileSync(`${netDir}/${iface}/statistics/tx_bytes`,  'utf8').trim(), 10) || 0
          // Baca username dari mapping file yang ditulis ip-up script
          let username = iface
          try { username = fs.readFileSync(`/var/run/radfast-ppp/${iface}.user`, 'utf8').trim() } catch {}
          l2tp.push({ name: username, iface, rx, tx })
        } catch {}
      }
    } catch {}
  }

  res.json({ wg, l2tp, ts })
})

module.exports = router
