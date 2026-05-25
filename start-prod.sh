#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  RadFast ACS — Production Startup Script
#  Usage  : sudo bash start-prod.sh
#           bash start-prod.sh          (beberapa langkah butuh sudo)
#
#  Apa yang dilakukan:
#    1. Pre-flight checks (Node, pnpm, .env, data dirs)
#    2. Install dependencies backend & frontend (jika belum)
#    3. Build frontend (Vue → dist)
#    4. Buat data/logs directory
#    5. Start/restart backend via pm2 (auto-survive reboot)
#    6. Setup pm2 startup hook (sekali saja)
#    7. Start VPN services (strongswan, xl2tpd, wg-quick@wg0) jika terinstall
#    8. Tampilkan status ringkas
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail
IFS=$'\n\t'

# ─── Warna output ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

ok()   { echo -e "  ${GREEN}[✓]${RESET} $*"; }
info() { echo -e "  ${CYAN}[i]${RESET} $*"; }
warn() { echo -e "  ${YELLOW}[!]${RESET} $*"; }
err()  { echo -e "  ${RED}[✗]${RESET} $*" >&2; }
die()  { err "$*"; echo; exit 1; }
step() { echo -e "\n${BOLD}${CYAN}── $* ──${RESET}"; }

# ─── Resolve paths ────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/backend"
FRONTEND_DIR="${SCRIPT_DIR}/frontend"
DATA_DIR="${BACKEND_DIR}/data"
LOG_DIR="${DATA_DIR}/logs"

echo
echo -e "${BOLD}  ██████╗  █████╗ ██████╗ ███████╗ █████╗ ███████╗████████╗${RESET}"
echo -e "${BOLD}  ██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔══██╗██╔════╝╚══██╔══╝${RESET}"
echo -e "${BOLD}  ██████╔╝███████║██║  ██║█████╗  ███████║███████╗   ██║   ${RESET}"
echo -e "${BOLD}  ██╔══██╗██╔══██║██║  ██║██╔══╝  ██╔══██║╚════██║   ██║   ${RESET}"
echo -e "${BOLD}  ██║  ██║██║  ██║██████╔╝██║     ██║  ██║███████║   ██║   ${RESET}"
echo -e "${BOLD}  ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝     ╚═╝  ╚═╝╚══════╝   ╚═╝   ${RESET}"
echo
echo -e "${BOLD}  RadFast ACS Admin Panel — Production Startup${RESET}"
echo -e "  ══════════════════════════════════════════════"

# ══════════════════════════════════════════════════════════════════════════════
step "1/7  Pre-flight checks"
# ══════════════════════════════════════════════════════════════════════════════

# Node.js
command -v node >/dev/null 2>&1 || die "Node.js tidak terinstall. Install dulu: https://nodejs.org/"
NODE_VER="$(node -v)"
ok "Node.js ${NODE_VER}"

# Minimum Node 18
NODE_MAJOR="$(node -e 'process.stdout.write(process.versions.node.split(".")[0])')"
if (( NODE_MAJOR < 18 )); then
    die "Node.js minimal versi 18. Sekarang: ${NODE_VER}"
fi

# pnpm
if command -v pnpm >/dev/null 2>&1; then
    PKG="pnpm"
    ok "pnpm $(pnpm -v)"
elif command -v npm >/dev/null 2>&1; then
    PKG="npm"
    warn "pnpm tidak ditemukan — fallback ke npm. Install pnpm: npm i -g pnpm"
else
    die "npm / pnpm tidak ditemukan."
fi

# pm2
if ! command -v pm2 >/dev/null 2>&1; then
    info "pm2 belum terinstall. Menginstall..."
    npm install -g pm2 || die "Gagal install pm2."
fi
ok "pm2 $(pm2 -v)"

# .env
if [[ ! -f "${BACKEND_DIR}/.env" ]]; then
    if [[ -f "${BACKEND_DIR}/.env.example" ]]; then
        warn ".env tidak ada — menyalin dari .env.example"
        cp "${BACKEND_DIR}/.env.example" "${BACKEND_DIR}/.env"
        warn "PENTING: Edit ${BACKEND_DIR}/.env — ganti JWT_SECRET, ADMIN_PASSWORD_HASH, ALLOWED_ORIGINS!"
    else
        die "${BACKEND_DIR}/.env tidak ada dan .env.example tidak ditemukan."
    fi
else
    ok ".env ditemukan"
fi

# Validasi .env tidak pakai default placeholder yang berbahaya
if grep -q "CHANGE_ME\|your_secret\|admin123" "${BACKEND_DIR}/.env" 2>/dev/null; then
    warn ".env masih mengandung nilai placeholder. Ganti sebelum expose ke publik!"
fi

# ── Auto-generate password hash jika masih default / kosong ────────────────
DEFAULT_HASH_FRAGMENT="DvRQJktYbyea0DUjphIkfeTaz9L"
NEED_HASH=0

grep -q "${DEFAULT_HASH_FRAGMENT}" "${BACKEND_DIR}/.env" 2>/dev/null && NEED_HASH=1
grep -qE "^ADMIN_PASSWORD_HASH=$" "${BACKEND_DIR}/.env" 2>/dev/null && NEED_HASH=1

if [[ "${NEED_HASH}" -eq 1 ]]; then
    echo
    echo -e "  ${YELLOW}════════════════════════════════════════════════${RESET}"
    info "Password admin masih default — membuat hash baru (bcrypt cost=12)..."
    echo -e "  ${YELLOW}════════════════════════════════════════════════${RESET}"

    # Pastikan bcryptjs ada
    if [[ ! -d "${BACKEND_DIR}/node_modules/bcryptjs" ]]; then
        info "Install backend deps dulu untuk generate hash..."
        cd "${BACKEND_DIR}"
        $PKG install --prod 2>&1 | tail -3
    fi

    cd "${BACKEND_DIR}"
    set +e
    node scripts/set-admin-password.js --gen
    HASH_RC=$?
    set -e

    if [[ "${HASH_RC}" -ne 0 ]]; then
        warn "Gagal auto-generate password (exit ${HASH_RC}). Jalankan manual:"
        warn "  cd backend && node scripts/set-admin-password.js --gen"
    else
        ok "Password baru berhasil di-hash dan disimpan ke .env"
    fi
    cd "${SCRIPT_DIR}"
    echo -e "  ${YELLOW}════════════════════════════════════════════════${RESET}"
    echo
else
    ok "Password hash sudah dikonfigurasi"
fi

# ══════════════════════════════════════════════════════════════════════════════
step "2/7  Buat direktori data"
# ══════════════════════════════════════════════════════════════════════════════

mkdir -p "${LOG_DIR}"
chmod 750 "${DATA_DIR}" "${LOG_DIR}"
ok "Data dir: ${DATA_DIR}"
ok "Log  dir: ${LOG_DIR}"

# ══════════════════════════════════════════════════════════════════════════════
step "3/7  Install backend dependencies"
# ══════════════════════════════════════════════════════════════════════════════

cd "${BACKEND_DIR}"

# Deteksi node_modules dari Windows (ada .cmd file = cross-platform copy)
BACKEND_REINSTALL=0
if [[ ! -d "node_modules/express" ]]; then
    BACKEND_REINSTALL=1
elif ls node_modules/.bin/*.cmd >/dev/null 2>&1; then
    warn "node_modules backend terdeteksi dari Windows — reinstall untuk Linux..."
    BACKEND_REINSTALL=1
elif [[ ! -f "node_modules/lodash/defaults.js" ]] && [[ -d "node_modules/hpp" ]]; then
    warn "lodash/defaults tidak ada (hpp dependency) — reinstall..."
    BACKEND_REINSTALL=1
fi

if [[ "${BACKEND_REINSTALL}" -eq 1 ]]; then
    info "Clean install backend deps..."
    rm -rf node_modules package-lock.json pnpm-lock.yaml 2>/dev/null || true
    $PKG install 2>&1 | tail -8
else
    info "Backend node_modules OK — skip install"
fi
ok "Backend deps OK"

# ══════════════════════════════════════════════════════════════════════════════
step "4/7  Build frontend"
# ══════════════════════════════════════════════════════════════════════════════

cd "${FRONTEND_DIR}"

# ── Deteksi node_modules dari Windows (ada .cmd tapi tidak ada Linux binding) ─
NEEDS_REINSTALL=0
if [[ ! -d "node_modules/vue" ]]; then
    NEEDS_REINSTALL=1
elif [[ -f "node_modules/.bin/vite.CMD" ]]; then
    # .CMD file = di-copy dari Windows
    warn "node_modules terdeteksi dari Windows — reinstall untuk Linux bindings..."
    NEEDS_REINSTALL=1
elif [[ ! -f "node_modules/.bin/vite" ]]; then
    NEEDS_REINSTALL=1
fi

# Cek apakah ada rolldown binding Linux yang dibutuhkan
if [[ "${NEEDS_REINSTALL}" -eq 0 ]]; then
    if ! ls node_modules/rolldown/dist/*.linux-x64*.node >/dev/null 2>&1 && \
       ls node_modules/rolldown/dist/*.win32*.node >/dev/null 2>&1; then
        warn "rolldown binding Windows ditemukan di Linux — reinstall..."
        NEEDS_REINSTALL=1
    fi
fi

if [[ "${NEEDS_REINSTALL}" -eq 1 ]]; then
    info "Menginstall frontend deps (clean install untuk platform Linux)..."
    rm -rf node_modules package-lock.json pnpm-lock.yaml 2>/dev/null || true
    $PKG install 2>&1 | tail -8
    ok "Frontend deps terinstall"
else
    info "node_modules OK — skip install"
fi

# Fix executable bit — hilang saat git clone / scp / rsync
chmod +x node_modules/.bin/* 2>/dev/null || true

info "Building frontend (Vue → dist)..."
if ! $PKG run build; then
    warn "Build via ${PKG} gagal — mencoba langsung via node..."
    node node_modules/vite/bin/vite.js build || die "Frontend build gagal. Cek error di atas."
fi
ok "Frontend berhasil di-build → frontend/dist"

# ══════════════════════════════════════════════════════════════════════════════
step "5/7  Start backend via pm2"
# ══════════════════════════════════════════════════════════════════════════════

cd "${SCRIPT_DIR}"
ECOSYSTEM="${SCRIPT_DIR}/ecosystem.config.js"

# Stop existing instance dulu (ignore error jika belum jalan)
pm2 stop  radfast-admin 2>/dev/null || true
pm2 delete radfast-admin 2>/dev/null || true

# Start dengan ecosystem config
if [[ -f "${ECOSYSTEM}" ]]; then
    pm2 start "${ECOSYSTEM}" --env production
else
    # Fallback: langsung start server.js
    pm2 start "${BACKEND_DIR}/server.js" \
        --name radfast-admin \
        --cwd "${BACKEND_DIR}" \
        --node-args "--max-old-space-size=256" \
        --max-memory-restart 300M \
        --restart-delay 2000 \
        --log "${LOG_DIR}/pm2-out.log" \
        --error "${LOG_DIR}/pm2-err.log" \
        --time \
        --env NODE_ENV=production
fi

# Save pm2 process list
pm2 save
ok "Backend berjalan via pm2"

# ══════════════════════════════════════════════════════════════════════════════
step "6/7  Setup pm2 startup (survive reboot)"
# ══════════════════════════════════════════════════════════════════════════════

# Cek apakah startup sudah terkonfigurasi
if pm2 startup 2>&1 | grep -q "already"; then
    ok "pm2 startup sudah dikonfigurasi"
elif [[ "${EUID}" -eq 0 ]]; then
    # Jalan sebagai root — bisa langsung setup
    pm2 startup systemd -u "$(logname 2>/dev/null || echo root)" --hp "/root" 2>/dev/null || \
        pm2 startup 2>/dev/null || true
    pm2 save
    ok "pm2 startup dikonfigurasi — backend auto-start saat reboot"
else
    # Tidak sebagai root — tampilkan perintah yang harus dijalankan
    STARTUP_CMD="$(pm2 startup 2>/dev/null | grep 'sudo' | tail -1 || true)"
    if [[ -n "${STARTUP_CMD}" ]]; then
        warn "Jalankan perintah berikut untuk auto-start saat reboot:"
        echo -e "\n    ${BOLD}${STARTUP_CMD}${RESET}\n"
        warn "Lalu jalankan: pm2 save"
    else
        info "Jalankan: sudo pm2 startup && pm2 save"
    fi
fi

# ══════════════════════════════════════════════════════════════════════════════
step "7/7  Start VPN services"
# ══════════════════════════════════════════════════════════════════════════════

VPN_STARTED=0

# strongswan (IPsec untuk L2TP)
if systemctl list-unit-files 2>/dev/null | grep -q "strongswan"; then
    if systemctl is-active --quiet strongswan 2>/dev/null; then
        ok "strongswan sudah running"
    else
        info "Memulai strongswan..."
        systemctl enable --now strongswan 2>/dev/null && ok "strongswan started" || warn "Gagal start strongswan"
    fi
    VPN_STARTED=1
fi

# xl2tpd (L2TP daemon)
if systemctl list-unit-files 2>/dev/null | grep -q "xl2tpd"; then
    if systemctl is-active --quiet xl2tpd 2>/dev/null; then
        ok "xl2tpd sudah running"
    else
        info "Memulai xl2tpd..."
        systemctl enable --now xl2tpd 2>/dev/null && ok "xl2tpd started" || warn "Gagal start xl2tpd"
    fi
    VPN_STARTED=1
fi

# WireGuard
if systemctl list-unit-files 2>/dev/null | grep -q "wg-quick@wg0"; then
    if systemctl is-active --quiet "wg-quick@wg0" 2>/dev/null; then
        ok "wg-quick@wg0 sudah running"
    else
        info "Memulai WireGuard wg0..."
        systemctl enable --now "wg-quick@wg0" 2>/dev/null && ok "WireGuard wg0 started" || warn "Gagal start wg-quick@wg0"
    fi
    VPN_STARTED=1
elif [[ -f /etc/wireguard/wg0.conf ]]; then
    info "wg0.conf ada tapi unit belum ada — mencoba wg-quick up..."
    wg-quick up wg0 2>/dev/null && ok "WireGuard wg0 up" || warn "Gagal wg-quick up wg0"
    VPN_STARTED=1
fi

if [[ "${VPN_STARTED}" -eq 0 ]]; then
    info "VPN services belum terinstall (normal jika belum setup VPN)."
    info "Install via dashboard → halaman VPN."
fi

# ── IP Detection ──────────────────────────────────────────────────────────────
SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'YOUR_VPS_IP')"

# ── Tunggu backend benar-benar siap ──────────────────────────────────────────
info "Menunggu backend siap..."
READY=0
for i in $(seq 1 15); do
    if curl -sf "http://localhost:9000/api/health" >/dev/null 2>&1; then
        READY=1; break
    fi
    sleep 1
done

echo
echo -e "  ${BOLD}══════════════════════════════════════════════${RESET}"
if [[ "${READY}" -eq 1 ]]; then
    echo -e "  ${GREEN}${BOLD}[✓] RadFast Admin berjalan!${RESET}"
else
    echo -e "  ${YELLOW}[!] Backend belum merespons — cek: pm2 logs radfast-admin${RESET}"
fi
echo
echo -e "  ${BOLD}Dashboard${RESET}  : http://${SERVER_IP}:9000"
echo -e "  ${BOLD}API Health${RESET} : http://${SERVER_IP}:9000/api/health"
echo -e "  ${BOLD}Log backend${RESET}: ${LOG_DIR}/pm2-out.log"
echo
echo -e "  ${BOLD}Perintah berguna:${RESET}"
echo -e "    pm2 status            — cek status proses"
echo -e "    pm2 logs radfast-admin — lihat log real-time"
echo -e "    pm2 restart radfast-admin — restart backend"
echo -e "    pm2 monit             — monitor CPU/RAM"
echo
echo -e "  ${YELLOW}[!] Pastikan firewall membuka port: 9000, 500, 4500, 1701 (UDP), 51820 (UDP)${RESET}"
echo -e "  ${BOLD}══════════════════════════════════════════════${RESET}"
echo
