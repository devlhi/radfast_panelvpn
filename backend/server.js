// ─── RadFast ACS — Hardened API server ───────────────────────────────────────
const config = require('./config') // validates secrets early
const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const hpp = require('hpp')
const cookieParser = require('cookie-parser')
const path = require('path')
const fs = require('fs')

const audit = require('./lib/audit')
const errors = require('./lib/errors')
const auth = require('./middleware/auth')
const csrf = require('./lib/csrf')
const threatGuard = require('./middleware/threatGuard')
const { apiLimiter, provisionLimiter } = require('./lib/limiters')

const app = express()

// ── Trust proxy (only when explicitly enabled) ─────────────────────────────
if (config.trustProxy) app.set('trust proxy', config.trustProxy)
app.disable('x-powered-by')
app.disable('etag')

// ── Security headers (helmet) ──────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,          // kita define sendiri semua directive
    directives: {
      'default-src':        ["'self'"],
      // Vite 6 / rolldown build: butuh module preload + inline modulepreload polyfill
      'script-src':         ["'self'", "'unsafe-inline'"],
      'script-src-attr':    ["'none'"],
      'style-src':          ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src':           ["'self'", 'https://fonts.gstatic.com', 'data:'],
      'img-src':            ["'self'", 'data:', 'blob:'],
      // API calls dari frontend ke backend (same-origin)
      'connect-src':        ["'self'"],
      'worker-src':         ["'self'", 'blob:'],
      'frame-ancestors':    ["'none'"],
      'object-src':         ["'none'"],
      'base-uri':           ["'self'"],
      'form-action':        ["'self'"],
      // Hanya aktifkan upgrade-insecure-requests jika benar-benar pakai HTTPS
      'upgrade-insecure-requests': config.useHttps ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'same-site' },
  referrerPolicy: { policy: 'no-referrer' },
  // HSTS + upgrade-insecure-requests hanya aktif jika HTTPS=true di .env
  // Jangan aktifkan di HTTP — browser akan blokir semua assets
  hsts: config.useHttps ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
}))

// ── CORS — strict allow-list (credentials enabled for cookie auth) ────────
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true) // same-origin / non-browser
    if (config.allowedOrigins.includes(origin)) return cb(null, true)
    return cb(new Error('Not allowed by CORS'))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', csrf.HEADER_NAME],
  exposedHeaders: ['Retry-After'],
  maxAge: 600,
}))

// ── Body parsers (capped) ──────────────────────────────────────────────────
app.use(express.json({ limit: '256kb', strict: true }))
app.use(express.urlencoded({ extended: false, limit: '64kb' }))
app.use(cookieParser())
app.use(hpp())

// Slow-loris hardening + extra header hygiene
app.use((req, res, next) => {
  req.socket.setTimeout(30_000)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  next()
})

// ── Health (no auth, no rate limit) ────────────────────────────────────────
app.get('/api/health', (req, res) => {
  // server_ip di sini supaya bisa diambil frontend tanpa auth
  const { execFileSync } = require('child_process')
  let serverIp = ''
  try { serverIp = execFileSync('hostname', ['-I'], { encoding: 'utf8' }).trim().split(/\s+/)[0] || '' } catch {}
  res.json({ status: 'ok', uptime: process.uptime(), server_ip: serverIp })
})

// ── Static frontend (HARUS sebelum CSRF & threat guard) ───────────────────
// File CSS/JS/img tidak butuh CSRF token — serve langsung tanpa lewat middleware API
const distPath = path.join(__dirname, '..', 'frontend', 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, {
    maxAge: '7d',
    etag: true,
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
      }
    },
  }))
}

// ── Threat detection / IP blocker ─────────────────────────────────────────
app.use(threatGuard)

// ── CSRF protection (after cookie-parser, before mutating routes) ─────────
app.use(csrf.verify)

// ── Global API rate limiter ────────────────────────────────────────────────
app.use('/api', apiLimiter)

// ── Public auth routes ─────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'))

// ── Provisioning API (server-to-server, API key auth, separate rate-limit) ─
app.use('/api/provision', require('./lib/provisioningAuth'), provisionLimiter, require('./routes/provision'))

// ── Protected routes ───────────────────────────────────────────────────────
app.use('/api/instances', auth, require('./routes/instances'))
app.use('/api/vpn',       auth, require('./routes/vpn'))
app.use('/api/monitor',   auth, require('./routes/monitor'))
app.use('/api/security',  require('./routes/security'))

// ── SPA fallback (semua non-API route → index.html) ───────────────────────
if (fs.existsSync(distPath)) {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

// ── 404 + error handler ────────────────────────────────────────────────────
app.use(errors.notFound)
app.use(errors.handler)

// ── Crash safety nets ──────────────────────────────────────────────────────
process.on('unhandledRejection', (reason) => {
  audit.record('process.unhandled_rejection', { reason: String(reason).slice(0, 500) })
  console.error('[unhandledRejection]', reason)
})
process.on('uncaughtException', (err) => {
  audit.record('process.uncaught_exception', { msg: err.message })
  console.error('[uncaughtException]', err)
  setTimeout(() => process.exit(1), 100).unref?.()
})

// ── Start ──────────────────────────────────────────────────────────────────
const server = app.listen(config.port, () => {
  console.log(`\n  ██████╗  █████╗ ██████╗ ███████╗ █████╗ ███████╗████████╗`)
  console.log(`  ██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔══██╗██╔════╝╚══██╔══╝`)
  console.log(`  ██████╔╝███████║██║  ██║█████╗  ███████║███████╗   ██║   `)
  console.log(`  ██╔══██╗██╔══██║██║  ██║██╔══╝  ██╔══██║╚════██║   ██║   `)
  console.log(`  ██║  ██║██║  ██║██████╔╝██║     ██║  ██║███████║   ██║   `)
  console.log(`  ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝     ╚═╝  ╚═╝╚══════╝   ╚═╝   `)
  console.log(`\n  🚀 RadFast ACS Admin API — http://localhost:${config.port}`)
  console.log(`  🛡  helmet · rate-limit · bcrypt · 2FA · CSRF · audit-log · threat-guard`)
  console.log(`  🍪 Cookie auth: httpOnly · ${config.isProd ? 'secure' : 'dev'} · sameSite=strict`)
  console.log(`  🌐 CORS allowed: ${config.allowedOrigins.join(', ') || '(none)'}`)
  console.log(`  📁 Audit log dir: ${config.auditLogDir}`)
  console.log(`  🌱 NODE_ENV=${process.env.NODE_ENV || 'development'}\n`)
})

server.headersTimeout = 60_000
server.requestTimeout = 30_000
server.keepAliveTimeout = 5_000
