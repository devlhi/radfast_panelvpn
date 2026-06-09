/**
 * activityLogger — catat SEMUA request yang mengubah data ke audit log.
 *
 * Menangkap setiap POST/PUT/PATCH/DELETE ke /api dan mencatat hasilnya
 * (status code) setelah response selesai. Ini jaring pengaman supaya tidak
 * ada aksi admin (restart, create, delete, dll) yang lolos dari Activity Log,
 * walaupun route-nya lupa memanggil audit.record secara manual.
 *
 * GET tidak dicatat (read-only, bising). Health-check juga dilewati.
 */
const audit = require('../lib/audit')

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// Path yang tidak perlu dicatat (read-only / bising / sensitif token).
const SKIP_PATHS = [
  '/api/health',
  '/api/auth/login',     // sudah dicatat detail di route (login.success/failure)
  '/api/auth/2fa',       // sudah dicatat detail di route
]

function shouldSkip(path) {
  return SKIP_PATHS.some(p => path.startsWith(p))
}

module.exports = function activityLogger(req, res, next) {
  const method = (req.method || '').toUpperCase()
  if (!MUTATING.has(method)) return next()

  const path = (req.originalUrl || req.url || '').split('?')[0]
  if (shouldSkip(path)) return next()

  const startedAt = Date.now()

  // Catat setelah response selesai supaya kita tahu status akhirnya.
  res.on('finish', () => {
    try {
      audit.record('activity.request', {
        action: `${method} ${path}`,
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
        ok: res.statusCode < 400,
      }, req)
    } catch {
      // jangan pernah ganggu request flow
    }
  })

  next()
}
