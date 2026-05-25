# 🔐 RadFast Admin — Security Hardening Notes

Backend ini telah di-harden dengan multi-layer defense. Dokumen ini menjelaskan
arsitektur keamanan, prosedur operasional, dan checklist sebelum naik ke produksi.

---

## Default Credentials

| Field      | Value                                  |
|------------|----------------------------------------|
| Username   | `admin`                                |
| Password   | `RadFast@eb14acd61a88`                 |

⚠️ **Wajib ganti password sebelum naik produksi.** Lihat seksi *Rotate Admin Password*.

---

## Threat Model & Mitigation

| Ancaman                                 | Mitigasi                                                                 |
|-----------------------------------------|--------------------------------------------------------------------------|
| Brute force login                       | `express-rate-limit` (5 fail / 15 min) + lockout 30 min @ 8 fail         |
| Timing attack pada username             | `crypto.timingSafeEqual` + dummy bcrypt compare untuk user invalid       |
| Plaintext password disk                 | `bcryptjs` cost-12 hash di `.env`                                        |
| Session hijack via XSS (localStorage)   | **Auth via httpOnly cookie** `rf_session` + `sameSite=strict` + `secure` (prod) |
| JWT lemah / weak secret                 | Min 48 char enforced di `config.js`; HS256 + iss/aud/jti + amr claims    |
| Token replay / lost device              | **JWT revocation list** (`lib/tokenStore.js`); logout & 2FA-verify burn jti |
| Credential phishing / pwd-only auth     | **TOTP 2FA** (`lib/twofa.js`) + 10 recovery codes (bcrypt cost 8)        |
| Cross-site request forgery              | **HMAC double-submit** (`lib/csrf.js`) — cookie `XSRF-TOKEN` + header `X-CSRF-Token` |
| XSS / clickjacking                      | `helmet` strict CSP + `X-Frame-Options: DENY` + `frame-ancestors 'none'` |
| CORS bypass                             | Allow-list origin via `ALLOWED_ORIGINS` (callback-based, `credentials:true`) |
| HTTP parameter pollution                | `hpp()` middleware                                                       |
| Command injection (shell)               | `child_process.execFile` + array args via `lib/safeShell.js`             |
| Path traversal pada nama instance/peer  | Regex validators di `safeShell.validateIdent` + `express-validator`      |
| Header injection / oversize body        | `express.json({ limit: '256kb', strict: true })` + body parser limits    |
| Information disclosure (stack trace)    | `lib/errors.js` menyembunyikan detail saat `NODE_ENV=production`         |
| Slow-loris                              | `headersTimeout: 60s`, `requestTimeout: 30s`, `socket.setTimeout(30s)`   |
| Server fingerprinting                   | `app.disable('x-powered-by')`, `etag` off                                |
| Audit blind                             | JSON-lines audit log harian di `data/logs/audit-YYYY-MM-DD.log` + fail2ban filter |

---

## Operasional

### Rotate Admin Password
```powershell
Set-Location c:\laragon\www\radfast-admin\backend
node .\scripts\set-admin-password.js
```
Script wajib: min 12 char, uppercase, lowercase, digit, simbol.
Setelah update, restart server.

### Rotate JWT Secret
```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```
Tempel hasil ke `JWT_SECRET=` di `.env`, restart server.
**Efek**: semua user existing di-paksa login ulang.

### Audit Log
- Lokasi: `backend/data/logs/audit-YYYY-MM-DD.log`
- Format: 1 event per baris, JSON.
- Field sensitif (`password`, `token`, `psk`, `privkey`) otomatis di-strip.
- Event type: `auth.login.success`, `auth.login.fail`, `auth.login.locked`,
  `auth.token_rejected`, `auth.token_revoked_attempt`, `2fa.verify_fail`,
  `2fa.enabled`, `2fa.disabled`, `ratelimit.hit`, `vpn.l2tp.*`, `vpn.wg.*`,
  `instance.*`, `error`, `process.unhandled_rejection`.

### Cek Live Audit (PowerShell)
```powershell
Get-Content -Path .\data\logs\audit-*.log -Wait -Tail 20
```

### Aktifkan 2FA Admin
1. Login normal di `/login`.
2. Buka `/settings`, klik **Aktifkan 2FA**.
3. Scan QR di Google Authenticator / Authy / 1Password.
4. Masukkan 6-digit kode untuk konfirmasi.
5. **Simpan 10 recovery codes** yang muncul SEKALI — tidak bisa diakses ulang.
6. Login berikutnya akan minta kode 2FA setelah password.

Lost device? Pakai recovery code (`XXXX-XXXX-XXXX`) di prompt 2FA — sekali pakai. Bila habis, disable + re-enroll dari console (`backend/data/admin-2fa.json`).

---

## Production Checklist

Sebelum deploy ke server publik:

- [ ] Set `NODE_ENV=production` di `.env`
- [ ] Generate `JWT_SECRET` baru (96-char hex)
- [ ] Generate `CSRF_SECRET` baru ATAU biarkan auto-derived dari JWT (ok)
- [ ] Ganti admin password via `scripts/set-admin-password.js`
- [ ] **Aktifkan 2FA** di `/settings` setelah login pertama (HIGHLY RECOMMENDED)
- [ ] Set `ALLOWED_ORIGINS` ke domain produksi saja (https only)
- [ ] Set `TRUST_PROXY=1` jika di belakang Nginx/Cloudflare
- [ ] Pasang Nginx/Caddy reverse proxy + Let's Encrypt TLS
- [ ] Tambah firewall rule: hanya 80/443 publik, port 9000 hanya localhost
- [ ] Mount `backend/data/` di volume persistent (untuk audit log + 2FA secret)
- [ ] Setup log rotation eksternal (`logrotate`) untuk `data/logs/`
- [ ] Setup process supervisor: `pm2`, `systemd`, atau Docker dengan restart policy
- [ ] Backup `.env`, `data/instances.json`, `data/admin-2fa.json` (mode 0600!) secara terjadwal
- [ ] Pasang **fail2ban** dengan filter `backend/security/fail2ban/radfast-admin.conf`
- [ ] Aktifkan **GitHub Actions security workflow** (`.github/workflows/security.yml`)
- [ ] Jalankan **pen-test smoke** sebelum go-live: `pwsh security/pen-test.ps1 -BaseUrl https://...`

### Contoh systemd unit
```ini
[Unit]
Description=RadFast Admin API
After=network.target

[Service]
Type=simple
User=radfast
WorkingDirectory=/opt/radfast-admin/backend
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/radfast-admin/backend/data
PrivateTmp=true
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

### Contoh Nginx upstream
```nginx
server {
  listen 443 ssl http2;
  server_name admin.radfast.id;

  ssl_certificate     /etc/letsencrypt/live/admin.radfast.id/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/admin.radfast.id/privkey.pem;

  client_max_body_size 1m;
  proxy_read_timeout   30s;

  location / {
    proxy_pass         http://127.0.0.1:9000;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Forwarded-Proto $scheme;
  }
}
```

---

## Known Trade-offs

1. **Token blacklist in-memory** — hilang saat restart, jadi semua session reset (fail-secure). OK untuk single-node; ganti `lib/tokenStore.js` ke Redis bila scale-out.
2. **Login lockout in-memory** — sama seperti di atas; hilang saat restart. Pasang Redis backend bila perlu shared state.
3. **2FA secret tersimpan plaintext (base32)** di `data/admin-2fa.json` mode 0o600 — perlindungan filesystem-only. Rotate jika file pernah ter-expose.
4. **Recovery codes hash-only** (bcrypt cost 8) — jika seluruh `admin-2fa.json` bocor, attacker tidak bisa langsung pakai recovery code, tapi bisa offline-brute. Code 12-char hex sudah cukup kuat.
5. **Custom CSRF (HMAC double-submit)** — bukan `csrf-csrf`/`csurf` sehingga lebih ringan namun perlu audit manual saat ada perubahan cookie/header naming.

---

## Security Tooling

### Local pen-test smoke
```powershell
# Pastikan backend running
pwsh -NoProfile -File .\security\pen-test.ps1
# Custom target:
pwsh -NoProfile -File .\security\pen-test.ps1 -BaseUrl https://admin.example.com
```
18 cases: helmet headers, JWT validation (alg=none, oversize, invalid), CSRF enforcement, rate-limit, injection inputs, leak checks. Restart server di antara runs jika rate-limiter sudah ter-trigger.

### CI Security (GitHub Actions)
Workflow di `.github/workflows/security.yml` jalan setiap push/PR + cron mingguan:
- `pnpm audit --prod --audit-level=high` (BE + FE)
- `gitleaks` (secret scan)
- `codeql` JavaScript security-extended
- `zap-baseline` (boots ephemeral server with random JWT, scans, exits)

### fail2ban (Linux server)
```bash
# 1) Filter
sudo cp backend/security/fail2ban/radfast-admin.conf /etc/fail2ban/filter.d/

# 2) Jail
sudo cat backend/security/fail2ban/jail-snippet.conf >> /etc/fail2ban/jail.local
sudo systemctl reload fail2ban

# Cek aktif
sudo fail2ban-client status radfast-admin
```

---

## Disclosure
Temukan kerentanan? Email security: `security@radfast.id` (PGP key on file).
