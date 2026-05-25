/**
 * Safe shell helpers — prevent command injection.
 *
 * Usage:
 *   const { runCmd, validateIdent, validatePort } = require('../lib/safeShell')
 *   await runCmd('systemctl', ['start', `genieacs-${name}`])
 */
const { execFile, execFileSync } = require('child_process')

const IDENT_RE = /^[a-z][a-z0-9_-]{0,62}$/   // safe service / file identifier
const USERNAME_RE = /^[a-zA-Z0-9_.-]{1,64}$/  // chap-secret username, etc.
const HEX_RE   = /^[a-f0-9]{1,128}$/i

function validateIdent(s, label = 'identifier') {
  if (typeof s !== 'string' || !IDENT_RE.test(s)) {
    const err = new Error(`Invalid ${label}.`)
    err.status = 400
    throw err
  }
  return s
}

function validateUsername(s) {
  if (typeof s !== 'string' || !USERNAME_RE.test(s)) {
    const err = new Error('Invalid username.')
    err.status = 400
    throw err
  }
  return s
}

function validatePort(n) {
  const port = parseInt(n, 10)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    const err = new Error('Invalid port.')
    err.status = 400
    throw err
  }
  return port
}

function validateHex(s, label = 'value') {
  if (typeof s !== 'string' || !HEX_RE.test(s)) {
    const err = new Error(`Invalid ${label}.`)
    err.status = 400
    throw err
  }
  return s
}

/**
 * Promise-based execFile (no shell). Args MUST be an array.
 */
function runCmd(file, args = [], opts = {}) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(args)) return reject(new Error('args must be array'))
    execFile(file, args, { timeout: 30_000, ...opts }, (err, stdout, stderr) => {
      if (err) {
        err.stderr = stderr?.toString().slice(0, 1000) || ''
        return reject(err)
      }
      resolve({ stdout: stdout?.toString() || '', stderr: stderr?.toString() || '' })
    })
  })
}

function runCmdSync(file, args = [], opts = {}) {
  if (!Array.isArray(args)) throw new Error('args must be array')
  return execFileSync(file, args, { encoding: 'utf8', timeout: 10_000, ...opts })
}

module.exports = {
  IDENT_RE, USERNAME_RE,
  validateIdent, validateUsername, validatePort, validateHex,
  runCmd, runCmdSync,
}
