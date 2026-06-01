<template>
  <div class="rf-instances">

    <!-- ═══ Toolbar ═══ -->
    <header class="rf-toolbar">
      <div class="rf-toolbar-left">
        <div class="rf-summary">
          <div class="rf-summary-stat">
            <span class="rf-summary-num">{{ instances.length }}</span>
            <span class="rf-summary-label">Total</span>
          </div>
          <div class="rf-summary-divider"></div>
          <div class="rf-summary-stat">
            <span class="rf-summary-num" style="color:var(--success)">{{ activeCount }}</span>
            <span class="rf-summary-label">Online</span>
          </div>
          <div class="rf-summary-divider"></div>
          <div class="rf-summary-stat">
            <span class="rf-summary-num" style="color:var(--text-muted)">{{ instances.length - activeCount }}</span>
            <span class="rf-summary-label">Offline</span>
          </div>
        </div>
      </div>
      <div class="rf-toolbar-right">
        <div class="rf-toolbar-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input v-model="search" type="text" placeholder="Cari instance…" />
        </div>
        <button @click="fetchInstances" class="btn-secondary" :disabled="loading">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" :class="{ 'rf-rot': loading }">
            <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
          </svg>
          Refresh
        </button>
        <button @click="openAdd = true" class="btn-primary">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Instance
        </button>
      </div>
    </header>

    <!-- ═══ Table card ═══ -->
    <article class="rf-card">
      <div class="rf-table-wrap">
        <table class="rf-table">
          <thead>
            <tr>
              <th>Instance</th>
              <th>UI Port</th>
              <th>CWMP Port</th>
              <th>REST API Port</th>
              <th>Database</th>
              <th>Status</th>
              <th style="text-align:right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="7">
                <div class="rf-empty"><div class="rf-spinner"></div><span>Memuat instances…</span></div>
              </td>
            </tr>
            <tr v-else-if="filtered.length === 0">
              <td colspan="7">
                <div class="rf-empty">
                  <div class="rf-empty-ic">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/></svg>
                  </div>
                  <p class="rf-empty-title">{{ search ? 'Tidak ada hasil' : 'Belum ada instance' }}</p>
                  <p class="rf-empty-sub">{{ search ? 'Coba kata kunci lain.' : 'Klik tombol New Instance untuk memulai.' }}</p>
                </div>
              </td>
            </tr>
            <tr v-for="inst in paged" :key="inst.name">
              <td>
                <div class="rf-cell-instance">
                  <div class="avatar" style="width:34px;height:34px;font-size:13px"
                    :style="!inst.active ? 'background:linear-gradient(135deg,#5d6588,#414866)' : ''">
                    {{ inst.name.charAt(0).toUpperCase() }}
                  </div>
                  <div>
                    <div class="rf-cell-name">{{ inst.name }}</div>
                    <div class="rf-cell-sub">GenieACS · ID #{{ inst.name }}</div>
                  </div>
                </div>
              </td>
              <td>
                <a :href="instanceUrl(inst)" target="_blank" rel="noopener" class="rf-port-link" :title="instanceUrl(inst)">
                  <code>{{ inst.ui_port }}</code>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
              </td>
              <td>
                <span class="code-chip" style="color:var(--purple)">{{ inst.cwmp_port }}</span>
              </td>
              <td>
                <span v-if="inst.nbi_proxy_port" class="code-chip" style="color:var(--success)" :title="restApiUrl(inst)">{{ inst.nbi_proxy_port }}</span>
                <span v-else class="code-chip" style="color:var(--muted)" title="Belum diset RADFAST_NBI_PROXY_PORT — akses via port UI">—</span>
              </td>
              <td>
                <code class="rf-db">{{ inst.db }}</code>
              </td>
              <td>
                <span class="badge" :class="inst.active ? 'badge-success' : 'badge-muted'">
                  <span class="dot" :class="inst.active ? 'dot-success' : 'dot-muted'"></span>
                  {{ inst.active ? 'Online' : 'Offline' }}
                </span>
              </td>
              <td style="text-align:right">
                <div class="rf-actions">
                  <button v-if="!inst.active" @click="startInstance(inst.name)" :disabled="actionLoading === inst.name"
                    class="rf-act rf-act-success" title="Start">
                    <svg v-if="actionLoading !== inst.name" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>
                    <span v-else class="rf-mini-spin"></span>
                    Start
                  </button>
                  <button v-else @click="stopInstance(inst.name)" :disabled="actionLoading === inst.name"
                    class="rf-act rf-act-warning" title="Stop">
                    <svg v-if="actionLoading !== inst.name" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
                    <span v-else class="rf-mini-spin"></span>
                    Stop
                  </button>
                  <button @click="confirmDelete(inst.name)" :disabled="actionLoading === inst.name"
                    class="rf-act rf-act-danger" title="Delete">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>

    <!-- ═══ Pagination ═══ -->
    <div v-if="filtered.length > pageSize" class="rf-pagination">
      <button class="rf-page-btn" :disabled="page <= 1" @click="setPage(1)" title="First">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M11 17l-5-5 5-5v10zM18 17l-5-5 5-5v10z"/></svg>
      </button>
      <button class="rf-page-btn" :disabled="page <= 1" @click="setPage(page - 1)" title="Prev">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M14 17l-5-5 5-5v10z"/></svg>
      </button>

      <template v-for="p in paginationPages" :key="p">
        <span v-if="p === '...'" class="rf-page-dots">…</span>
        <button v-else class="rf-page-btn rf-page-num" :class="{ active: p === page }" @click="setPage(p)">
          {{ p }}
        </button>
      </template>

      <button class="rf-page-btn" :disabled="page >= totalPages" @click="setPage(page + 1)" title="Next">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M10 7l5 5-5 5V7z"/></svg>
      </button>
      <button class="rf-page-btn" :disabled="page >= totalPages" @click="setPage(totalPages)" title="Last">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M13 17l5-5-5-5v10zM6 17l5-5-5-5v10z"/></svg>
      </button>

      <span class="rf-page-info">{{ filtered.length }} total · {{ (page-1)*pageSize + 1 }}–{{ Math.min(page*pageSize, filtered.length) }}</span>
    </div>

    <!-- ═══ Add Modal ═══ -->
    <Transition name="modal">
      <div v-if="openAdd" class="rf-modal" @click.self="closeAdd">
        <div class="modal-box rf-modal-card">
          <header class="rf-modal-head">
            <div class="rf-modal-head-left">
              <span class="rf-modal-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
              </span>
              <div>
                <h3>Create New Instance</h3>
                <p>Port &amp; database di-generate otomatis.</p>
              </div>
            </div>
            <button @click="closeAdd" class="rf-modal-close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </header>

          <div class="rf-modal-body">
            <!-- Error alert -->
            <Transition name="slide">
              <div v-if="addError" class="rf-alert">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>{{ addError }}</span>
              </div>
            </Transition>

            <!-- Name input -->
            <div class="rf-form-field">
              <label>Instance Name <span class="rf-req">*</span></label>
              <input v-model="form.name" @input="onNameInput"
                type="text" placeholder="isp-client-1" autocomplete="off" autofocus />
              <p class="rf-form-hint">Lowercase, angka, dan tanda strip saja.</p>
            </div>

            <!-- Auto-assign preview -->
            <div class="rf-auto-preview" :class="{ 'is-ready': form.name && isValidName }">
              <div class="rf-auto-label">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Auto-assigned
              </div>
              <div class="rf-auto-chips">
                <div class="rf-auto-chip">
                  <span class="rf-auto-chip-key">UI Port</span>
                  <code class="rf-auto-chip-val" style="color:var(--info)">{{ preview.ui_port }}</code>
                </div>
                <div class="rf-auto-chip">
                  <span class="rf-auto-chip-key">CWMP Port</span>
                  <code class="rf-auto-chip-val" style="color:var(--purple)">{{ preview.cwmp_port }}</code>
                </div>
                <div class="rf-auto-chip rf-auto-chip-wide">
                  <span class="rf-auto-chip-key">Database</span>
                  <code class="rf-auto-chip-val" style="color:var(--success)">{{ preview.db }}</code>
                </div>
              </div>
            </div>
          </div>

          <footer class="rf-modal-foot">
            <button @click="closeAdd" class="btn-secondary">Cancel</button>
            <button @click="addInstance" :disabled="addLoading || !form.name || !isValidName" class="btn-primary">
              <span v-if="addLoading" class="rf-spinner" style="width:14px;height:14px;border-width:2px"></span>
              {{ addLoading ? 'Creating…' : 'Create Instance' }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>

    <!-- ═══ Delete Modal ═══ -->
    <Transition name="modal">
      <div v-if="deleteTarget" class="rf-modal" @click.self="deleteTarget = ''">
        <div class="modal-box rf-modal-card" style="max-width:400px">
          <div class="rf-confirm">
            <div class="rf-confirm-ic">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
              </svg>
            </div>
            <h3>Delete Instance?</h3>
            <p>
              Instance <strong>{{ deleteTarget }}</strong> akan dihapus permanen beserta seluruh konfigurasinya. Tindakan ini tidak bisa dibatalkan.
            </p>
          </div>
          <footer class="rf-modal-foot" style="border-top:1px solid var(--border)">
            <button @click="deleteTarget = ''" class="btn-secondary" style="flex:1">Cancel</button>
            <button @click="deleteInstance" class="btn-danger" style="flex:1">Delete</button>
          </footer>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import axios from 'axios'

const instances = ref([])
const loading   = ref(true)
const actionLoading = ref('')
const openAdd   = ref(false)
const addLoading = ref(false)
const addError  = ref('')
const deleteTarget = ref('')
const search    = ref('')
const form      = ref({ name: '' })

// ── Pagination ─────────────────────────────────────────────────────────────
const page     = ref(1)
const pageSize = ref(10)

// ── URL builder: pakai IP asli dari registry, fallback ke host dashboard ────
function instanceUrl(inst) {
  if (!inst.ui_port) return '#'
  const host = inst.ip || window.location.hostname
  const proto = window.location.protocol === 'https:' ? 'https:' : 'http:'
  return `${proto}//${host}:${inst.ui_port}`
}

// ── URL REST API: pakai port khusus NBI (jika ada) + secret path ───────────
function restApiUrl(inst) {
  const host = inst.ip || window.location.hostname
  const proto = window.location.protocol === 'https:' ? 'https:' : 'http:'
  const port = inst.nbi_proxy_port || inst.ui_port
  if (!port) return ''
  const gate = inst.nbi_gate_path || ''
  return `${proto}//${host}:${port}${gate}/devices`
}

// ── Name validation ──────────────────────────────────────────────────────
const isValidName = computed(() => /^[a-z][a-z0-9-]{0,30}$/.test(form.value.name))

// ── Auto-preview: compute next free ports from existing instances ─────────
function nextFreePort(field, base) {
  if (!instances.value.length) return base
  const used = new Set(instances.value.map(i => i[field]))
  let p = base
  while (used.has(p)) p++
  return p
}

const preview = computed(() => {
  const name = form.value.name.replace(/-/g, '_').replace(/[^a-z0-9_]/gi, '')
  return {
    ui_port:   nextFreePort('ui_port',   3000),
    cwmp_port: nextFreePort('cwmp_port', 7547),
    db:        name ? `genieacs_${name}` : 'genieacs_…',
  }
})

// Debounce so it doesn't flicker per keystroke
let nameTimer = null
function onNameInput() {
  clearTimeout(nameTimer)
  nameTimer = setTimeout(() => {}, 200)
}

// ── Counts ───────────────────────────────────────────────────────────────
const activeCount = computed(() => instances.value.filter(i => i.active).length)
const filtered    = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return instances.value
  return instances.value.filter(i =>
    i.name.toLowerCase().includes(q) ||
    String(i.ui_port).includes(q) ||
    String(i.cwmp_port).includes(q) ||
    (i.ip || '').toLowerCase().includes(q) ||
    (i.db || '').toLowerCase().includes(q),
  )
})
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize.value)))
const paged = computed(() => {
  if (page.value > totalPages.value) page.value = totalPages.value
  const start = (page.value - 1) * pageSize.value
  return filtered.value.slice(start, start + pageSize.value)
})
function setPage(next) {
  page.value = Math.min(Math.max(1, next), totalPages.value)
}

const paginationPages = computed(() => {
  const total = totalPages.value
  const cur = page.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = [1]
  if (cur > 3) pages.push('...')
  for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i)
  if (cur < total - 2) pages.push('...')
  pages.push(total)
  return pages
})

// ── API ───────────────────────────────────────────────────────────────────
async function fetchInstances() {
  loading.value = true
  try {
    const res = await axios.get('/api/instances')
    instances.value = res.data
  } catch (e) { console.error(e) }
  finally { loading.value = false }
}

async function startInstance(name) {
  actionLoading.value = name
  try { await axios.post(`/api/instances/${name}/start`); await fetchInstances() }
  catch (e) { alert(e.response?.data?.message || 'Gagal start') }
  finally { actionLoading.value = '' }
}

async function stopInstance(name) {
  actionLoading.value = name
  try { await axios.post(`/api/instances/${name}/stop`); await fetchInstances() }
  catch (e) { alert(e.response?.data?.message || 'Gagal stop') }
  finally { actionLoading.value = '' }
}

function confirmDelete(name) { deleteTarget.value = name }

async function deleteInstance() {
  actionLoading.value = deleteTarget.value
  try {
    await axios.delete(`/api/instances/${deleteTarget.value}`)
    deleteTarget.value = ''
    await fetchInstances()
  } catch (e) { alert(e.response?.data?.message || 'Gagal hapus') }
  finally { actionLoading.value = '' }
}

async function addInstance() {
  addError.value = ''
  if (!form.value.name) { addError.value = 'Nama instance wajib diisi.'; return }
  if (!isValidName.value) { addError.value = 'Nama: huruf kecil, angka, strip. Awali dengan huruf.'; return }
  addLoading.value = true
  try {
    // Hanya kirim name — backend auto-assign port & db
    await axios.post('/api/instances', { name: form.value.name })
    closeAdd()
    await fetchInstances()
  } catch (e) {
    addError.value = e.response?.data?.message || 'Gagal membuat instance.'
  } finally {
    addLoading.value = false
  }
}

function closeAdd() {
  openAdd.value = false
  addError.value = ''
  form.value = { name: '' }
}

watch(search, () => { page.value = 1 })
onMounted(fetchInstances)
</script>

<style scoped>
.rf-instances { display: flex; flex-direction: column; gap: 20px; }

/* ─── Toolbar ─── */
.rf-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 16px;
  padding: 18px 20px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 16px;
}
.rf-summary { display: flex; align-items: center; gap: 22px; }
.rf-summary-stat { display: flex; flex-direction: column; line-height: 1.1; }
.rf-summary-num {
  font-size: 22px; font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -.02em;
}
.rf-summary-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 3px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: .06em;
}
.rf-summary-divider {
  width: 1px; height: 32px;
  background: var(--border);
}

.rf-toolbar-right {
  display: flex; align-items: center; gap: 10px;
}
.rf-toolbar-search {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  width: 240px;
  transition: all .15s;
}
.rf-toolbar-search:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-ring);
}
.rf-toolbar-search svg { color: var(--text-muted); flex-shrink: 0; }
.rf-toolbar-search input {
  flex: 1; background: transparent; border: none; outline: none;
  font-size: 13px;
  padding: 0;
}
.rf-toolbar-search input:focus { background: transparent; box-shadow: none; }
.rf-rot { animation: rf-spin 1s linear infinite; }
@keyframes rf-spin { to { transform: rotate(360deg); } }

/* ─── Cells ─── */
.rf-table-wrap { overflow-x: auto; }
.rf-cell-instance { display: flex; align-items: center; gap: 12px; }
.rf-cell-name { font-size: 13.5px; font-weight: 600; color: var(--text-primary); }
.rf-cell-sub { font-size: 11px; color: var(--text-muted); margin-top: 1px; }
.rf-port-link {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 9px;
  border-radius: 6px;
  background: var(--info-soft);
  border: 1px solid rgba(59,158,255,.22);
  color: var(--info);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px; font-weight: 600;
  text-decoration: none;
  transition: all .15s;
}
.rf-port-link:hover { background: rgba(59,158,255,.18); }
.rf-db {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px;
  color: var(--text-secondary);
}

/* ─── Actions ─── */
.rf-actions { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
.rf-act {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 6px 11px;
  border-radius: 8px;
  font-size: 11.5px; font-weight: 600;
  border: 1px solid;
  transition: all .15s;
  background: transparent;
}
.rf-act-success { background: var(--success-soft); color: var(--success); border-color: rgba(26,188,156,.22); }
.rf-act-success:hover:not(:disabled) { background: rgba(26,188,156,.2); }
.rf-act-warning { background: var(--warning-soft); color: var(--warning); border-color: rgba(245,184,41,.22); }
.rf-act-warning:hover:not(:disabled) { background: rgba(245,184,41,.2); }
.rf-act-danger { background: var(--danger-soft); color: var(--danger); border-color: rgba(255,94,94,.22); padding: 6px 8px; }
.rf-act-danger:hover:not(:disabled) { background: rgba(255,94,94,.2); }

.rf-mini-spin {
  width: 11px; height: 11px;
  border: 1.5px solid currentColor; border-top-color: transparent;
  border-radius: 99px;
  animation: rf-spin .7s linear infinite;
}

/* ─── Empty ─── */
.rf-empty {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 60px 20px;
  color: var(--text-muted);
  font-size: 12.5px;
}
.rf-empty-ic {
  width: 50px; height: 50px;
  border-radius: 14px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-muted);
  display: flex; align-items: center; justify-content: center;
}
.rf-empty-title { font-size: 14px; font-weight: 600; color: var(--text-secondary); }
.rf-empty-sub   { font-size: 12px; color: var(--text-muted); }

/* ─── Modal ─── */
.rf-modal {
  position: fixed; inset: 0; z-index: 50;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  background: rgba(8, 11, 22, .65);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.rf-modal-card {
  width: 100%; max-width: 480px;
  background: var(--bg-surface);
  border: 1px solid var(--border-strong);
  border-radius: 18px;
  box-shadow: var(--shadow-modal);
  overflow: hidden;
}
.rf-modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border);
}
.rf-modal-head-left { display: flex; align-items: center; gap: 12px; }
.rf-modal-icon {
  width: 38px; height: 38px;
  border-radius: 11px;
  display: flex; align-items: center; justify-content: center;
  background: var(--accent-soft);
  color: var(--accent);
}
.rf-modal-head h3 {
  font-size: 15px; font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -.005em;
}
.rf-modal-head p {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}
.rf-modal-close {
  width: 30px; height: 30px;
  border-radius: 8px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-muted);
  display: flex; align-items: center; justify-content: center;
  transition: all .15s;
}
.rf-modal-close:hover { background: var(--bg-hover); color: var(--text-primary); }

.rf-modal-body {
  padding: 22px;
  display: flex; flex-direction: column; gap: 16px;
}
.rf-form-field { display: flex; flex-direction: column; gap: 6px; }
.rf-form-field label {
  font-size: 12px; font-weight: 600;
  color: var(--text-secondary);
}
.rf-form-field input { padding: 10px 12px; border-radius: 10px; }
.rf-form-hint { font-size: 11px; color: var(--text-muted); }
.rf-form-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
}

/* ─── Auto-preview ─── */
.rf-auto-preview {
  border-radius: 12px;
  border: 1px dashed var(--border-strong);
  padding: 14px 16px;
  background: var(--bg-elevated);
  transition: border-color .2s, background .2s;
}
.rf-auto-preview.is-ready {
  border-color: rgba(109,109,255,.35);
  background: rgba(109,109,255,.06);
}
.rf-auto-label {
  display: flex; align-items: center; gap: 5px;
  font-size: 10.5px; font-weight: 600;
  letter-spacing: .07em; text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.rf-auto-chips {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.rf-auto-chip {
  display: flex; flex-direction: column; gap: 4px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
}
.rf-auto-chip-wide { grid-column: 1 / -1; }
.rf-auto-chip-key {
  font-size: 10px; font-weight: 600;
  text-transform: uppercase; letter-spacing: .07em;
  color: var(--text-muted);
}
.rf-auto-chip-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px; font-weight: 700;
}
.rf-req { color: var(--danger); margin-left: 2px; }

.rf-modal-foot {
  display: flex; gap: 10px; justify-content: flex-end;
  padding: 16px 22px;
  background: var(--bg-elevated);
}

.rf-alert {
  display: flex; align-items: center; gap: 9px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--danger-soft);
  border: 1px solid rgba(255,94,94,.22);
  color: var(--danger);
  font-size: 12px;
}
.rf-alert svg { flex-shrink: 0; }

/* ─── Confirm ─── */
.rf-confirm { padding: 28px 22px 22px; text-align: center; }
.rf-confirm-ic {
  width: 56px; height: 56px;
  border-radius: 16px;
  background: var(--danger-soft);
  border: 1px solid rgba(255,94,94,.22);
  color: var(--danger);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 16px;
}
.rf-confirm h3 {
  font-size: 17px; font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -.01em;
}
.rf-confirm p {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 6px;
  line-height: 1.55;
}
.rf-confirm strong { color: var(--text-primary); font-weight: 600; }

/* ─── Pagination ─── */
.rf-pagination {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 4px 2px;
}
.rf-page-btn {
  min-width: 32px;
  height: 32px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all .15s;
}
.rf-page-btn svg { display: block; }
.rf-page-btn:hover:not(:disabled) { background: var(--bg-elevated); color: var(--text-primary); border-color: var(--border-strong); }
.rf-page-btn:disabled { opacity: .4; cursor: not-allowed; }
.rf-page-num.active {
  background: var(--accent, #605dff);
  border-color: var(--accent, #605dff);
  color: #fff;
}
.rf-page-dots { padding: 0 4px; color: var(--text-muted); }
.rf-page-info {
  margin-left: auto;
  font-size: 11.5px;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
}
</style>
