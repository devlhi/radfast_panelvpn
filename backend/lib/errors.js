/**
 * Centralised error handler.
 * Hides internal stack traces from clients.
 */
const audit = require('./audit')
const config = require('../config')

function notFound(req, res) {
  res.status(404).json({ message: 'Endpoint tidak ditemukan.' })
}

function handler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500
  const safeMessage = status >= 500 ? 'Internal server error.' : (err.expose ? err.message : err.message)

  // Log full info server-side
  audit.record('error', {
    status,
    msg: err.message,
    code: err.code || '',
  }, req)

  if (config.isProd) {
    // Don't leak stacks in prod
    return res.status(status).json({ message: status >= 500 ? 'Internal server error.' : safeMessage })
  }
  res.status(status).json({ message: safeMessage })
}

module.exports = { notFound, handler }
