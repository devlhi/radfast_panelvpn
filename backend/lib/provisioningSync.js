/**
 * Provisioning env sync — tulis RADFAST_ADMIN_* ke .env instance GenieACS.
 *
 * Dipakai oleh:
 *   - Endpoint manual  : POST /api/auth/provisioning-key/sync
 *   - Otomatis saat create instance (dashboard & provisioning API)
 *
 * Semua fungsi DIRANCANG TIDAK melempar error ke pemanggil create flow —
 * kegagalan sync TIDAK boleh menggagalkan pembuatan instance. Hasil sukses/
 * gagal dikembalikan sebagai objek supaya bisa di-log/ditampilkan.
 */
const fs = require('fs')
const path = require('path')
const { upsertEnv } = require('./envWriter')
const { runCmd } = require('./safeShell')
const keyStore = require('./provisioningKeyStore')

const isWin = process.platform === 'win32'

const NAME_RE = /^[a-z][a-z0-9_-]{0,62}$/

function instancesDir() {
  return process.env.ACS_INSTANCES_DIR || '/opt/genieacs-instances'
}

function adminUrl() {
  return (process.env.RADFAST_ADMIN_URL || 'http://127.0.0.1:9000').replace(/\/+$/, '')
}

/**
 * Tulis RADFAST_ADMIN_URL / RADFAST_ADMIN_API_KEY / RADFAST_INSTANCE_NAME ke
 * .env satu instance secara atomik. Mengembalikan { name, ok, error? }.
 * Tidak melempar.
 */
function syncInstanceEnv(name, apiKey) {
  if (isWin) return { name, ok: false, error: 'windows-dev-mode' }
  if (!NAME_RE.test(String(name || ''))) return { name, ok: false, error: 'nama instance tidak valid' }

  const key = apiKey || keyStore.getKey()
  if (!key) return { name, ok: false, error: 'API key belum diset' }

  const envPath = path.join(instancesDir(), name, '.env')
  try {
    if (!fs.existsSync(envPath)) return { name, ok: false, error: '.env tidak ada' }
    let env = fs.readFileSync(envPath, 'utf8')
    env = upsertEnv(env, 'RADFAST_ADMIN_URL', adminUrl())
    env = upsertEnv(env, 'RADFAST_ADMIN_API_KEY', key)
    env = upsertEnv(env, 'RADFAST_INSTANCE_NAME', name)
    const tmp = envPath + `.tmp-${process.pid}-${Date.now()}`
    fs.writeFileSync(tmp, env, { mode: 0o600 })
    fs.renameSync(tmp, envPath)
    return { name, ok: true }
  } catch (e) {
    return { name, ok: false, error: (e.message || '').slice(-200) }
  }
}

/** Restart genieacs-multi-proxy. Mengembalikan { ok, error? }. Tidak melempar. */
async function restartMultiProxy() {
  if (isWin) return { ok: false, error: 'windows-dev-mode' }
  try {
    await runCmd('systemctl', ['restart', 'genieacs-multi-proxy'], { timeout: 60_000 })
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e.stderr || e.message || '').slice(-300) }
  }
}

/**
 * Sync semua instance yang ada lalu restart proxy.
 * Mengembalikan { results, okCount, total, proxy }.
 */
async function syncAllInstances() {
  const apiKey = keyStore.getKey()
  if (!apiKey) return { results: [], okCount: 0, total: 0, proxy: { ok: false, error: 'API key belum diset' }, noKey: true }

  let names = []
  try {
    names = fs.readdirSync(instancesDir(), { withFileTypes: true })
      .filter(d => d.isDirectory() && NAME_RE.test(d.name))
      .map(d => d.name)
  } catch (e) {
    return { results: [], okCount: 0, total: 0, proxy: { ok: false }, error: `Gagal baca direktori instance: ${e.message}` }
  }

  const results = names.map(n => syncInstanceEnv(n, apiKey))
  const okCount = results.filter(r => r.ok).length
  const proxy = await restartMultiProxy()
  return { results, okCount, total: results.length, proxy }
}

/**
 * Auto-sync untuk SATU instance yang baru dibuat: tulis env saja.
 *
 * PENTING: TIDAK restart multi-proxy di sini. Alasan:
 *   1. add-instance.sh sudah me-restart genieacs-multi-proxy di akhir run,
 *      jadi restart kedua kalinya dari panel hanya menggandakan disrupsi.
 *   2. Panel admin itu sendiri di-serve lewat multi-proxy (:9000) — restart
 *      saat HTTP response belum terkirim bisa memutus koneksi ke browser.
 *
 * Aman dipanggil dari create flow — selalu resolve, tidak pernah reject.
 */
async function autoSyncOnCreate(name) {
  if (isWin) return { ok: false, skipped: true }
  const env = syncInstanceEnv(name)
  return { env, proxy: { ok: false, skipped: true }, ok: env.ok }
}

module.exports = {
  syncInstanceEnv,
  restartMultiProxy,
  syncAllInstances,
  autoSyncOnCreate,
}
