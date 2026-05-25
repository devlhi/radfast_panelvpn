/**
 * Threat detector — flags suspicious requests by inspecting URL, query,
 * headers, and body. Returns { score, tags[], category }.
 *
 * Score is additive (0-100+). Caller decides what to do with it:
 *   <  20  : informational
 *   20-49  : suspicious — log only
 *   50-79  : block this request
 *   >= 80  : ban IP for a while
 *
 * IMPORTANT: this module READS the request, never executes anything from it.
 * Detected payloads are returned for logging in a NEUTRALISED form
 * (base64 + length only) so the log file can never be source of replay.
 */

const PATTERNS = [
  // ── SQL injection ─────────────────────────────────────────────────────
  { tag: 'sqli',      score: 35, re: /(\bunion\s+select\b|\bselect\s.+\bfrom\b|\bor\s+1\s*=\s*1\b|\bdrop\s+table\b|\bsleep\s*\(|\bbenchmark\s*\(|\binformation_schema\b|--\s*$|\bxp_cmdshell\b)/i },
  { tag: 'sqli-tick', score: 15, re: /('|%27)\s*(or|and)\s*('|%27)?\s*\d/i },

  // ── XSS ───────────────────────────────────────────────────────────────
  { tag: 'xss',       score: 30, re: /<\s*script\b|javascript:|on(error|load|click|mouseover)\s*=/i },
  { tag: 'xss-svg',   score: 20, re: /<\s*(svg|iframe|embed|object)\b[^>]*on\w+\s*=/i },

  // ── Command injection ─────────────────────────────────────────────────
  { tag: 'cmdi',      score: 40, re: /(;|\||\|\||&&|\$\(|`)\s*(cat|wget|curl|nc|bash|sh|perl|python|powershell|cmd|whoami|id|uname|chmod|kill)\b/i },
  { tag: 'cmdi-bin',  score: 25, re: /\/bin\/(?:bash|sh|nc|busybox)\b/i },

  // ── Path traversal / LFI / RFI ────────────────────────────────────────
  { tag: 'lfi',       score: 35, re: /(\.\.\/){2,}|(\.\.\\){2,}|%2e%2e%2f|%2e%2e\\|\/etc\/passwd|\/proc\/self\/environ|c:\\windows\\(system32|win\.ini)/i },

  // ── SSRF / cloud metadata ─────────────────────────────────────────────
  { tag: 'ssrf',      score: 30, re: /\b(169\.254\.169\.254|metadata\.google\.internal|100\.100\.100\.200)\b/i },

  // ── Server-side template / SSTI / log4shell ───────────────────────────
  { tag: 'log4shell', score: 50, re: /\$\{jndi:(?:ldap|rmi|dns|ldaps|http)s?:\/\//i },
  { tag: 'ssti',      score: 25, re: /\{\{\s*[^}]*(\.|__).*\}\}|\{%\s*.*\bsystem\b.*%\}/i },

  // ── Web shells / suspicious filenames ─────────────────────────────────
  { tag: 'shell',     score: 35, re: /\b(c99|r57|wso|b374k|adminer)\.(php|aspx?|jsp)\b|\beval\s*\(\s*base64_decode/i },

  // ── Common scanner / sensitive paths ──────────────────────────────────
  { tag: 'scanner',   score: 25, re: /\.(env|git\/config|aws\/credentials|ssh\/(authorized_keys|id_rsa)|htpasswd|htaccess|svn\/entries|DS_Store)\b/i },
  { tag: 'php-probe', score: 15, re: /\b(phpinfo|wp-login\.php|wp-admin|xmlrpc\.php|administrator\/index\.php)\b/i },

  // ── Protocol abuse ────────────────────────────────────────────────────
  { tag: 'null-byte', score: 20, re: /%00|\x00/ },
  { tag: 'crlf',      score: 15, re: /(%0d%0a|\r\n)(set-cookie|content-type|location):/i },

  // ── Tooling fingerprints ──────────────────────────────────────────────
  { tag: 'tool-ua',   score: 30, re: /\b(sqlmap|nikto|acunetix|nessus|nmap\s*scripting|fimap|wpscan|dirbuster|gobuster|ffuf|hydra|metasploit|burpsuite\s*pro|zmap)\b/i },
]

// Suspicious paths that almost never occur in legitimate API traffic to us.
const SUSPECT_PATHS = [
  /\.php(\?|$)/i,
  /\/wp-(login|admin|content)\b/i,
  /\/(phpmyadmin|pma|adminer|mysql)\b/i,
  /\/\.env\b/i,
  /\/\.git\b/i,
  /\/cgi-bin\b/i,
  /\/(actuator|console|jmx-console)\b/i,
  /\/(boaform|HNAP1|hnap1)\b/i, // common router/IoT exploits
]

// Encoded / weird characters anywhere in the URL push the score up a bit.
function rawnessScore(s) {
  if (!s) return 0
  let n = 0
  if (/%[0-9a-f]{2}.*%[0-9a-f]{2}/i.test(s)) n += 5
  if (/(%25){2,}/i.test(s)) n += 10              // double-encoded
  if (/[\x00-\x08\x0e-\x1f]/.test(s)) n += 10    // raw control chars
  return n
}

function flatten(obj, depth = 0) {
  if (depth > 3 || obj == null) return ''
  if (typeof obj === 'string') return obj
  if (typeof obj !== 'object') return String(obj)
  const parts = []
  for (const k of Object.keys(obj)) {
    parts.push(k)
    parts.push(flatten(obj[k], depth + 1))
    if (parts.join('').length > 8000) break
  }
  return parts.join(' ')
}

function inspect(req) {
  const tags = new Set()
  let score = 0

  const url   = (req.originalUrl || req.url || '').toString()
  const ua    = (req.headers?.['user-agent'] || '').toString()
  const ref   = (req.headers?.referer || req.headers?.referrer || '').toString()
  const body  = req.body ? flatten(req.body) : ''
  const query = req.query ? flatten(req.query) : ''
  const haystack = `${url}\n${ua}\n${ref}\n${query}\n${body}`.slice(0, 16000)

  for (const p of PATTERNS) {
    if (p.re.test(haystack)) {
      tags.add(p.tag)
      score += p.score
    }
  }

  for (const p of SUSPECT_PATHS) {
    if (p.test(url)) {
      tags.add('suspect-path')
      score += 25
      break
    }
  }

  // Header sanity
  if (ua.length === 0) {
    tags.add('no-ua'); score += 5
  } else if (ua.length > 400) {
    tags.add('long-ua'); score += 5
  }

  // Method probing
  const m = (req.method || '').toUpperCase()
  if (['TRACE', 'TRACK', 'CONNECT'].includes(m)) {
    tags.add('odd-method'); score += 30
  }

  score += rawnessScore(url)

  // Category for UI grouping
  let category = 'normal'
  if (score >= 80) category = 'critical'
  else if (score >= 50) category = 'high'
  else if (score >= 20) category = 'medium'
  else if (score > 0)   category = 'low'

  return {
    score,
    tags: [...tags],
    category,
    haystackLen: haystack.length,
  }
}

module.exports = { inspect, PATTERNS }
