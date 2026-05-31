/**
 * Persistent IP allowlist for the provisioning API.
 *
 * Saat daftar KOSONG → semua IP boleh (allowlist non-aktif, perilaku lama).
 * Saat daftar TERISI → hanya IP / CIDR di daftar yang boleh memanggil
 * endpoint /api/provision/* (selain tetap wajib X-API-Key yang valid).
 *
 * Disimpan ke backend/data/provisioning-allowlist.json supaya bisa diubah
 * dari dashboard tanpa restart server.
 */
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'data')
const FILE = path.join(DATA_DIR, 'provisioning-allowlist.json')

// ── Normalisasi: buang prefix IPv4-mapped IPv6 (::ffff:127.0.0.1 → 127.0.0.1)
function normalizeIp(ip) {
  let s = String(ip || '').trim()
  if (!s) return ''
  const m = s.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i)
  if (m) s = m[1]
  return s
}

function isValidIPv4(s) {
  const m = String(s).match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!m) return false
  return m.slice(1).every(o => Number(o) >= 0 && Number(o) <= 255)
}

function isValidIPv4Cidr(s) {
  const m = String(s).match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/)
  if (!m) return false
  const prefix = Number(m[2])
  return isValidIPv4(m[1]) && prefix >= 0 && prefix <= 32
}

// IPv6 sederhana (exact match saja, tanpa CIDR) — cukup untuk ::1 / alamat penuh.
function isValidIPv6(s) {
  return /^[0-9a-fA-F:]+$/.test(String(s)) && String(s).includes(':')
}

function isValidEntry(s) {
  const v = String(s || '').trim()
  return isValidIPv4(v) || isValidIPv4Cidr(v) || isValidIPv6(v)
}

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, o) => (acc << 8 >>> 0) + Number(o), 0) >>> 0
}

function ipv4InCidr(ip, cidr) {
  const [range, prefixStr] = cidr.split('/')
  const prefix = Number(prefixStr)
  if (!isValidIPv4(ip) || !isValidIPv4(range)) return false
  if (prefix === 0) return true
  const mask = prefix === 32 ? 0xffffffff : (~(0xffffffff >>> prefix)) >>> 0
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(range) & mask)
}

function readSaved() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8')
    const obj = JSON.parse(raw)
    if (!obj || !Array.isArray(obj.allow)) return { allow: [], updatedAt: null }
    return { allow: obj.allow.filter(isValidEntry), updatedAt: obj.updatedAt || null }
  } catch {
    return { allow: [], updatedAt: null }
  }
}

function writeSaved(allow) {
  fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o750 })
  const payload = { allow, updatedAt: new Date().toISOString() }
  const tmp = FILE + '.' + process.pid + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), { mode: 0o600 })
  fs.renameSync(tmp, FILE)
  return payload
}

function getList() {
  return readSaved().allow
}

function getMeta() {
  const saved = readSaved()
  return {
    enabled: saved.allow.length > 0,
    allow: saved.allow,
    count: saved.allow.length,
    updatedAt: saved.updatedAt,
  }
}

// Simpan daftar baru. Buang duplikat, normalisasi spasi, validasi tiap entri.
function setList(input) {
  const arr = Array.isArray(input) ? input : []
  const cleaned = []
  const seen = new Set()
  for (const raw of arr) {
    const v = String(raw || '').trim()
    if (!v) continue
    if (!isValidEntry(v)) {
      throw new Error(`Entri allowlist tidak valid: "${v}". Pakai IPv4, IPv4/CIDR, atau IPv6.`)
    }
    if (seen.has(v)) continue
    seen.add(v)
    cleaned.push(v)
  }
  if (cleaned.length > 200) throw new Error('Maksimal 200 entri allowlist.')
  return writeSaved(cleaned)
}

// Inti pengecekan: dipakai middleware provisioningAuth.
function isAllowed(ip) {
  const list = getList()
  if (list.length === 0) return true // allowlist non-aktif → izinkan semua
  const norm = normalizeIp(ip)
  if (!norm) return false
  for (const entry of list) {
    if (entry.includes('/')) {
      if (ipv4InCidr(norm, entry)) return true
    } else if (normalizeIp(entry) === norm) {
      return true
    }
  }
  return false
}

module.exports = {
  getList,
  getMeta,
  setList,
  isAllowed,
  isValidEntry,
  normalizeIp,
}
