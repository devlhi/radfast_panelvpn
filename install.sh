#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  RadFast ACS — Admin Panel Installer
#
#  Usage:
#    git clone https://github.com/devlhi/radfast_panelvpn.git
#    cd radfast_panelvpn
#    sudo bash install.sh
#
#  Apa yang dilakukan:
#    1. Install Node.js 20 LTS (jika belum ada)
#    2. Install pnpm + pm2
#    3. Install backend dependencies
#    4. Build frontend (Vue → dist)
#    5. Setup .env + auto-generate password admin
#    6. Start via pm2 (auto-restart jika crash)
#    7. Setup pm2 startup (survive reboot)
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

ok()   { echo -e "  ${GREEN}[✓]${RESET} $*"; }
info() { echo -e "  ${CYAN}[i]${RESET} $*"; }
warn() { echo -e "  ${YELLOW}[!]${RESET} $*"; }
die()  { echo -e "\n  ${RED}[✗] ERROR: $*${RESET}\n" >&2; exit 1; }
step() { echo -e "\n${BOLD}${CYAN}── $* ──${RESET}"; }

# ─── Resolve path ─────────────────────────────────────────────────────────────
INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="${INSTALL_DIR}/backend"
FRONTEND="${INSTALL_DIR}/frontend"
LOG_DIR="${BACKEND}/data/logs"

echo
echo -e "${BOLD}  ██████╗  █████╗ ██████╗ ███████╗ █████╗ ███████╗████████╗${RESET}"
echo -e "${BOLD}  ██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔══██╗██╔════╝╚══██╔══╝${RESET}"
echo -e "${BOLD}  ██████╔╝███████║██║  ██║█████╗  ███████║███████╗   ██║   ${RESET}"
echo -e "${BOLD}  ██╔══██╗██╔══██║██║  ██║██╔══╝  ██╔══██║╚════██║   ██║   ${RESET}"
echo -e "${BOLD}  ██║  ██║██║  ██║██████╔╝██║     ██║  ██║███████║   ██║   ${RESET}"
echo -e "${BOLD}  ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝     ╚═╝  ╚═╝╚══════╝   ╚═╝  ${RESET}"
echo
echo -e "${BOLD}  RadFast ACS — Admin Panel Installer${RESET}"
echo -e "  ══════════════════════════════════════"

# ══════════════════════════════════════════════════════════════════════════════
step "1/6  Cek & install Node.js"
# ══════════════════════════════════════════════════════════════════════════════

NODE_MAJOR=0
command -v node >/dev/null 2>&1 \
  && NODE_MAJOR="$(node -e 'process.stdout.write(process.versions.node.split(".")[0])')"

if (( NODE_MAJOR >= 18 )); then
  ok "Node.js $(node -v) — OK"
else
  info "Install Node.js 20 LTS via NodeSource..."
  if command -v apt-get >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>&1 | tail -3
    apt-get install -y -qq nodejs 2>&1 | tail -3
  elif command -v yum >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - 2>&1 | tail -3
    yum install -y -q nodejs 2>&1 | tail -3
  else
    die "Package manager tidak dikenali. Install Node.js 18+ manual lalu jalankan ulang."
  fi
  ok "Node.js $(node -v) terinstall"
fi

# ══════════════════════════════════════════════════════════════════════════════
step "2/6  Install pnpm & pm2"
# ══════════════════════════════════════════════════════════════════════════════

if ! command -v pnpm >/dev/null 2>&1; then
  info "Install pnpm..."
  npm install -g pnpm 2>&1 | tail -3
fi
ok "pnpm $(pnpm -v)"

if ! command -v pm2 >/dev/null 2>&1; then
  info "Install pm2..."
  npm install -g pm2 2>&1 | tail -3
fi
ok "pm2 $(pm2 -v)"

# ══════════════════════════════════════════════════════════════════════════════
step "3/6  Setup .env & generate password admin"
# ══════════════════════════════════════════════════════════════════════════════

mkdir -p "${LOG_DIR}"
chmod 750 "${BACKEND}/data" "${LOG_DIR}"

if [[ ! -f "${BACKEND}/.env" ]]; then
  [[ -f "${BACKEND}/.env.example" ]] \
    && cp "${BACKEND}/.env.example" "${BACKEND}/.env" \
    || die ".env.example tidak ditemukan. Pastikan repo ter-clone lengkap."
  ok ".env dibuat dari .env.example"
fi

# Generate JWT_SECRET jika masih placeholder
if grep -qE "^JWT_SECRET=GANTI|^JWT_SECRET=$" "${BACKEND}/.env" 2>/dev/null; then
  NEW_SECRET="$(node -e "process.stdout.write(require('crypto').randomBytes(48).toString('hex'))")"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${NEW_SECRET}|" "${BACKEND}/.env"
  ok "JWT_SECRET di-generate otomatis"
fi

# ── Install backend deps (untuk generate hash) ────────────────────────────────
cd "${BACKEND}"
if [[ ! -d "node_modules/bcryptjs" ]]; then
  info "Install backend deps..."
  npm install 2>&1 | tail -5
fi

# Generate password hash jika masih default/kosong
DEFAULT_FRAG="DvRQJktYbyea0DUjphIkfeTaz9L"
NEED_HASH=0
grep -q "${DEFAULT_FRAG}" "${BACKEND}/.env" 2>/dev/null && NEED_HASH=1
grep -qE "^ADMIN_PASSWORD_HASH=$" "${BACKEND}/.env" 2>/dev/null && NEED_HASH=1

if [[ "${NEED_HASH}" -eq 1 ]]; then
  echo
  echo -e "  ${YELLOW}════════════════════════════════════════════════${RESET}"
  info "Generate password admin baru..."
  set +e
  node scripts/set-admin-password.js --gen
  set -e
  echo -e "  ${YELLOW}════════════════════════════════════════════════${RESET}"
  warn "Simpan password di atas sekarang!"
else
  ok "Password admin sudah dikonfigurasi"
fi

# ══════════════════════════════════════════════════════════════════════════════
step "4/6  Install & build frontend"
# ══════════════════════════════════════════════════════════════════════════════

cd "${FRONTEND}"

# Reinstall jika node_modules dari Windows (ada .cmd files)
if ls node_modules/.bin/*.cmd >/dev/null 2>&1; then
  warn "node_modules dari Windows terdeteksi — reinstall untuk Linux..."
  rm -rf node_modules package-lock.json pnpm-lock.yaml 2>/dev/null || true
fi

if [[ ! -d "node_modules/vue" ]]; then
  info "Install frontend deps..."
  npm install 2>&1 | tail -5
fi

chmod +x node_modules/.bin/* 2>/dev/null || true

info "Build frontend..."
npm run build || node node_modules/vite/bin/vite.js build \
  || die "Frontend build gagal. Cek error di atas."
ok "Frontend berhasil di-build"

# ══════════════════════════════════════════════════════════════════════════════
step "5/6  Start dengan pm2"
# ══════════════════════════════════════════════════════════════════════════════

cd "${INSTALL_DIR}"

pm2 stop  radfast-admin 2>/dev/null || true
pm2 delete radfast-admin 2>/dev/null || true

ECOSYSTEM="${INSTALL_DIR}/ecosystem.config.js"
if [[ -f "${ECOSYSTEM}" ]]; then
  pm2 start "${ECOSYSTEM}" --env production
else
  pm2 start "${BACKEND}/server.js" \
    --name radfast-admin \
    --cwd "${BACKEND}" \
    --max-memory-restart 300M \
    --restart-delay 2000 \
    --log "${LOG_DIR}/pm2-out.log" \
    --error "${LOG_DIR}/pm2-err.log" \
    --time \
    --env NODE_ENV=production
fi

pm2 save
ok "Backend berjalan via pm2"

# ══════════════════════════════════════════════════════════════════════════════
step "6/6  Setup auto-start saat reboot"
# ══════════════════════════════════════════════════════════════════════════════

if [[ "${EUID}" -eq 0 ]]; then
  pm2 startup systemd -u root --hp /root 2>/dev/null || pm2 startup 2>/dev/null || true
  pm2 save
  ok "pm2 startup dikonfigurasi"
else
  STARTUP_CMD="$(pm2 startup 2>/dev/null | grep 'sudo' | tail -1 || true)"
  if [[ -n "${STARTUP_CMD}" ]]; then
    warn "Jalankan ini untuk auto-start saat reboot:"
    echo -e "\n    ${BOLD}${STARTUP_CMD}${RESET}\n"
    warn "Lalu: pm2 save"
  fi
fi

# ── Health check ──────────────────────────────────────────────────────────────
info "Menunggu backend siap..."
for i in $(seq 1 15); do
  curl -sf "http://localhost:9000/api/health" >/dev/null 2>&1 && break
  sleep 1
done

# ── Summary ───────────────────────────────────────────────────────────────────
SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'YOUR_IP')"

echo
echo -e "  ${BOLD}══════════════════════════════════════════════${RESET}"
if curl -sf "http://localhost:9000/api/health" >/dev/null 2>&1; then
  echo -e "  ${GREEN}${BOLD}[✓] RadFast Admin Panel berhasil diinstall!${RESET}"
else
  echo -e "  ${YELLOW}[!] Panel mungkin belum siap — cek: pm2 logs radfast-admin${RESET}"
fi
echo
echo -e "  ${BOLD}URL Dashboard${RESET}: http://${SERVER_IP}:9000"
echo -e "  ${BOLD}Login${RESET}        : admin / (password yang ditampilkan tadi)"
echo
echo -e "  ${BOLD}Perintah berguna:${RESET}"
echo -e "    pm2 logs radfast-admin    — lihat log"
echo -e "    pm2 restart radfast-admin — restart"
echo -e "    bash reset-password.sh    — reset password"
echo
echo -e "  ${YELLOW}[!] Setelah login, install GenieACS dari menu Instances${RESET}"
echo -e "  ${BOLD}══════════════════════════════════════════════${RESET}"
echo
