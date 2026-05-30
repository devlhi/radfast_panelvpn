/**
 * Persistent provisioning API key store.
 *
 * Priority:
 * 1. Runtime key saved in backend/data/provisioning-api.json
 * 2. PROVISIONING_API_KEY from .env as fallback
 *
 * Dashboard updates write to disk so key can change without server restart.
 */
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const config = require('../config')

const DATA_DIR = path.join(__dirname, '..', 'data')
const KEY_FILE = path.join(DATA_DIR, 'provisioning-api.json')

function readSaved() {
  try {
    const raw = fs.readFileSync(KEY_FILE, 'utf8')
    const obj = JSON.parse(raw)
    if (!obj || typeof obj !== 'object') return null
    if (!obj.apiKey || typeof obj.apiKey !== 'string') return null
    return obj
  } catch {
    return null
  }
}

function writeSaved(apiKey) {
  fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o750 })
  const payload = {
    apiKey,
    updatedAt: new Date().toISOString(),
  }
  const tmp = KEY_FILE + '.' + process.pid + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), { mode: 0o600 })
  fs.renameSync(tmp, KEY_FILE)
  return payload
}

function getKey() {
  const saved = readSaved()
  if (saved?.apiKey) return saved.apiKey
  return config.provisioningApiKey || ''
}

function parseDate(value) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function daysSince(value) {
  const d = parseDate(value)
  if (!d) return null
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000))
}

function isoAfterDays(value, days) {
  const d = parseDate(value)
  if (!d) return null
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString()
}

function getMeta() {
  const saved = readSaved()
  const apiKey = saved?.apiKey || config.provisioningApiKey || ''
  const source = saved?.apiKey ? 'dashboard' : (config.provisioningApiKey ? 'env' : 'none')
  const updatedAt = saved?.updatedAt || process.env.PROVISIONING_API_KEY_UPDATED_AT || null
  const ageDays = daysSince(updatedAt)
  const maxAgeDays = config.provisioning.keyMaxAgeDays
  const warnAgeDays = config.provisioning.keyWarnAgeDays
  const expired = ageDays !== null && ageDays >= maxAgeDays
  const rotateRecommended = ageDays !== null && ageDays >= warnAgeDays

  return {
    enabled: Boolean(apiKey),
    source,
    masked: mask(apiKey),
    updatedAt,
    ageDays,
    maxAgeDays,
    warnAgeDays,
    expiresAt: updatedAt ? isoAfterDays(updatedAt, maxAgeDays) : null,
    rotateRecommended,
    expired,
    enforceExpiry: config.provisioning.enforceExpiry,
    warning: buildWarning({ source, updatedAt, ageDays, maxAgeDays, warnAgeDays, expired, rotateRecommended }),
  }
}

function buildWarning(meta) {
  if (!meta.updatedAt && meta.source === 'env') {
    return 'API key dari environment belum punya PROVISIONING_API_KEY_UPDATED_AT; usia key tidak bisa dihitung.'
  }
  if (meta.expired) return `API key sudah lebih dari ${meta.maxAgeDays} hari. Rotate sekarang.`
  if (meta.rotateRecommended) return `API key berusia ${meta.ageDays} hari. Disarankan rotate sebelum ${meta.maxAgeDays} hari.`
  return ''
}

function setKey(apiKey) {
  const key = String(apiKey || '').trim()
  if (key.length < 32) throw new Error('API key minimal 32 karakter.')
  return writeSaved(key)
}

function generateKey() {
  return 'rfprov_' + crypto.randomBytes(32).toString('hex')
}

function rotate() {
  const apiKey = generateKey()
  const saved = writeSaved(apiKey)
  return { apiKey, ...saved }
}

function mask(apiKey) {
  const key = String(apiKey || '')
  if (!key) return ''
  if (key.length <= 12) return '••••'
  return `${key.slice(0, 8)}••••${key.slice(-6)}`
}

module.exports = { getKey, getMeta, setKey, generateKey, rotate, mask }
