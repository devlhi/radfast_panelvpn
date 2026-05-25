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

      // ── Write xl2tpd.conf ─────────────────────────────────────────────────
      fs.mkdirSync('/etc/xl2tpd', { recursive: true })
      fs.writeFileSync('/etc/xl2tpd/xl2tpd.conf', [
        '[global]', 'port = 1701', '',
        '[lns default]',
        'ip range = 192.168.42.10-192.168.42.100',
        'local ip = 192.168.42.1',
        'require chap = yes', 'refuse pap = yes', 'require authentication = yes',
        'name = RadFastVPN', 'pppoptfile = /etc/ppp/options.xl2tpd',
        'length bit = yes',
      ].join('\n') + '\n', { mode: 0o644 })

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

      // ── Save config & default user ────────────────────────────────────────
      writeJSON(L2TP_CFG_FILE, { psk, server_ip: getServerIP(), subnet: '192.168.42.0/24' })

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
  if (!fs.existsSync(L2TP_CFG_FILE)) {
    return res.json({ psk: null, server_ip: getServerIP(), subnet: '192.168.42.0/24' })
  }
  const cfg = readJSON(L2TP_CFG_FILE) || {}
  res.json({ ...cfg, server_ip: getServerIP() })
})

router.put(
  '/l2tp/config',
  body('psk').isString().isLength({ min: 12, max: 64 }).matches(/^[a-zA-Z0-9!@#$%^&*()_+=-]+$/),
  (req, res) => {
    if (!handleValidation(req, res)) return
    const psk = req.body.psk
    const cfg = fs.existsSync(L2TP_CFG_FILE) ? readJSON(L2TP_CFG_FILE) || {} : {}
    cfg.psk = psk
    writeJSON(L2TP_CFG_FILE, cfg)

    if (isLinux) {
      try {
        fs.writeFileSync('/etc/ipsec.secrets', `: PSK "${psk}"\n`, { mode: 0o600 })
        try { runCmdSync('ipsec', ['rereadsecrets']) } catch {}
        try { runCmdSync('ipsec', ['reload']) } catch {}
      } catch {}
    }
    audit.record('vpn.l2tp.psk_rotate', {}, req)
    res.json({ message: 'PSK updated.' })
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
  body('password').isString().isLength({ min: 8, max: 128 }).matches(/^[\x21-\x7e]+$/),
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

// RouterOS config — render only from validated stored data.
router.get(
  '/l2tp/mikrotik/:username',
  param('username').isString().matches(/^[a-zA-Z0-9_.-]{1,64}$/),
  (req, res) => {
    if (!handleValidation(req, res)) return
    const user = readJSON(L2TP_USERS_FILE).find(u => u.username === req.params.username)
    if (!user) return res.status(404).json({ message: 'User tidak ditemukan.' })

    const cfg = fs.existsSync(L2TP_CFG_FILE) ? readJSON(L2TP_CFG_FILE) || {} : {}
    const serverIP = getServerIP()
    const psk = cfg.psk || 'YOUR_PSK'

    audit.record('vpn.l2tp.mikrotik_view', { username: user.username }, req)

    const config = `/interface l2tp-client
add name="vpn-radfast" connect-to=${serverIP} user="${user.username}" password="${user.password}" \\
    use-ipsec=yes ipsec-secret="${psk}" \\
    disabled=no add-default-route=no profile=default-encryption

/ip route
add dst-address=192.168.42.0/24 gateway="vpn-radfast" comment="RadFast ACS VPN"

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
        'Address = 10.8.1.1/24',
        `ListenPort = ${port}`,
        `PrivateKey = ${priv}`,
        'PostUp   = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE',
        'PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE',
      ].join('\n') + '\n', { mode: 0o600 })

      try { fs.writeFileSync('/proc/sys/net/ipv4/ip_forward', '1') } catch {}
      await runCmd('systemctl', ['enable', '--now', 'wg-quick@wg0'])

      writeJSON(WG_CFG_FILE, {
        port, server_ip: getServerIP(),
        server_pubkey: pub, subnet: '10.8.1.0/24', next_ip: 2,
      })

      audit.record('vpn.wg.install', { port }, req)
      res.json({ message: 'WireGuard berhasil diinstall.', server_pubkey: pub, port })
    } catch (e) {
      res.status(500).json({ message: 'Install WireGuard gagal.' })
    }
  },
)

router.get('/wireguard/config', (req, res) => {
  if (!fs.existsSync(WG_CFG_FILE)) {
    return res.json({ server_pubkey: null, server_ip: getServerIP(), port: 51820, subnet: '10.8.1.0/24' })
  }
  const cfg = readJSON(WG_CFG_FILE) || {}
  res.json({ ...cfg, server_ip: getServerIP() })
})

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
      : { port: 51820, subnet: '10.8.1.0/24', next_ip: 2 }

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

    const peerIP = `10.8.1.${cfg.next_ip || 2}`
    cfg.next_ip = (cfg.next_ip || 2) + 1
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

    const cfg = fs.existsSync(WG_CFG_FILE) ? (readJSON(WG_CFG_FILE) || {}) : {}
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
    allowed-address=10.8.1.0/24 \\
    persistent-keepalive=25s

/ip address
add interface="wg-radfast" address="${peer.peer_ip}/24"

/ip route
add dst-address=10.8.1.0/24 gateway="wg-radfast" comment="RadFast ACS"

# Verifikasi:
/interface wireguard peers print`

    res.json({ config, server_ip: serverIP, peer_ip: peer.peer_ip })
  },
)

// Legacy compat
router.get('/clients', (req, res) => {
  res.json({ clients: readJSON(VPN_DATA), status: { running: svcRunning('openvpn@server') } })
})

module.exports = router
