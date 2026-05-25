/**
 * Centralized configuration with strict validation.
 * Process exits early if critical secrets are missing or weak.
 */
require('dotenv').config()

const REQUIRED_SECRETS = ['JWT_SECRET', 'ADMIN_USERNAME', 'ADMIN_PASSWORD_HASH']

function fail(msg) {
  console.error(`\n❌ [config] ${msg}\n`)
  process.exit(1)
}

for (const key of REQUIRED_SECRETS) {
  if (!process.env[key] || !String(process.env[key]).trim()) {
    fail(`Environment variable "${key}" wajib diisi. Lihat .env.example.`)
  }
}

const jwtSecret = process.env.JWT_SECRET
if (jwtSecret.length < 48) {
  fail('JWT_SECRET terlalu pendek (min 48 char). Generate dengan: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"')
}

const weakSecrets = ['change', 'secret', 'default', 'radfast_super_secret']
if (weakSecrets.some(w => jwtSecret.toLowerCase().includes(w))) {
  fail('JWT_SECRET terdeteksi memakai pola lemah (default placeholder). Generate ulang.')
}

if (!/^\$2[aby]\$/.test(process.env.ADMIN_PASSWORD_HASH)) {
  fail('ADMIN_PASSWORD_HASH bukan format bcrypt valid. Jalankan: node scripts/set-admin-password.js')
}

const isProd = process.env.NODE_ENV === 'production'

// Production-specific guards
if (isProd) {
  if (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS.includes('localhost')) {
    console.warn('⚠️  [config] ALLOWED_ORIGINS masih mengandung "localhost" di production.')
  }
}

const allowedOrigins = String(process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean)

// CSRF secret: derived from JWT_SECRET if not explicitly provided.
const csrfSecret = process.env.CSRF_SECRET
  || require('crypto').createHash('sha256').update('csrf:' + jwtSecret).digest('hex')

// HTTPS hanya aktif jika eksplisit di-set — bukan hanya dari NODE_ENV
// Mencegah HSTS/upgrade-insecure-requests merusak setup HTTP
const useHttps = process.env.HTTPS === 'true'

module.exports = {
  isProd,
  useHttps,
  port: parseInt(process.env.PORT, 10) || 9000,
  trustProxy: Number(process.env.TRUST_PROXY || 0),
  allowedOrigins,
  csrfSecret,
  cookieName: process.env.AUTH_COOKIE_NAME || 'rf_session',

  jwt: {
    secret: jwtSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    issuer: process.env.JWT_ISSUER || 'radfast-admin',
    audience: process.env.JWT_AUDIENCE || 'radfast-admin-ui',
  },

  admin: {
    username: process.env.ADMIN_USERNAME,
    passwordHash: process.env.ADMIN_PASSWORD_HASH,
    totpSecret: process.env.ADMIN_TOTP_SECRET || '',
  },

  rateLimit: {
    loginMax:    parseInt(process.env.RATE_LIMIT_LOGIN_MAX, 10) || 5,
    loginWinMs:  (parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MIN, 10) || 15) * 60_000,
    apiMax:      parseInt(process.env.RATE_LIMIT_API_MAX, 10) || 240,
    apiWinMs:    (parseInt(process.env.RATE_LIMIT_API_WINDOW_MIN, 10) || 15) * 60_000,
  },

  lockout: {
    threshold:  parseInt(process.env.LOGIN_LOCKOUT_THRESHOLD, 10) || 8,
    durationMs: (parseInt(process.env.LOGIN_LOCKOUT_DURATION_MIN, 10) || 30) * 60_000,
  },

  auditLogDir: process.env.AUDIT_LOG_DIR || './data/logs',
}
