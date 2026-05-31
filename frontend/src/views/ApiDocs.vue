<template>
  <div class="api-docs-page">
    <!-- Header -->
    <section class="header-card rf-card">
      <div>
        <p class="eyebrow">Dokumentasi</p>
        <h2>Dokumentasi API Provisioning VPN</h2>
        <p class="muted">
          Referensi endpoint server-to-server untuk provisioning VPN (L2TP &amp; WireGuard)
          dan status VPN yang dipakai dashboard GenieACS. Semua endpoint di bawah memakai
          autentikasi <code>X-API-Key</code>.
        </p>
      </div>
      <span class="ver-pill">v1</span>
    </section>

    <!-- Layout: TOC + content -->
    <div class="docs-layout">
      <!-- Sidebar TOC -->
      <aside class="docs-toc rf-card">
        <div class="toc-title">Daftar Isi</div>
        <a v-for="s in sections" :key="s.id" :href="'#' + s.id" class="toc-link">
          <span class="toc-method" :class="'m-' + s.method.toLowerCase()" v-if="s.method">{{ s.method }}</span>
          <span class="toc-text">{{ s.label }}</span>
        </a>
      </aside>

      <!-- Content -->
      <div class="docs-content">

        <!-- Overview -->
        <section id="overview" class="rf-card doc-block">
          <h3>Ringkasan</h3>
          <p class="muted">
            API ini dipakai sistem billing/portal untuk membuat instance GenieACS dan akun VPN
            otomatis saat order, dan oleh proxy dashboard GenieACS untuk melihat status tunnel
            serta mengatur static route. Base URL mengikuti host server ini.
          </p>
          <table class="kv">
            <tbody>
              <tr><td>Base URL</td><td><code>{{ baseUrl }}</code></td></tr>
              <tr><td>Prefix</td><td><code>/api/provision</code></td></tr>
              <tr><td>Autentikasi</td><td>Header <code>X-API-Key: &lt;PROVISIONING_API_KEY&gt;</code></td></tr>
              <tr><td>Content-Type</td><td><code>application/json</code></td></tr>
              <tr><td>Rate limit</td><td>Dibatasi per IP (provisionLimiter)</td></tr>
            </tbody>
          </table>
        </section>

        <!-- Auth -->
        <section id="auth" class="rf-card doc-block">
          <h3>Autentikasi &amp; Whitelist IP</h3>
          <p class="muted">
            Setiap request wajib menyertakan header <code>X-API-Key</code> yang cocok dengan
            <code>PROVISIONING_API_KEY</code> di server. Key dibandingkan secara aman
            (timing-safe). Endpoint provisioning tidak memakai session/JWT/CSRF.
          </p>
          <ul class="doc-list">
            <li>Jika whitelist IP aktif, hanya IP/CIDR terdaftar yang boleh mengakses <code>/api/provision/*</code>.</li>
            <li>Whitelist kosong = nonaktif (semua IP diizinkan), key tetap wajib valid.</li>
            <li>Atur whitelist di menu <strong>VPN dari API</strong>.</li>
          </ul>
          <div class="code-head">Contoh header</div>
          <pre class="code"><code>X-API-Key: ringkas-rahasia-anda
Content-Type: application/json</code></pre>
          <div class="resp-grid">
            <div><span class="badge b-401">401</span> Key tidak ada / tidak valid</div>
            <div><span class="badge b-403">403</span> IP tidak ada di whitelist</div>
            <div><span class="badge b-429">429</span> Melebihi rate limit</div>
          </div>
        </section>

        <!-- POST /instance -->
        <section id="inst-create" class="rf-card doc-block">
          <div class="ep-head">
            <span class="method m-post">POST</span>
            <code class="ep-path">/api/provision/instance</code>
          </div>
          <p class="muted">
            Membuat instance GenieACS baru (dipakai sistem billing saat order).
            Di Linux production, port &amp; database dikelola otomatis oleh
            <code>add-instance.sh</code> — jangan kirim <code>ui_port</code>/<code>cwmp_port</code>/<code>db</code>.
          </p>

          <div class="code-head">Body parameter</div>
          <table class="param">
            <thead><tr><th>Nama</th><th>Tipe</th><th>Wajib</th><th>Keterangan</th></tr></thead>
            <tbody>
              <tr><td><code>name</code></td><td>string</td><td>Ya</td><td>Pola <code>[a-z][a-z0-9_-]{1,62}</code></td></tr>
              <tr><td><code>ui_port</code></td><td>int</td><td>Opsional*</td><td>1024–65535. *Windows dev saja</td></tr>
              <tr><td><code>cwmp_port</code></td><td>int</td><td>Opsional*</td><td>1024–65535. *Windows dev saja</td></tr>
              <tr><td><code>db</code></td><td>string</td><td>Opsional*</td><td>Pola <code>[a-zA-Z0-9_]{1,64}</code>. *Windows dev saja</td></tr>
            </tbody>
          </table>

          <div class="code-head">Contoh request</div>
          <pre class="code"><code>POST /api/provision/instance
X-API-Key: ringkas-rahasia-anda
Content-Type: application/json

{
  "name": "client01"
}</code></pre>

          <div class="code-head">Contoh response <span class="badge b-201">201</span></div>
          <pre class="code"><code>{
  "message": "Instance berhasil dibuat.",
  "instance": {
    "name": "client01",
    "ui_port": 3001,
    "cwmp_port": 7547,
    "nbi_port": 7557,
    "fs_port": 7567,
    "db": "genieacs_client01",
    "ip": "10.0.0.5",
    "created": "2026-05-31",
    "active": true,
    "services": {
      "ui": "genieacs-client01-ui",
      "cwmp": "genieacs-client01-cwmp",
      "nbi": "genieacs-client01-nbi",
      "fs": "genieacs-client01-fs"
    },
    "ui_internal": 13001,
    "nbi_gate_path": "/nbi-xxxxxx",
    "urls": {
      "ui": "http://10.0.0.5:3001",
      "cwmp": "http://10.0.0.5:7547",
      "nbi": "http://10.0.0.5:3001/nbi-xxxxxx"
    }
  }
}</code></pre>

          <div class="resp-grid">
            <div><span class="badge b-400">400</span> Validasi gagal / kirim port-db saat Linux</div>
            <div><span class="badge b-409">409</span> Instance sudah ada</div>
            <div><span class="badge b-500">500</span> Script provisioning gagal</div>
          </div>
        </section>

        <!-- GET /instances -->
        <section id="inst-list" class="rf-card doc-block">
          <div class="ep-head">
            <span class="method m-get">GET</span>
            <code class="ep-path">/api/provision/instances</code>
          </div>
          <p class="muted">Daftar semua instance GenieACS yang terdaftar.</p>

          <div class="code-head">Contoh response <span class="badge b-200">200</span></div>
          <pre class="code"><code>{
  "count": 1,
  "instances": [
    {
      "name": "client01",
      "ui_port": 3001,
      "cwmp_port": 7547,
      "nbi_port": 7557,
      "fs_port": 7567,
      "db": "genieacs_client01",
      "ip": "10.0.0.5",
      "created": "2026-05-31",
      "active": true,
      "services": { "ui": "genieacs-client01-ui", "cwmp": "genieacs-client01-cwmp", "nbi": "genieacs-client01-nbi", "fs": "genieacs-client01-fs" }
    }
  ]
}</code></pre>
        </section>

        <!-- GET /instance/:name -->
        <section id="inst-detail" class="rf-card doc-block">
          <div class="ep-head">
            <span class="method m-get">GET</span>
            <code class="ep-path">/api/provision/instance/:name</code>
          </div>
          <p class="muted">Detail satu instance termasuk <code>ui_internal</code> &amp; <code>nbi_gate_path</code>.</p>

          <div class="code-head">Contoh request</div>
          <pre class="code"><code>GET /api/provision/instance/client01
X-API-Key: ringkas-rahasia-anda</code></pre>

          <div class="resp-grid">
            <div><span class="badge b-200">200</span> Detail instance (format sama seperti item list + ui_internal/nbi_gate_path)</div>
            <div><span class="badge b-404">404</span> Instance tidak ditemukan</div>
          </div>
        </section>

        <!-- DELETE /instance/:name -->
        <section id="inst-delete" class="rf-card doc-block">
          <div class="ep-head">
            <span class="method m-del">DELETE</span>
            <code class="ep-path">/api/provision/instance/:name</code>
          </div>
          <p class="muted">
            Menghapus instance GenieACS. Di Linux menjalankan <code>remove-instance.sh</code>
            (hentikan service, hapus data). Aksi destruktif — pastikan instance benar.
          </p>

          <div class="code-head">Contoh response <span class="badge b-200">200</span></div>
          <pre class="code"><code>{ "message": "Instance \"client01\" dihapus." }</code></pre>

          <div class="resp-grid">
            <div><span class="badge b-404">404</span> Instance tidak ditemukan</div>
            <div><span class="badge b-500">500</span> Script remove gagal</div>
          </div>
        </section>

        <!-- POST /instance/:name/start|stop -->
        <section id="inst-action" class="rf-card doc-block">
          <div class="ep-head">
            <span class="method m-post">POST</span>
            <code class="ep-path">/api/provision/instance/:name/start</code>
          </div>
          <div class="ep-head" style="margin-top:6px">
            <span class="method m-post">POST</span>
            <code class="ep-path">/api/provision/instance/:name/stop</code>
          </div>
          <p class="muted">
            Start/stop service instance (<code>cwmp</code>, <code>nbi</code>, <code>fs</code>, <code>ui</code>) via systemctl.
            Saat start, <code>genieacs-multi-proxy</code> ikut di-restart.
          </p>

          <div class="code-head">Contoh response <span class="badge b-200">200</span></div>
          <pre class="code"><code>{ "message": "Instance start berhasil." }</code></pre>

          <div class="resp-grid">
            <div><span class="badge b-207">207</span> Sebagian service gagal (lihat array <code>failed</code>)</div>
            <div><span class="badge b-404">404</span> Instance tidak ditemukan</div>
          </div>
        </section>

        <!-- GET /vpn-status -->
        <section id="vpn-status" class="rf-card doc-block">
          <div class="ep-head">
            <span class="method m-get">GET</span>
            <code class="ep-path">/api/provision/vpn-status</code>
          </div>
          <p class="muted">
            Mengembalikan status tunnel (up/down) dan reachability klien untuk akun L2TP &amp;
            WireGuard. Dipakai dashboard GenieACS untuk menampilkan status VPN instance.
          </p>

          <div class="code-head">Query parameter</div>
          <table class="param">
            <thead><tr><th>Nama</th><th>Tipe</th><th>Wajib</th><th>Keterangan</th></tr></thead>
            <tbody>
              <tr>
                <td><code>instance</code></td><td>string</td><td>Opsional</td>
                <td>Filter per-instance. Pola <code>[a-zA-Z0-9_-]{1,64}</code>. Kosong = semua akun.</td>
              </tr>
            </tbody>
          </table>

          <div class="code-head">Contoh request</div>
          <pre class="code"><code>GET /api/provision/vpn-status?instance=client01
X-API-Key: ringkas-rahasia-anda</code></pre>

          <div class="code-head">Contoh response <span class="badge b-200">200</span></div>
          <pre class="code"><code>{
  "instance": "client01",
  "l2tp": [
    {
      "username": "client01-ont1",
      "instance": "client01",
      "ros_version": "7",
      "lan_subnet": "192.168.100.0/24",
      "ont_ip": "192.168.100.1",
      "vpn_ip": "10.20.0.5",
      "tunnel": "up",
      "ont_reachable": true,
      "ont_rtt_ms": 12
    }
  ],
  "wireguard": [
    {
      "name": "client01wg",
      "instance": "client01",
      "ros_version": "7",
      "peer_ip": "10.30.0.4",
      "lan_subnet": null,
      "ont_ip": null,
      "tunnel": "down",
      "last_handshake": null,
      "ont_reachable": false,
      "ont_rtt_ms": null
    }
  ]
}</code></pre>

          <div class="resp-grid">
            <div><span class="badge b-400">400</span> Parameter <code>instance</code> tidak valid</div>
            <div><span class="badge b-503">503</span> Status VPN belum tersedia</div>
          </div>
        </section>

        <!-- POST /vpn/l2tp -->
        <section id="vpn-l2tp" class="rf-card doc-block">
          <div class="ep-head">
            <span class="method m-post">POST</span>
            <code class="ep-path">/api/provision/vpn/l2tp</code>
          </div>
          <p class="muted">Membuat akun L2TP baru (dipakai provisioning otomatis saat order).</p>

          <div class="code-head">Body parameter</div>
          <table class="param">
            <thead><tr><th>Nama</th><th>Tipe</th><th>Wajib</th><th>Keterangan</th></tr></thead>
            <tbody>
              <tr><td><code>username</code></td><td>string</td><td>Ya</td><td>Pola <code>[a-zA-Z0-9_.-]{1,64}</code></td></tr>
              <tr><td><code>password</code></td><td>string</td><td>Ya</td><td>8–128 karakter, ASCII printable tanpa spasi</td></tr>
              <tr><td><code>instance</code></td><td>string</td><td>Opsional</td><td>Pola <code>[a-zA-Z0-9_-]*</code>, maks 64</td></tr>
              <tr><td><code>note</code></td><td>string</td><td>Opsional</td><td>Maks 200 karakter</td></tr>
              <tr><td><code>ros_version</code></td><td>string</td><td>Opsional</td><td><code>"6"</code> atau <code>"7"</code> (default 7)</td></tr>
              <tr><td><code>lan_subnet</code></td><td>string</td><td>Opsional</td><td>CIDR static route, mis. <code>192.168.100.0/24</code></td></tr>
              <tr><td><code>ont_ip</code></td><td>string</td><td>Opsional</td><td>IP klien (IPv4) untuk monitoring reachability</td></tr>
            </tbody>
          </table>

          <div class="code-head">Contoh request</div>
          <pre class="code"><code>POST /api/provision/vpn/l2tp
X-API-Key: ringkas-rahasia-anda
Content-Type: application/json

{
  "username": "client01-ont1",
  "password": "Rahasia#2026",
  "instance": "client01",
  "ros_version": "7",
  "lan_subnet": "192.168.100.0/24",
  "ont_ip": "192.168.100.1"
}</code></pre>

          <div class="code-head">Contoh response <span class="badge b-201">201</span></div>
          <pre class="code"><code>{
  "message": "User client01-ont1 ditambahkan.",
  "vpn_ip": "10.20.0.5",
  "ros_version": "7",
  "lan_subnet": "192.168.100.0/24",
  "source": "api"
}</code></pre>

          <div class="resp-grid">
            <div><span class="badge b-400">400</span> Validasi body / CIDR / IP gagal</div>
            <div><span class="badge b-409">409</span> Username sudah ada / pool penuh</div>
            <div><span class="badge b-503">503</span> Provisioning belum tersedia</div>
          </div>
        </section>

        <!-- POST /vpn/wireguard -->
        <section id="vpn-wireguard" class="rf-card doc-block">
          <div class="ep-head">
            <span class="method m-post">POST</span>
            <code class="ep-path">/api/provision/vpn/wireguard</code>
          </div>
          <p class="muted">
            Membuat peer WireGuard baru. Hanya didukung RouterOS 7
            (untuk ROS6 gunakan L2TP).
          </p>

          <div class="code-head">Body parameter</div>
          <table class="param">
            <thead><tr><th>Nama</th><th>Tipe</th><th>Wajib</th><th>Keterangan</th></tr></thead>
            <tbody>
              <tr><td><code>name</code></td><td>string</td><td>Ya</td><td>Pola <code>[a-z][a-z0-9-]{0,40}</code></td></tr>
              <tr><td><code>instance</code></td><td>string</td><td>Opsional</td><td>Pola <code>[a-zA-Z0-9_-]*</code>, maks 64</td></tr>
              <tr><td><code>note</code></td><td>string</td><td>Opsional</td><td>Maks 200 karakter</td></tr>
              <tr><td><code>lan_subnet</code></td><td>string</td><td>Opsional</td><td>CIDR static route klien</td></tr>
              <tr><td><code>ont_ip</code></td><td>string</td><td>Opsional</td><td>IP klien (IPv4) untuk monitoring</td></tr>
            </tbody>
          </table>

          <div class="code-head">Contoh request</div>
          <pre class="code"><code>POST /api/provision/vpn/wireguard
X-API-Key: ringkas-rahasia-anda
Content-Type: application/json

{
  "name": "client01wg",
  "instance": "client01",
  "lan_subnet": "192.168.50.0/24",
  "ont_ip": "192.168.50.1"
}</code></pre>

          <div class="code-head">Contoh response <span class="badge b-201">201</span></div>
          <pre class="code"><code>{
  "message": "Peer client01wg ditambahkan.",
  "peer": {
    "name": "client01wg",
    "instance": "client01",
    "peer_ip": "10.30.0.4",
    "pubkey": "xxxxxxxxxxxxxxxxxxxxxxxxxxxx=",
    "ros_version": "7",
    "lan_subnet": "192.168.50.0/24",
    "ont_ip": "192.168.50.1"
  }
}</code></pre>
          <p class="note-inline">Private key peer tidak pernah dikembalikan oleh endpoint ini.</p>

          <div class="resp-grid">
            <div><span class="badge b-400">400</span> Validasi gagal / ROS6 tidak didukung</div>
            <div><span class="badge b-409">409</span> Nama sudah dipakai / pool penuh</div>
            <div><span class="badge b-503">503</span> Provisioning belum tersedia</div>
          </div>
        </section>

        <!-- POST /vpn/route -->
        <section id="vpn-route" class="rf-card doc-block">
          <div class="ep-head">
            <span class="method m-post">POST</span>
            <code class="ep-path">/api/provision/vpn/route</code>
          </div>
          <p class="muted">
            Memperbarui static route (subnet LAN + IP klien) untuk akun VPN yang sudah ada.
            Dipakai dashboard GenieACS agar tenant hanya bisa mengatur route, bukan membuat
            atau menghapus akun. Kosongkan <code>lan_subnet</code> untuk menghapus route.
          </p>

          <div class="code-head">Body parameter</div>
          <table class="param">
            <thead><tr><th>Nama</th><th>Tipe</th><th>Wajib</th><th>Keterangan</th></tr></thead>
            <tbody>
              <tr><td><code>type</code></td><td>string</td><td>Ya</td><td><code>"l2tp"</code> atau <code>"wireguard"</code></td></tr>
              <tr><td><code>name</code></td><td>string</td><td>Ya</td><td>Username L2TP atau nama peer WireGuard (1–64)</td></tr>
              <tr><td><code>instance</code></td><td>string</td><td>Opsional</td><td>Bila diisi, akun wajib milik instance tsb (kalau tidak → 404)</td></tr>
              <tr><td><code>lan_subnet</code></td><td>string</td><td>Opsional</td><td>CIDR baru. Kosong = hapus route</td></tr>
              <tr><td><code>ont_ip</code></td><td>string</td><td>Opsional</td><td>IP klien (IPv4) target route</td></tr>
            </tbody>
          </table>

          <div class="code-head">Contoh request</div>
          <pre class="code"><code>POST /api/provision/vpn/route
X-API-Key: ringkas-rahasia-anda
Content-Type: application/json

{
  "type": "l2tp",
  "name": "client01-ont1",
  "instance": "client01",
  "lan_subnet": "192.168.100.0/24",
  "ont_ip": "192.168.100.1"
}</code></pre>

          <div class="code-head">Contoh response <span class="badge b-200">200</span></div>
          <pre class="code"><code>{
  "message": "Static route diperbarui.",
  "username": "client01-ont1",
  "lan_subnet": "192.168.100.0/24",
  "ont_ip": "192.168.100.1",
  "vpn_ip": "10.20.0.5"
}</code></pre>
          <p class="note-inline">Untuk WireGuard, response memakai field <code>name</code> (bukan <code>username</code>) dan tanpa <code>vpn_ip</code>.</p>

          <div class="resp-grid">
            <div><span class="badge b-400">400</span> Validasi / CIDR / IP gagal</div>
            <div><span class="badge b-404">404</span> Akun tidak ditemukan / beda instance</div>
            <div><span class="badge b-409">409</span> Pool IP penuh saat assign IP statis</div>
            <div><span class="badge b-503">503</span> Update route belum tersedia</div>
          </div>
        </section>

        <!-- Audit -->
        <section id="audit" class="rf-card doc-block">
          <h3>Audit Log</h3>
          <p class="muted">Setiap aksi provisioning tercatat di audit log server dengan tipe:</p>
          <table class="param">
            <thead><tr><th>Tipe</th><th>Aksi</th></tr></thead>
            <tbody>
              <tr><td><code>provision.instance.create</code></td><td>Buat instance GenieACS</td></tr>
              <tr><td><code>provision.instance.delete</code></td><td>Hapus instance GenieACS</td></tr>
              <tr><td><code>provision.instance.start</code></td><td>Start service instance</td></tr>
              <tr><td><code>provision.instance.stop</code></td><td>Stop service instance</td></tr>
              <tr><td><code>provision.vpn_status</code></td><td>Lihat status VPN</td></tr>
              <tr><td><code>provision.vpn.l2tp_create</code></td><td>Buat akun L2TP via API</td></tr>
              <tr><td><code>provision.vpn.wg_create</code></td><td>Buat peer WireGuard via API</td></tr>
              <tr><td><code>provision.vpn.route_update</code></td><td>Update static route</td></tr>
            </tbody>
          </table>
          <p class="note-inline">Lihat menu <strong>Security Log</strong> untuk riwayat lengkap.</p>
        </section>

      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const baseUrl = computed(() => window.location.origin)

const sections = [
  { id: 'overview',      label: 'Ringkasan',                method: '' },
  { id: 'auth',          label: 'Autentikasi & Whitelist',  method: '' },
  { id: 'inst-create',   label: '/instance',                method: 'POST' },
  { id: 'inst-list',     label: '/instances',               method: 'GET' },
  { id: 'inst-detail',   label: '/instance/:name',          method: 'GET' },
  { id: 'inst-delete',   label: '/instance/:name',          method: 'DEL' },
  { id: 'inst-action',   label: '/instance/:name/start|stop', method: 'POST' },
  { id: 'vpn-status',    label: '/vpn-status',              method: 'GET' },
  { id: 'vpn-l2tp',      label: '/vpn/l2tp',                method: 'POST' },
  { id: 'vpn-wireguard', label: '/vpn/wireguard',           method: 'POST' },
  { id: 'vpn-route',     label: '/vpn/route',               method: 'POST' },
  { id: 'audit',         label: 'Audit Log',                method: '' },
]
</script>

<style scoped>
.api-docs-page { display: grid; gap: 18px; }

.header-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px; }
.eyebrow { margin: 0 0 6px; color: var(--text-muted); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
.muted { margin: 0; color: var(--text-muted); line-height: 1.6; }
.ver-pill { padding: 4px 12px; border-radius: 999px; background: var(--bg-base); border: 1px solid var(--border); color: var(--text-muted); font-size: 12px; font-weight: 600; }

/* Layout */
.docs-layout { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 18px; align-items: start; }
@media (max-width: 900px) { .docs-layout { grid-template-columns: 1fr; } .docs-toc { position: static !important; } }

/* TOC */
.docs-toc { position: sticky; top: 16px; padding: 14px; display: grid; gap: 4px; }
.toc-title { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--text-muted); margin-bottom: 6px; }
.toc-link { display: flex; align-items: center; gap: 8px; padding: 7px 9px; border-radius: 8px; text-decoration: none; color: var(--text); font-size: 13px; transition: background .15s; }
.toc-link:hover { background: var(--bg-base); }
.toc-method { font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 5px; min-width: 34px; text-align: center; }
.toc-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Content */
.docs-content { display: grid; gap: 16px; }
.doc-block { padding: 20px; display: grid; gap: 12px; }
.doc-block h3 { margin: 0; font-size: 16px; }

/* Endpoint head */
.ep-head { display: flex; align-items: center; gap: 10px; }
.ep-path { font-size: 14px; font-weight: 600; }
.method { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; color: #fff; }
.m-get  { background: #16a085; }
.m-post { background: #2980b9; }
.m-del  { background: #c0392b; }

/* Tables */
.kv, .param { width: 100%; border-collapse: collapse; font-size: 13px; }
.kv td, .param th, .param td { padding: 8px 10px; border: 1px solid var(--border); text-align: left; vertical-align: top; }
.kv td:first-child { width: 160px; color: var(--text-muted); }
.param th { background: var(--bg-base); color: var(--text-muted); font-weight: 600; }

/* Code */
.code-head { font-size: 12px; font-weight: 600; color: var(--text-muted); margin-top: 4px; }
.code { margin: 0; padding: 12px 14px; border-radius: 10px; background: #0f172a; color: #e2e8f0; overflow-x: auto; font-size: 12.5px; line-height: 1.55; }
.code code { background: transparent; padding: 0; color: inherit; }

/* Lists */
.doc-list { margin: 0; padding-left: 18px; color: var(--text-muted); line-height: 1.7; font-size: 13.5px; }
.note-inline { margin: 0; font-size: 12.5px; color: var(--text-muted); font-style: italic; }

/* Response badges */
.resp-grid { display: grid; gap: 6px; }
.resp-grid > div { font-size: 13px; color: var(--text-muted); }
.badge { display: inline-block; min-width: 38px; text-align: center; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 6px; margin-right: 6px; color: #fff; }
.b-200, .b-201 { background: #16a085; }
.b-400, .b-401, .b-403, .b-404, .b-409, .b-429 { background: #c0392b; }
.b-207 { background: #2980b9; }
.b-503, .b-500 { background: #d68910; }

code { background: var(--bg-base); padding: 1px 5px; border-radius: 5px; font-size: 12.5px; }
</style>
