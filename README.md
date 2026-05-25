# RadFast ACS — Admin Panel

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=nodedotjs" />
  <img src="https://img.shields.io/badge/Vue-3-4FC08D?style=flat-square&logo=vuedotjs" />
  <img src="https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express" />
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" />
</p>

> **Multi-tenant GenieACS command center for ISPs.**  
> Kelola ratusan GenieACS instance, VPN MikroTik (L2TP/IPsec + WireGuard), dan monitoring sistem — semua dari satu dashboard yang aman dan cepat.

---

## ✨ Fitur

| Fitur | Keterangan |
|-------|------------|
| 🖥️ Multi-instance | Kelola banyak GenieACS instance, port & DB auto-assign |
| 🔐 Auth hardened | bcrypt + 2FA TOTP + JWT cookie + CSRF protection |
| 🌐 VPN MikroTik | L2TP/IPsec (all RouterOS) + WireGuard (RouterOS 7+) |
| 📋 ROS Config | Auto-generate config paste-ready untuk Winbox/terminal |
| 📊 Live Monitor | CPU, RAM, disk, network metrics real-time |
| 🛡️ Security | Helmet, rate-limit, audit log, brute-force protection |

---

## 🚀 Instalasi — Production (Ubuntu/Debian VPS)

### ⚡ Satu Perintah (Direkomendasikan)

Tidak perlu clone manual — jalankan langsung di VPS:

```bash
curl -fsSL https://raw.githubusercontent.com/devlhi/radfast_panelvpn/main/install.sh | sudo bash
```

Atau download dulu, lalu jalankan:

```bash
wget -qO install.sh https://raw.githubusercontent.com/devlhi/radfast_panelvpn/main/install.sh
sudo bash install.sh
```

Script otomatis akan melakukan:

| # | Langkah | Keterangan |
|---|---------|------------|
| 1 | Install Node.js 20 LTS | via NodeSource (apt/yum/dnf) |
| 2 | Install pnpm + pm2 | global via npm |
| 3 | Download source code | git clone atau tarball dari GitHub |
| 4 | Setup `.env` | generate JWT_SECRET + bcrypt password admin |
| 5 | Build frontend | `npm install` + `npm run build` (Vue → dist) |
| 6 | Start via pm2 | auto-restart jika crash, log ke `data/logs/` |
| 7 | pm2 startup | survive reboot otomatis |

> **Password admin** ditampilkan saat instalasi — **catat sekarang**, tidak bisa ditampilkan ulang.

### Prasyarat

- Ubuntu 20.04+ / Debian 11+ / CentOS 8+
- Akses root / sudo
- Koneksi internet

### Akses Dashboard

Setelah instalasi selesai:

```
http://YOUR_SERVER_IP:9000
```

### Reset Password

```bash
cd /opt/radfast-admin
node backend/scripts/set-admin-password.js --gen
pm2 restart radfast-admin
```

---

## 🔄 Update Panel

```bash
curl -fsSL https://raw.githubusercontent.com/devlhi/radfast_panelvpn/main/install.sh | sudo bash
```

Script otomatis melakukan `git pull`, rebuild frontend, dan restart pm2. `.env` lama dibackup & dipulihkan.

---

## 💻 Development (Windows/Mac/Linux)

### Prasyarat
- Node.js 18+
- pnpm (`npm i -g pnpm`)

### Jalankan

**Windows** — double-click `start.bat`

**Linux/Mac:**
```bash
# Terminal 1 — Backend
cd backend && cp .env.example .env && npm install && node server.js

# Terminal 2 — Frontend
cd frontend && npm install && npm run dev
```

Akses: `http://localhost:5173`

---

## 🌐 VPN Setup (MikroTik)

### L2TP/IPsec (semua RouterOS)

1. Buka dashboard → halaman **VPN** → tab **L2TP/IPsec**
2. Klik **Install L2TP** (hanya di VPS Linux)
3. Tambah user via **Add User**
4. Klik **ROS Config** pada user → copy perintah ke terminal MikroTik

### WireGuard (RouterOS 7+)

1. Tab **WireGuard** → klik **Install WireGuard**
2. Tambah peer via **Add Peer**
3. Klik **ROS Config** → paste ke terminal MikroTik

### IP Pool

| Protocol | Server | Client Pool |
|----------|--------|-------------|
| L2TP/IPsec | `192.168.42.1` | `192.168.42.10 – 192.168.42.100` |
| WireGuard | `10.8.1.1` | `10.8.1.2` dst |

---

## 🖥️ GenieACS Instance

Setelah login ke dashboard, buka menu **Instances** untuk install dan kelola GenieACS:

- Isi **Instance Name** → port UI, CWMP, dan nama database di-assign otomatis
- Klik **Start** / **Stop** untuk kontrol instance
- Setiap instance berjalan sebagai systemd service (`genieacs-<nama>-ui`, `-cwmp`, `-nbi`, `-fs`)

---

## 🔧 Manajemen

```bash
pm2 status                      # Status proses
pm2 logs radfast-admin          # Log real-time
pm2 restart radfast-admin       # Restart backend
pm2 monit                       # Monitor CPU/RAM
```

---

## 🛡️ Keamanan

- **Jangan expose port 9000 ke publik** tanpa Nginx + SSL
- Gunakan `HTTPS=true` di `.env` setelah setup SSL untuk aktifkan HSTS
- Rate limit login: 5x per 15 menit, lockout 30 menit setelah 8 gagal
- Semua aksi tercatat di `backend/data/logs/audit-*.log`

### Firewall (UFW)

```bash
ufw allow 9000/tcp      # Dashboard
ufw allow 500/udp       # IPsec IKE
ufw allow 4500/udp      # IPsec NAT-T
ufw allow 1701/udp      # L2TP
ufw allow 51820/udp     # WireGuard
ufw enable
```

---

## 📁 Struktur Proyek

```
radfast_panelvpn/
├── backend/
│   ├── server.js          # Express server
│   ├── config.js          # Konfigurasi & validasi
│   ├── routes/            # API routes (auth, instances, vpn, monitor)
│   ├── middleware/        # Auth middleware
│   ├── lib/               # Helpers (csrf, audit, rateLimit, dll)
│   ├── scripts/           # Utility scripts
│   └── .env.example       # Template environment
├── frontend/
│   └── src/
│       ├── views/         # Dashboard, Instances, VPN, Monitor, Login
│       ├── stores/        # Pinia stores (auth)
│       └── layouts/       # MainLayout
├── install.sh             # One-command installer (curl | bash)
├── start.bat              # Dev starter (Windows)
├── start-prod.sh          # Production starter (Linux — jika sudah clone)
├── reset-password.bat     # Reset password (Windows)
├── reset-password.sh      # Reset password (Linux)
└── ecosystem.config.js    # pm2 config
```

---

## 📄 License

MIT © 2026 RadFast
