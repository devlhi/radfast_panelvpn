#!/usr/bin/env bash
# ───────────────────────────────────────────────────────────────────────────
# RadFast Admin — Password Reset Tool (Linux / WSL / macOS)
#
# Pakai saat lupa password admin atau saat 2FA hilang/tidak bisa diakses.
# Wrapper aman di sekitar `scripts/set-admin-password.js`.
#
# Contoh:
#   ./reset-password.sh                       # interactive
#   ./reset-password.sh --gen                 # auto-generate 20 char random
#   ./reset-password.sh --gen --reset-2fa     # juga hapus 2FA
#   ./reset-password.sh --password 'XyZ@123!' # non-interactive
#   ./reset-password.sh --username admin2 --gen --reset-2fa
#
# Flags diteruskan apa adanya ke node script. Lihat:
#   ./reset-password.sh --help
# ───────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Resolve script dir & project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
BACKEND_DIR="${SCRIPT_DIR}/backend"

# Allow override
if [[ ! -d "${BACKEND_DIR}" ]] && [[ -f "${SCRIPT_DIR}/server.js" ]]; then
  BACKEND_DIR="${SCRIPT_DIR}"
fi

if [[ ! -d "${BACKEND_DIR}" ]]; then
  echo "❌ Backend tidak ditemukan di ${BACKEND_DIR}" >&2
  exit 1
fi

# Pre-flight checks
command -v node >/dev/null || { echo "❌ node belum terinstall." >&2; exit 1; }
[[ -f "${BACKEND_DIR}/.env" ]] || { echo "❌ ${BACKEND_DIR}/.env tidak ada. Salin dari .env.example dulu." >&2; exit 1; }
[[ -d "${BACKEND_DIR}/node_modules/bcryptjs" ]] || {
  echo "📦 Dependencies belum terinstall. Menjalankan pnpm install..."
  ( cd "${BACKEND_DIR}" && pnpm install )
}

# Run the recovery utility
cd "${BACKEND_DIR}"
set +e
node ./scripts/set-admin-password.js "$@"
RC=$?
set -e

if [[ "${RC}" -ne 0 ]]; then
  echo ""
  echo "❌ Reset GAGAL (exit code ${RC}). Periksa pesan error di atas." >&2
  exit "${RC}"
fi

# ── Auto-restart so backend re-reads .env ─────────────────────────────────
restarted=0

if command -v pm2 >/dev/null && pm2 list 2>/dev/null | grep -q radfast-admin; then
  echo ""
  read -r -p "♻  Restart backend via pm2 sekarang? [Y/n] " ans
  ans="${ans:-Y}"
  if [[ "${ans}" =~ ^[Yy]$ ]]; then
    pm2 restart radfast-admin
    restarted=1
  fi
elif command -v systemctl >/dev/null && systemctl list-unit-files 2>/dev/null | grep -q radfast-admin; then
  echo ""
  read -r -p "♻  Restart backend via systemd sekarang? [Y/n] " ans
  ans="${ans:-Y}"
  if [[ "${ans}" =~ ^[Yy]$ ]]; then
    sudo systemctl restart radfast-admin
    restarted=1
  fi
else
  # Fallback: detect plain `node server.js` running (dev mode)
  if pgrep -f "${BACKEND_DIR}/server.js" >/dev/null 2>&1 || pgrep -f "node .*server\.js" >/dev/null 2>&1; then
    echo ""
    read -r -p "♻  Backend (node server.js) terdeteksi. Stop & start ulang otomatis? [Y/n] " ans
    ans="${ans:-Y}"
    if [[ "${ans}" =~ ^[Yy]$ ]]; then
      pkill -f "${BACKEND_DIR}/server.js" 2>/dev/null || pkill -f "node .*server\.js" 2>/dev/null || true
      sleep 1
      ( cd "${BACKEND_DIR}" && nohup node server.js > "${BACKEND_DIR}/data/logs/server.out" 2>&1 & disown ) || \
        ( cd "${BACKEND_DIR}" && nohup node server.js > /tmp/radfast-server.out 2>&1 & disown )
      sleep 1
      echo "✓ Backend restarted (nohup). Log: ${BACKEND_DIR}/data/logs/server.out"
      restarted=1
    fi
  else
    echo ""
    echo "ℹ  Backend tidak terdeteksi jalan. Start manual:"
    echo "     cd \"${BACKEND_DIR}\" && node server.js"
  fi
fi

if [[ "${restarted}" -eq 0 ]]; then
  echo ""
  echo "⚠  Backend BELUM di-restart. Hash baru di .env tidak akan aktif sampai backend di-restart manual."
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "  SELESAI — silakan login dengan password baru di http://localhost:9000"
echo "═══════════════════════════════════════════════════════════════════════════"
