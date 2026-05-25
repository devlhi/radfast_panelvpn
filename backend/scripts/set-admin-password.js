#!/usr/bin/env node
/**
 * RadFast Admin — Password reset / recovery utility.
 *
 * Modes:
 *   Interactive (default):
 *       node scripts/set-admin-password.js
 *
 *   Non-interactive (recovery / scripted):
 *       node scripts/set-admin-password.js --password "MySafePass!23"
 *       node scripts/set-admin-password.js --username admin2 --password "Pass!" --reset-2fa
 *       node scripts/set-admin-password.js --gen           # generate strong random password
 *       node scripts/set-admin-password.js --gen --reset-2fa --no-strict
 *
 * Flags:
 *   --username <name>   Rename admin (optional).
 *   --password <pass>   Set password directly (no prompt). Use single quotes on Linux.
 *   --gen               Auto-generate a 20-char random password and print it.
 *   --reset-2fa         Wipe data/admin-2fa.json so login skips TOTP step.
 *   --no-strict         Skip complexity rules (dev only — still enforces min length 8).
 *   -h, --help          Show this help.
 *
 * Exit codes:
 *   0 success    1 invalid args    2 .env missing    3 password too weak
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const readline = require('readline')
const bcrypt = require('bcryptjs')

const ENV_PATH = path.join(__dirname, '..', '.env')
const TWOFA_PATH = path.join(__dirname, '..', 'data', 'admin-2fa.json')

// ─── arg parsing ───────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const opts = { username: null, password: null, gen: false, reset2fa: false, strict: true, help: false }

for (let i = 0; i < args.length; i++) {
  const a = args[i]
  switch (a) {
    case '-h': case '--help':       opts.help = true; break
    case '--gen':                   opts.gen = true; break
    case '--reset-2fa':             opts.reset2fa = true; break
    case '--no-strict':             opts.strict = false; break
    case '--username':              opts.username = args[++i]; break
    case '--password':              opts.password = args[++i]; break
    default:
      console.error(`❌ Unknown flag: ${a}`)
      process.exit(1)
  }
}

if (opts.help) {
  console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0])
  process.exit(0)
}

// ─── helpers ───────────────────────────────────────────────────────────────
function askPlain(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    rl.question(question, (ans) => { rl.close(); resolve(ans) })
  })
}

// Mask password input char-by-char without hiding the prompt label.
function askSilent(question) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      // Piped input — fall back to plain readline (still no echo of the value).
      return askPlain(question).then(resolve)
    }
    process.stdout.write(question)
    let captured = ''
    const onData = (chunk) => {
      const s = chunk.toString('utf8')
      for (const ch of s) {
        if (ch === '\r' || ch === '\n') {
          process.stdin.removeListener('data', onData)
          try { process.stdin.setRawMode(false) } catch {}
          process.stdin.pause()
          process.stdout.write('\n')
          return resolve(captured)
        }
        if (ch === '\x03') { // Ctrl+C
          try { process.stdin.setRawMode(false) } catch {}
          process.stdout.write('\n')
          process.exit(130)
        }
        if (ch === '\x7f' || ch === '\b') { // backspace
          if (captured.length > 0) {
            captured = captured.slice(0, -1)
            process.stdout.write('\b \b')
          }
          continue
        }
        if (ch >= ' ' && ch !== '\x1b') { // printable, ignore escape sequences
          captured += ch
          process.stdout.write('*')
        }
      }
    }
    try { process.stdin.setRawMode(true) } catch {}
    process.stdin.resume()
    process.stdin.on('data', onData)
  })
}

function ask(question, { silent = false } = {}) {
  return silent ? askSilent(question) : askPlain(question)
}

function genPassword(len = 20) {
  // Mix from each pool to satisfy strict rules.
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const digit = '23456789'
  const symb  = '!@#$%^&*()-_=+[]{}'
  const all   = upper + lower + digit + symb
  const pick  = (set) => set[crypto.randomInt(set.length)]
  let pwd = pick(upper) + pick(lower) + pick(digit) + pick(symb)
  while (pwd.length < len) pwd += pick(all)
  // Shuffle.
  return pwd.split('').sort(() => crypto.randomInt(3) - 1).join('')
}

function validatePassword(pwd, strict) {
  if (typeof pwd !== 'string') return '❌ Password kosong.'
  const minLen = strict ? 12 : 8
  if (pwd.length < minLen)         return `❌ Minimal ${minLen} karakter.`
  if (pwd.length > 256)            return '❌ Maksimal 256 karakter.'
  if (!strict) return null
  if (!/[A-Z]/.test(pwd))          return '❌ Harus ada huruf besar.'
  if (!/[a-z]/.test(pwd))          return '❌ Harus ada huruf kecil.'
  if (!/[0-9]/.test(pwd))          return '❌ Harus ada angka.'
  if (!/[^a-zA-Z0-9]/.test(pwd))   return '❌ Harus ada simbol.'
  return null
}

function upsertEnv(envText, key, value) {
  const re = new RegExp(`^${key}=.*$`, 'm')
  return re.test(envText) ? envText.replace(re, `${key}=${value}`) : envText.trimEnd() + `\n${key}=${value}\n`
}

// ─── main ──────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(ENV_PATH)) {
    console.error(`❌ .env tidak ditemukan: ${ENV_PATH}`)
    console.error('   Salin dari .env.example dulu.')
    process.exit(2)
  }

  console.log('\n🔐 RadFast Admin — Password Recovery\n')

  // Resolve username
  let username = opts.username
  if (!username && opts.password === null && !opts.gen) {
    username = (await ask('Username admin (Enter untuk skip rename): ')).trim() || null
  }

  // Resolve password
  let pwd = opts.password
  if (opts.gen) {
    pwd = genPassword(20)
    console.log(`🎲 Password generated: ${pwd}\n   ⚠ Simpan sekarang — tidak akan ditampilkan lagi.\n`)
  } else if (pwd === null) {
    pwd = await ask('Password baru: ', { silent: true })
    const pwd2 = await ask('Konfirmasi password: ', { silent: true })
    if (pwd !== pwd2) { console.error('❌ Password tidak cocok.'); process.exit(3) }
  }

  // Validate
  const err = validatePassword(pwd, opts.strict)
  if (err) { console.error(err); process.exit(3) }

  // Hash + write
  const hash = bcrypt.hashSync(pwd, 12)
  let env = fs.readFileSync(ENV_PATH, 'utf8')
  env = upsertEnv(env, 'ADMIN_PASSWORD_HASH', hash)
  if (username) env = upsertEnv(env, 'ADMIN_USERNAME', username)

  fs.writeFileSync(ENV_PATH, env, { mode: 0o600 })
  console.log('')
  console.log('═══════════════════════════════════════════════════════')
  console.log('  ✅ BERHASIL — password admin sudah di-update di .env')
  console.log('═══════════════════════════════════════════════════════')
  console.log(`  Username : ${username || '(tidak diubah)'}`)
  console.log(`  Password : ${opts.gen ? pwd : '(seperti yang Anda input)'}`)
  console.log('═══════════════════════════════════════════════════════')

  // Reset 2FA if requested
  if (opts.reset2fa) {
    if (fs.existsSync(TWOFA_PATH)) {
      fs.unlinkSync(TWOFA_PATH)
      console.log('🗝  2FA secret dihapus — login berikutnya skip TOTP.')
    } else {
      console.log('🗝  2FA belum aktif — tidak ada yang dihapus.')
    }
  }

  console.log('')
  console.log('⚠  PENTING: Backend WAJIB di-restart agar hash baru terbaca.')
  console.log('   Wrapper (reset-password.bat / .sh) akan otomatis melakukannya.')
  console.log('')
}

main().catch((e) => { console.error('💥 Error:', e.message); process.exit(1) })
