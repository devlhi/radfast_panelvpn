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

function getMeta() {
  const saved = readSaved()
  const apiKey = saved?.apiKey || config.provisioningApiKey || ''
  return {
    enabled: Boolean(apiKey),
    source: saved?.apiKey ? 'dashboard' : (config.provisioningApiKey ? 'env' : 'none'),
    masked: mask(apiKey),
    updatedAt: saved?.updatedAt || null,
  }
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
  writeSaved(apiKey)
  return apiKey
}

function mask(apiKey) {
  const key = String(apiKey || '')
  if (!key) return ''
  if (key.length <= 12) return '••••'
  return `${key.slice(0, 8)}••••${key.slice(-6)}`
}

module.exports = { getKey, getMeta, setKey, generateKey, rotate, mask }
