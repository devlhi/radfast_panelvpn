#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
#  RadFast ACS — Admin Panel Installer
#
#  Jalankan LANGSUNG (tanpa clone manual):
#    curl -fsSL https://raw.githubusercontent.com/devlhi/radfast_panelvpn/main/install.sh | sudo bash
#
#  Atau download dulu lalu jalankan:
#    wget -qO install.sh https://raw.githubusercontent.com/devlhi/radfast_panelvpn/main/install.sh
#    sudo bash install.sh
#
#  Yang dilakukan secara otomatis:
#    1. Install Node.js 20 LTS (jika belum ada)
#    2. Install pnpm + pm2
#    3. Download source code dari GitHub → /opt/radfast-admin
#    4. Setup .env + auto-generate JWT_SECRET + bcrypt password admin
#    5. Install dependencies backend & build frontend (Vue → dist)
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
step() { echo -e "\n${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"; \
         echo -e "${BOLD}${CYAN}  $*${RESET}"; \
         echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"; }

# ─── Konfigurasi ──────────────────────────────────────────────────────────────
REPO_URL="https://github.com/devlhi/radfast_panelvpn.git"
TARBALL_URL="https://github.com/devlhi/radfast_panelvpn/archive/refs/heads/main.tar.gz"
INSTALL_DIR="/opt/radfast-admin"
BACKEND="${INSTALL_DIR}/backend"
FRONTEND="${INSTALL_DIR}/frontend"
LOG_DIR="${BACKEND}/data/logs"

# ─── Banner ───────────────────────────────────────────────────────────────────
echo
echo -e "${BOLD}${CYAN}  ██████╗  █████╗ ██████╗ ███████╗ █████╗ ███████╗████████╗${RESET}"
echo -e "${BOLD}${CYAN}  ██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔══██╗██╔════╝╚══██╔══╝${RESET}"
echo -e "${BOLD}${CYAN}  ██████╔╝███████║██║  ██║█████╗  ███████║███████╗   ██║   ${RESET}"
echo -e "${BOLD}${CYAN}  ██╔══██╗██╔══██║██║  ██║██╔══╝  ██╔══██║╚════██║   ██║   ${RESET}"
echo -e "${BOLD}${CYAN}  ██║  ██║██║  ██║██████╔╝██║     ██║  ██║███████║   ██║   ${RESET}"
echo -e "${BOLD}${CYAN}  ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ ╚═╝     ╚═╝  ╚═╝╚══════╝   ╚═╝  ${RESET}"
echo
echo -e "${BOLD}  RadFast ACS — Admin Panel Installer v1.0${RESET}"
echo -e "  Install dir : ${CYAN}${INSTALL_DIR}${RESET}"
echo -e "  Repository  : ${CYAN}${REPO_URL}${RESET}"
echo

# ─── Harus root ───────────────────────────────────────────────────────────────
[[ "${EUID}" -ne 0 ]] && die "Jalankan dengan sudo: sudo bash install.sh"

# ══════════════════════════════════════════════════════════════════════════════
step "1/7  Cek & install Node.js 20 LTS"
# ══════════════════════════════════════════════════════════════════════════════

NODE_MAJOR=0
command -v node >/dev/null 2>&1 \
  && NODE_MAJOR="$(node -e 'process.stdout.write(process.versions.node.split(".")[0])')" 2>/dev/null || true

if (( NODE_MAJOR >= 18 )); then
  ok "Node.js $(node -v) sudah terinstall"
else
  info "Install Node.js 20 LTS via NodeSource..."
  if command -v apt-get >/dev/null 2>&1; then
    apt-get install -y -qq curl 2>&1 | tail -2
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>&1 | tail -3
    apt-get install -y -qq nodejs 2>&1 | tail -3
  elif command -v yum >/dev/null 2>&1; then
    yum install -y -q curl 2>&1 | tail -2
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - 2>&1 | tail -3
    yum install -y -q nodejs 2>&1 | tail -3
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y -q curl 2>&1 | tail -2
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - 2>&1 | tail -3
    dnf install -y -q nodejs 2>&1 | tail -3
  else
    die "Package manager tidak dikenali (bukan apt/yum/dnf). Install Node.js 18+ manual."
  fi
  ok "Node.js $(node -v) terinstall"
fi

# ══════════════════════════════════════════════════════════════════════════════
step "2/7  Install pnpm & pm2"
# ══════════════════════════════════════════════════════════════════════════════

if ! command -v pnpm >/dev/null 2>&1; then
  info "Install pnpm..."
  npm install -g pnpm --silent 2>&1 | tail -2
fi
ok "pnpm $(pnpm -v)"

if ! command -v pm2 >/dev/null 2>&1; then
  info "Install pm2..."
  npm install -g pm2 --silent 2>&1 | tail -2
fi
ok "pm2 $(pm2 -v)"

# ══════════════════════════════════════════════════════════════════════════════
step "3/7  Download source code RadFast"
# ══════════════════════════════════════════════════════════════════════════════

# Backup .env jika sudah ada install sebelumnya
if [[ -f "${BACKEND}/.env" ]]; then
  cp "${BACKEND}/.env" "/tmp/radfast-env-backup-$(date +%s)"
  ok ".env lama dibackup ke /tmp/radfast-env-backup-*"
fi

# Download source code
if command -v git >/dev/null 2>&1; then
  info "Download via git clone..."
  if [[ -d "${INSTALL_DIR}/.git" ]]; then
    git -C "${INSTALL_DIR}" pull --rebase --autostash 2>&1 | tail -3
    ok "Source code diperbarui (git pull)"
  else
    rm -rf "${INSTALL_DIR}"
    git clone --depth=1 "${REPO_URL}" "${INSTALL_DIR}" 2>&1 | tail -3
    ok "Source code berhasil didownload (git clone)"
  fi
else
  info "git tidak ditemukan — download via tarball..."
  command -v curl >/dev/null 2>&1 || apt-get install -y -qq curl 2>/dev/null || die "curl/git tidak tersedia."
  TMP_TAR="/tmp/radfast-main.tar.gz"
  curl -fsSL "${TARBALL_URL}" -o "${TMP_TAR}" || die "Gagal download tarball dari GitHub."
  rm -rf "${INSTALL_DIR}"
  mkdir -p "${INSTALL_DIR}"
  tar -xzf "${TMP_TAR}" --strip-components=1 -C "${INSTALL_DIR}"
  rm -f "${TMP_TAR}"
  ok "Source code berhasil didownload (tarball)"
fi

# Restore .env backup jika ada
LATEST_BACKUP="$(ls -t /tmp/radfast-env-backup-* 2>/dev/null | head -1 || true)"
if [[ -n "${LATEST_BACKUP}" && -f "${LATEST_BACKUP}" ]]; then
  cp "${LATEST_BACKUP}" "${BACKEND}/.env"
  ok ".env lama dipulihkan"
fi

# ══════════════════════════════════════════════════════════════════════════════
step "4/7  Setup .env & generate credentials"
# ══════════════════════════════════════════════════════════════════════════════

mkdir -p "${LOG_DIR}"
chmod 750 "${BACKEND}/data" "${LOG_DIR}"

# Buat .env dari .env.example jika belum ada
ENV_IS_NEW=0
if [[ ! -f "${BACKEND}/.env" ]]; then
  [[ -f "${BACKEND}/.env.example" ]] \
    || die ".env.example tidak ditemukan di repo. Cek koneksi internet / repo."
  cp "${BACKEND}/.env.example" "${BACKEND}/.env"
  ENV_IS_NEW=1
  ok ".env dibuat dari .env.example (fresh install)"
else
  ok ".env sudah ada — dipertahankan"
fi

# Auto-generate JWT_SECRET — selalu generate ulang jika masih sama dengan contoh
# (ambil nilai dari .env.example sebagai referensi "default")
EXAMPLE_JWT="$(grep '^JWT_SECRET=' "${BACKEND}/.env.example" 2>/dev/null | cut -d= -f2- || echo '')"
CURRENT_JWT="$(grep '^JWT_SECRET=' "${BACKEND}/.env" 2>/dev/null | cut -d= -f2- || echo '')"
if [[ -z "${CURRENT_JWT}" || "${CURRENT_JWT}" == "${EXAMPLE_JWT}" ]]; then
  NEW_SECRET="$(node -e "process.stdout.write(require('crypto').randomBytes(48).toString('hex'))")"
  sed -i "s|^JWT_SECRET=.*|JWT_SECRET=${NEW_SECRET}|" "${BACKEND}/.env"
  ok "JWT_SECRET di-generate otomatis (96 hex chars)"
else
  ok "JWT_SECRET sudah dikustomisasi — dipertahankan"
fi

# Auto-set ALLOWED_ORIGINS — selalu include IP server + localhost
SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}' || echo '')"
if [[ -n "${SERVER_IP}" ]]; then
  NEW_ORIGINS="http://localhost:5173,http://localhost:9000,http://${SERVER_IP}:9000"
  sed -i "s|^ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=${NEW_ORIGINS}|" "${BACKEND}/.env"
  ok "ALLOWED_ORIGINS di-set: ${NEW_ORIGINS}"
fi

# ── Install backend deps (diperlukan untuk generate hash) ─────────────────────
cd "${BACKEND}"
info "Install backend dependencies..."
npm install --omit=dev 2>&1 | tail -5
ok "Backend dependencies terinstall"

# ── Generate bcrypt password admin ────────────────────────────────────────────
# Generate jika: install baru, hash kosong, atau hash masih sama dengan .env.example
EXAMPLE_HASH="$(grep '^ADMIN_PASSWORD_HASH=' "${BACKEND}/.env.example" 2>/dev/null | cut -d= -f2- || echo '')"
CURRENT_HASH="$(grep '^ADMIN_PASSWORD_HASH=' "${BACKEND}/.env" 2>/dev/null | cut -d= -f2- || echo '')"

NEED_HASH=0
[[ "${ENV_IS_NEW}" -eq 1 ]] && NEED_HASH=1
[[ -z "${CURRENT_HASH}" ]] && NEED_HASH=1
[[ -n "${EXAMPLE_HASH}" && "${CURRENT_HASH}" == "${EXAMPLE_HASH}" ]] && NEED_HASH=1

if [[ "${NEED_HASH}" -eq 1 ]]; then
  echo
  echo -e "  ${YELLOW}╔══════════════════════════════════════════════╗${RESET}"
  echo -e "  ${YELLOW}║       PASSWORD ADMIN (simpan sekarang!)      ║${RESET}"
  echo -e "  ${YELLOW}╠══════════════════════════════════════════════╣${RESET}"
  set +e
  node scripts/set-admin-password.js --gen
  EXIT_CODE=$?
  set -e
  echo -e "  ${YELLOW}╚══════════════════════════════════════════════╝${RESET}"
  [[ "${EXIT_CODE}" -ne 0 ]] && die "Gagal generate password. Cek: node scripts/set-admin-password.js --gen"
  warn "Catat password di atas — tidak bisa ditampilkan ulang!"
else
  ok "Password admin sudah dikustomisasi — dipertahankan"
fi

# ══════════════════════════════════════════════════════════════════════════════
step "5/7  Install dependencies & build frontend"
# ══════════════════════════════════════════════════════════════════════════════

cd "${FRONTEND}"

# Hapus node_modules lama jika ada (fresh install di server baru)
if [[ -d "node_modules" ]]; then
  info "Bersihkan node_modules lama..."
  rm -rf node_modules package-lock.json pnpm-lock.yaml 2>/dev/null || true
fi

info "Install frontend dependencies..."
npm install 2>&1 | tail -5
ok "Frontend dependencies terinstall"

chmod +x node_modules/.bin/* 2>/dev/null || true

info "Build frontend (Vue → dist)..."
npm run build 2>&1 | tail -5 \
  || node node_modules/vite/bin/vite.js build 2>&1 | tail -5 \
  || die "Frontend build gagal. Jalankan: cd ${FRONTEND} && npm run build"
ok "Frontend berhasil di-build"

# ══════════════════════════════════════════════════════════════════════════════
step "6/7  Start dengan pm2"
# ══════════════════════════════════════════════════════════════════════════════

cd "${INSTALL_DIR}"

# Stop & delete proses lama jika ada
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
step "7/7  Setup auto-start saat reboot"
# ══════════════════════════════════════════════════════════════════════════════

pm2 startup systemd -u root --hp /root 2>/dev/null \
  || pm2 startup 2>/dev/null \
  || warn "pm2 startup gagal — jalankan manual: pm2 startup"
pm2 save
ok "pm2 startup dikonfigurasi (survive reboot)"

# ── Health check ──────────────────────────────────────────────────────────────
info "Menunggu backend siap (maks 20 detik)..."
for i in $(seq 1 20); do
  if curl -sf "http://localhost:9000/api/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# ══════════════════════════════════════════════════════════════════════════════
#  SUMMARY
# ══════════════════════════════════════════════════════════════════════════════
echo
echo -e "  ${BOLD}╔══════════════════════════════════════════════════╗${RESET}"
if curl -sf "http://localhost:9000/api/health" >/dev/null 2>&1; then
  echo -e "  ${BOLD}${GREEN}║   ✓  RadFast Admin Panel berhasil diinstall!    ║${RESET}"
else
  echo -e "  ${BOLD}${YELLOW}║   !  Panel mungkin belum siap — cek log pm2     ║${RESET}"
fi
echo -e "  ${BOLD}╠══════════════════════════════════════════════════╣${RESET}"
echo -e "  ${BOLD}║                                                  ║${RESET}"
echo -e "  ${BOLD}║  URL     : http://${SERVER_IP:-YOUR_IP}:9000$(printf '%*s' $((28 - ${#SERVER_IP:-YOUR_IP})) '')║${RESET}"
echo -e "  ${BOLD}║  Login   : admin / (password ditampilkan tadi)   ║${RESET}"
echo -e "  ${BOLD}║  Dir     : ${INSTALL_DIR}$(printf '%*s' $((38 - ${#INSTALL_DIR})) '')║${RESET}"
echo -e "  ${BOLD}║                                                  ║${RESET}"
echo -e "  ${BOLD}╠══════════════════════════════════════════════════╣${RESET}"
echo -e "  ${BOLD}║  Perintah berguna:                               ║${RESET}"
echo -e "  ${BOLD}║  pm2 logs radfast-admin   — lihat log            ║${RESET}"
echo -e "  ${BOLD}║  pm2 restart radfast-admin — restart             ║${RESET}"
echo -e "  ${BOLD}║  pm2 status               — cek status           ║${RESET}"
echo -e "  ${BOLD}║                                                  ║${RESET}"
echo -e "  ${BOLD}╠══════════════════════════════════════════════════╣${RESET}"
echo -e "  ${BOLD}${YELLOW}║  ⚠ Setelah login, install GenieACS dari menu    ║${RESET}"
echo -e "  ${BOLD}${YELLOW}║    Instances di dashboard.                       ║${RESET}"
echo -e "  ${BOLD}╚══════════════════════════════════════════════════╝${RESET}"
echo
