/**
 * Atomic .env updater — shared by the password-reset CLI and the in-app
 * "change password" endpoint.
 *
 * Writes are atomic (temp file + rename) so a crash mid-write can never leave
 * a truncated/corrupt .env. A one-time `.env.bak` backup is kept.
 */
const fs = require('fs')
const path = require('path')

const ENV_PATH = path.join(__dirname, '..', '.env')

/** Upsert a single KEY=value pair into an .env text blob. */
function upsertEnv(envText, key, value) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^${escapedKey}=.*$`, 'm')
  return re.test(envText)
    ? envText.replace(re, `${key}=${value}`)
    : envText.trimEnd() + `\n${key}=${value}\n`
}

/** Write contents to envPath atomically with a one-time backup. */
function writeEnvAtomic(contents, envPath = ENV_PATH) {
  const dir = path.dirname(envPath)
  const tmp = path.join(dir, `.env.tmp-${process.pid}-${Date.now()}`)
  try {
    fs.copyFileSync(envPath, `${envPath}.bak`)
  } catch { /* original may not exist yet — non-fatal */ }
  fs.writeFileSync(tmp, contents, { mode: 0o600 })
  fs.renameSync(tmp, envPath)
}

/**
 * Update one or more KEY=value pairs in the .env file atomically.
 * @param {Record<string,string>} pairs
 */
function updateEnv(pairs, envPath = ENV_PATH) {
  if (!fs.existsSync(envPath)) {
    throw new Error('.env tidak ditemukan di server.')
  }
  let env = fs.readFileSync(envPath, 'utf8')
  for (const [key, value] of Object.entries(pairs)) {
    env = upsertEnv(env, key, value)
  }
  writeEnvAtomic(env, envPath)
}

module.exports = { ENV_PATH, upsertEnv, writeEnvAtomic, updateEnv }
