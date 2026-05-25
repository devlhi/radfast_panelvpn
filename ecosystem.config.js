// ─── pm2 Ecosystem Config — RadFast Admin ────────────────────────────────────
// Usage:  pm2 start ecosystem.config.js
//         pm2 reload ecosystem.config.js
//         pm2 logs radfast-admin
// ─────────────────────────────────────────────────────────────────────────────
const path = require('path')
const ROOT = __dirname

module.exports = {
  apps: [
    {
      name: 'radfast-admin',
      script: path.join(ROOT, 'backend', 'server.js'),
      cwd: path.join(ROOT, 'backend'),

      // ── Runtime ──────────────────────────────────────────────────────────
      node_args: '--max-old-space-size=256',
      instances: 1,           // single instance (stateful token store in-memory)
      exec_mode: 'fork',

      // ── Restart policy ───────────────────────────────────────────────────
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      restart_delay: 2000,
      max_restarts: 10,
      min_uptime: '10s',

      // ── Env ──────────────────────────────────────────────────────────────
      env_production: {
        NODE_ENV: 'production',
      },

      // ── Log ──────────────────────────────────────────────────────────────
      out_file: path.join(ROOT, 'backend', 'data', 'logs', 'pm2-out.log'),
      error_file: path.join(ROOT, 'backend', 'data', 'logs', 'pm2-err.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // ── Health ───────────────────────────────────────────────────────────
      // pm2 will GET this URL; non-200 triggers restart
      // Requires: pm2 install @pm2/io  (optional, comment out if not used)
      // health_check_url: 'http://localhost:9000/api/health',
    },
  ],
}
