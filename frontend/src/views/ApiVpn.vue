<template>
  <div class="api-vpn-page">
    <section class="header-card rf-card">
      <div>
        <p class="eyebrow">Provisioning API</p>
        <h2>VPN dari API</h2>
        <p class="muted">Daftar akun L2TP dan peer WireGuard yang dibuat lewat endpoint server-to-server <code>X-API-Key</code>.</p>
      </div>
      <button class="btn-primary" :disabled="loading" @click="fetchAll">
        {{ loading ? 'Memuat…' : 'Refresh' }}
      </button>
    </section>

    <section class="rf-card allow-card">
      <div class="allow-head">
        <div>
          <h3>Whitelist IP Provisioning API</h3>
          <p class="muted">Isi satu IP/CIDR per baris (contoh: <code>192.168.35.253</code> atau <code>10.10.0.0/24</code>). Kosong = nonaktif (semua IP diizinkan).</p>
        </div>
        <button class="btn-secondary" :disabled="savingAllow || loadingAllow" @click="saveAllowlist">
          {{ savingAllow ? 'Menyimpan…' : 'Simpan Whitelist' }}
        </button>
      </div>
      <textarea
        v-model="allowText"
        class="allow-text"
        rows="4"
        placeholder="192.168.35.253&#10;10.10.0.0/24"
      />
      <div class="allow-meta">
        <span>Status: <strong>{{ allowEnabled ? 'Aktif' : 'Nonaktif' }}</strong></span>
        <span>Total: <strong>{{ allowCount }}</strong> entri</span>
        <span v-if="allowUpdatedAt">Update: <strong>{{ formatDate(allowUpdatedAt) }}</strong></span>
      </div>
      <div v-if="allowMsg" class="allow-ok">{{ allowMsg }}</div>
      <div v-if="allowError" class="alert-error" style="margin:10px 0 0">{{ allowError }}</div>
    </section>

    <section class="summary-grid">
      <article class="summary-card rf-card">
        <span class="summary-label">Total API VPN</span>
        <strong>{{ apiVpns.length }}</strong>
      </article>
      <article class="summary-card rf-card">
        <span class="summary-label">L2TP</span>
        <strong>{{ apiL2tp.length }}</strong>
      </article>
      <article class="summary-card rf-card">
        <span class="summary-label">WireGuard</span>
        <strong>{{ apiWg.length }}</strong>
      </article>
      <article class="summary-card rf-card">
        <span class="summary-label">Instance</span>
        <strong>{{ instanceCount }}</strong>
      </article>
    </section>

    <section class="toolbar rf-card">
      <label>
        <span>Tipe</span>
        <select v-model="typeFilter">
          <option value="all">Semua</option>
          <option value="l2tp">L2TP</option>
          <option value="wireguard">WireGuard</option>
        </select>
      </label>
      <label>
        <span>Instance</span>
        <select v-model="instanceFilter">
          <option value="all">Semua instance</option>
          <option v-for="inst in instances" :key="inst" :value="inst">{{ inst }}</option>
        </select>
      </label>
      <label class="search-box">
        <span>Cari</span>
        <input v-model.trim="query" placeholder="nama, instance, subnet, IP ONT…" />
      </label>
    </section>

    <section class="rf-card table-card">
      <div v-if="error" class="alert-error">{{ error }}</div>
      <div v-if="loading" class="empty-state">Memuat data VPN dari API…</div>
      <div v-else-if="filteredVpns.length === 0" class="empty-state">Belum ada VPN yang dibuat dari API.</div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tipe</th>
              <th>Nama</th>
              <th>Instance</th>
              <th>VPN IP</th>
              <th>Subnet ONT</th>
              <th>IP ONT</th>
              <th>ROS</th>
              <th>Dibuat</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="vpn in filteredVpns" :key="`${vpn.type}:${vpn.name}`">
              <td><span class="badge" :class="vpn.type">{{ vpn.typeLabel }}</span></td>
              <td>
                <strong>{{ vpn.name }}</strong>
                <small v-if="vpn.note">{{ vpn.note }}</small>
              </td>
              <td>{{ vpn.instance || '—' }}</td>
              <td><code>{{ vpn.vpnIp || '—' }}</code></td>
              <td><code>{{ vpn.lanSubnet || '—' }}</code></td>
              <td><code>{{ vpn.ontIp || '—' }}</code></td>
              <td>{{ vpn.rosVersion || '—' }}</td>
              <td>{{ formatDate(vpn.created) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'

const loading = ref(true)
const error = ref('')
const l2tpUsers = ref([])
const wgPeers = ref([])
const typeFilter = ref('all')
const instanceFilter = ref('all')
const query = ref('')

const loadingAllow = ref(false)
const savingAllow = ref(false)
const allowText = ref('')
const allowEnabled = ref(false)
const allowCount = ref(0)
const allowUpdatedAt = ref('')
const allowMsg = ref('')
const allowError = ref('')

const apiL2tp = computed(() => l2tpUsers.value.filter(u => u.source === 'api'))
const apiWg = computed(() => wgPeers.value.filter(p => p.source === 'api'))

const apiVpns = computed(() => [
  ...apiL2tp.value.map(u => ({
    type: 'l2tp',
    typeLabel: 'L2TP',
    name: u.username,
    instance: u.instance || '',
    note: u.note || '',
    vpnIp: u.vpn_ip || '',
    lanSubnet: u.lan_subnet || '',
    ontIp: u.ont_ip || '',
    rosVersion: u.ros_version || '',
    created: u.created || '',
  })),
  ...apiWg.value.map(p => ({
    type: 'wireguard',
    typeLabel: 'WG',
    name: p.name,
    instance: p.instance || '',
    note: p.note || '',
    vpnIp: p.peer_ip || '',
    lanSubnet: p.lan_subnet || '',
    ontIp: p.ont_ip || '',
    rosVersion: p.ros_version || '7',
    created: p.created || '',
  })),
].sort((a, b) => String(b.created).localeCompare(String(a.created))))

const instances = computed(() => {
  const set = new Set(apiVpns.value.map(v => v.instance).filter(Boolean))
  return Array.from(set).sort((a, b) => a.localeCompare(b))
})

const instanceCount = computed(() => instances.value.length)

const filteredVpns = computed(() => {
  const q = query.value.toLowerCase()
  return apiVpns.value.filter(v => {
    if (typeFilter.value !== 'all' && v.type !== typeFilter.value) return false
    if (instanceFilter.value !== 'all' && v.instance !== instanceFilter.value) return false
    if (!q) return true
    return [v.name, v.instance, v.note, v.vpnIp, v.lanSubnet, v.ontIp]
      .some(x => String(x || '').toLowerCase().includes(q))
  })
})

async function fetchAll() {
  loading.value = true
  error.value = ''
  try {
    const [l2tpRes, wgRes] = await Promise.all([
      axios.get('/api/vpn/l2tp/users'),
      axios.get('/api/vpn/wireguard/peers'),
    ])
    l2tpUsers.value = Array.isArray(l2tpRes.data) ? l2tpRes.data : []
    wgPeers.value = Array.isArray(wgRes.data) ? wgRes.data : []
  } catch (e) {
    error.value = e?.response?.data?.message || e.message || 'Gagal memuat data VPN dari API.'
  } finally {
    loading.value = false
  }
}

async function fetchAllowlist() {
  loadingAllow.value = true
  allowError.value = ''
  try {
    const res = await axios.get('/api/auth/provisioning-ip-allowlist')
    const data = res.data || {}
    const allow = Array.isArray(data.allow) ? data.allow : []
    allowText.value = allow.join('\n')
    allowEnabled.value = Boolean(data.enabled)
    allowCount.value = Number(data.count || allow.length || 0)
    allowUpdatedAt.value = data.updatedAt || ''
  } catch (e) {
    allowError.value = e?.response?.data?.message || e.message || 'Gagal memuat whitelist IP.'
  } finally {
    loadingAllow.value = false
  }
}

async function saveAllowlist() {
  savingAllow.value = true
  allowError.value = ''
  allowMsg.value = ''
  try {
    const allow = String(allowText.value || '')
      .split(/\r?\n/)
      .map(x => x.trim())
      .filter(Boolean)
    const res = await axios.put('/api/auth/provisioning-ip-allowlist', { allow })
    const data = res.data || {}
    const resultAllow = Array.isArray(data.allow) ? data.allow : allow
    allowText.value = resultAllow.join('\n')
    allowEnabled.value = Boolean(data.enabled)
    allowCount.value = Number(data.count || resultAllow.length || 0)
    allowUpdatedAt.value = data.updatedAt || allowUpdatedAt.value
    allowMsg.value = 'Whitelist IP berhasil disimpan.'
  } catch (e) {
    allowError.value = e?.response?.data?.message || e.message || 'Gagal menyimpan whitelist IP.'
  } finally {
    savingAllow.value = false
  }
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

onMounted(async () => {
  await Promise.all([fetchAll(), fetchAllowlist()])
})
</script>

<style scoped>
.api-vpn-page { display: grid; gap: 18px; }
.header-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px; }
.eyebrow { margin: 0 0 6px; color: var(--text-muted); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
h2 { margin: 0 0 6px; font-size: 22px; }
.muted { margin: 0; color: var(--text-muted); }
.summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.summary-card { padding: 16px; display: grid; gap: 6px; }
.summary-label { color: var(--text-muted); font-size: 13px; }
.summary-card strong { font-size: 24px; }
.allow-card { padding: 16px; display: grid; gap: 10px; }
.allow-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
.allow-head h3 { margin: 0 0 6px; font-size: 16px; }
.allow-text { width: 100%; border: 1px solid var(--border); border-radius: 10px; background: var(--bg-base); color: var(--text); padding: 10px 12px; outline: none; resize: vertical; min-height: 100px; }
.allow-meta { display: flex; gap: 14px; flex-wrap: wrap; color: var(--text-muted); font-size: 12px; }
.allow-ok { color: var(--success); font-size: 13px; }
.toolbar { padding: 14px; display: grid; grid-template-columns: 160px 220px 1fr; gap: 12px; align-items: end; }
label { display: grid; gap: 6px; color: var(--text-muted); font-size: 12px; }
select, input { width: 100%; border: 1px solid var(--border); border-radius: 10px; background: var(--bg-base); color: var(--text); padding: 10px 12px; outline: none; }
.table-card { padding: 0; overflow: hidden; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; }
th, td { padding: 13px 14px; text-align: left; border-bottom: 1px solid var(--border); vertical-align: top; }
th { color: var(--text-muted); font-size: 12px; font-weight: 600; background: var(--bg-base); }
td small { display: block; margin-top: 4px; color: var(--text-muted); }
code { font-size: 12px; }
.badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 9px; font-size: 12px; font-weight: 700; }
.badge.l2tp { background: var(--purple-soft); color: var(--purple); }
.badge.wireguard { background: var(--success-soft); color: var(--success); }
.empty-state { padding: 30px; text-align: center; color: var(--text-muted); }
.alert-error { margin: 14px; padding: 12px 14px; border-radius: 12px; background: var(--danger-soft); color: var(--danger); }
@media (max-width: 980px) { .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .toolbar { grid-template-columns: 1fr; } .allow-head { flex-direction: column; } }
@media (max-width: 640px) { .header-card { align-items: flex-start; flex-direction: column; } .summary-grid { grid-template-columns: 1fr; } }
</style>
