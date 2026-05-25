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

### Prasyarat
- Ubuntu 20.04+ / Debian 11+
- Node.js 18+
- npm atau pnpm
- Git

### 1. Clone repository

```bash
git clone https://github.com/devlhi/radfast_panelvpn.git
cd radfast_panelvpn
```

### 2. Setup environment

```bash
cp backend/.env.example backend/.env
nano backend/.env
```

Edit minimal ini di `.env`:

```env
PORT=9000
JWT_SECRET=          # generate: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH= # akan di-generate otomatis saat pertama run
ALLOWED_ORIGINS=http://YOUR_SERVER_IP:9000
```

### 3. Jalankan startup script

```bash
chmod +x start-prod.sh
sudo bash start-prod.sh
```

Script otomatis akan:
- ✅ Install backend dependencies
- ✅ Build frontend (Vue → dist)
- ✅ Generate password admin + bcrypt hash → simpan ke `.env`
- ✅ Start backend via pm2 (auto-restart jika crash)
- ✅ Setup pm2 startup (survive reboot)
- ✅ Start VPN services (strongswan, xl2tpd, wg-quick) jika terinstall

### 4. Akses dashboard

```
http://YOUR_SERVER_IP:9000
```

Password admin ditampilkan saat pertama kali `start-prod.sh` dijalankan — **simpan baik-baik**.

Reset password kapan saja:
```bash
bash reset-password.sh --gen
```

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

## 🔧 Manajemen

```bash
pm2 status                      # Status proses
pm2 logs radfast-admin          # Log real-time
pm2 restart radfast-admin       # Restart backend
pm2 monit                       # Monitor CPU/RAM

bash reset-password.sh --gen    # Reset password admin
bash reset-password.sh --reset-2fa  # Reset 2FA
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
├── start.bat              # Dev starter (Windows)
├── start-prod.sh          # Production starter (Linux)
├── reset-password.bat     # Reset password (Windows)
├── reset-password.sh      # Reset password (Linux)
└── ecosystem.config.js    # pm2 config
```

---

## 📄 License

MIT © 2026 RadFast
