<template>
  <div class="seclog-page">
    <!-- ═══ Header ═══ -->
    <div class="seclog-header">
      <div>
        <h2 class="seclog-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Security Log
        </h2>
        <p class="seclog-sub">
          Telemetri serangan terdeteksi. Payload disimpan dalam bentuk base64 + sha256
          agar tidak bisa dipakai ulang dari log.
        </p>
      </div>
      <div class="seclog-actions">
        <button class="btn btn-ghost" @click="refresh" :disabled="loading">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><polyline points="3 4 3 8 7 8"/><polyline points="21 20 21 16 17 16"/></svg>
          Refresh
        </button>
        <label class="btn btn-ghost" :class="{ 'is-on': autoRefresh }">
          <input type="checkbox" v-model="autoRefresh" hidden />
          <span class="dot" :class="autoRefresh ? 'dot-success' : 'dot-muted'"></span>
          Auto 5s
        </label>
      </div>
    </div>

    <!-- ═══ Stat cards ═══ -->
    <div class="stat-grid">
      <div class="stat-card stat-critical">
        <div class="stat-label">Critical</div>
        <div class="stat-value">{{ summary.byCategory?.critical || 0 }}</div>
      </div>
      <div class="stat-card stat-high">
        <div class="stat-label">High</div>
        <div class="stat-value">{{ summary.byCategory?.high || 0 }}</div>
      </div>
      <div class="stat-card stat-medium">
        <div class="stat-label">Medium</div>
        <div class="stat-value">{{ summary.byCategory?.medium || 0 }}</div>
      </div>
      <div class="stat-card stat-low">
        <div class="stat-label">Low</div>
        <div class="stat-value">{{ summary.byCategory?.low || 0 }}</div>
      </div>
      <div class="stat-card stat-bans">
        <div class="stat-label">IP Banned</div>
        <div class="stat-value">{{ bans.length }}</div>
      </div>
    </div>

    <!-- ═══ Top tags + Top IPs + Bans ═══ -->
    <div class="seclog-row">
      <div class="card seclog-half">
        <h3 class="card-title">Top Attack Patterns</h3>
        <div v-if="!summary.topTags?.length" class="card-empty">Belum ada data.</div>
        <div v-else class="bar-list">
          <div v-for="t in summary.topTags" :key="t.tag" class="bar-row" @click="filterTag = t.tag; load()">
            <span class="bar-label">{{ t.tag }}</span>
            <div class="bar-track">
              <div class="bar-fill" :style="{ width: barPct(t.count, summary.topTags[0]?.count) + '%' }"></div>
            </div>
            <span class="bar-count">{{ t.count }}</span>
          </div>
        </div>
      </div>

      <div class="card seclog-half">
        <h3 class="card-title">Top Source IPs</h3>
        <div v-if="!summary.topIps?.length" class="card-empty">Belum ada data.</div>
        <div v-else class="bar-list">
          <div v-for="t in summary.topIps" :key="t.ip" class="bar-row" @click="filterIp = t.ip; load()">
            <span class="bar-label mono">{{ t.ip || '(unknown)' }}</span>
            <div class="bar-track">
              <div class="bar-fill bar-ip" :style="{ width: barPct(t.count, summary.topIps[0]?.count) + '%' }"></div>
            </div>
            <span class="bar-count">{{ t.count }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══ Active bans ═══ -->
    <div v-if="bans.length" class="card">
      <h3 class="card-title">
        <span class="dot dot-danger"></span>
        Active IP Bans ({{ bans.length }})
      </h3>
      <table class="rf-table">
        <thead><tr><th>IP</th><th>Reason</th><th>Expires</th><th>Retry After</th><th></th></tr></thead>
        <tbody>
          <tr v-for="b in pagedBans" :key="b.ip">
            <td class="mono">{{ b.ip }}</td>
            <td><span class="tag tag-danger">{{ b.reason }}</span></td>
            <td>{{ formatTs(b.until) }}</td>
            <td>{{ formatDuration(b.retryAfterSec) }}</td>
            <td>
              <button class="btn btn-sm btn-ghost" @click="unblock(b.ip)">Unblock</button>
            </td>
          </tr>
        </tbody>
      </table>
      <!-- Bans Pagination -->
      <div v-if="bans.length > banPageSize" class="rf-pagination" style="margin-top:12px">
        <button class="rf-page-btn" :disabled="banPage <= 1" @click="setBanPage(1)" title="First">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M11 17l-5-5 5-5v10zM18 17l-5-5 5-5v10z"/></svg>
        </button>
        <button class="rf-page-btn" :disabled="banPage <= 1" @click="setBanPage(banPage - 1)" title="Prev">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M14 17l-5-5 5-5v10z"/></svg>
        </button>
        <template v-for="p in banPaginationPages" :key="p">
          <span v-if="p === '...'" class="rf-page-dots">…</span>
          <button v-else class="rf-page-btn rf-page-num" :class="{ active: p === banPage }" @click="setBanPage(p)">{{ p }}</button>
        </template>
        <button class="rf-page-btn" :disabled="banPage >= banTotalPages" @click="setBanPage(banPage + 1)" title="Next">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M10 7l5 5-5 5V7z"/></svg>
        </button>
        <button class="rf-page-btn" :disabled="banPage >= banTotalPages" @click="setBanPage(banTotalPages)" title="Last">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M13 17l5-5-5-5v10zM6 17l5-5-5-5v10z"/></svg>
        </button>
        <span class="rf-page-info">{{ bans.length }} bans · {{ (banPage-1)*banPageSize + 1 }}–{{ Math.min(banPage*banPageSize, bans.length) }}</span>
      </div>
    </div>

    <!-- ═══ Filters ═══ -->
    <div class="card">
      <div class="filter-row">
        <span class="filter-label">Filter:</span>
        <select v-model="filterMinScore" @change="load" class="input">
          <option :value="0">Semua skor</option>
          <option :value="20">≥ 20 (medium)</option>
          <option :value="50">≥ 50 (high)</option>
          <option :value="80">≥ 80 (critical)</option>
        </select>
        <input v-model="filterIp" placeholder="IP address" class="input" @keyup.enter="load" />
        <input v-model="filterTag" placeholder="tag (sqli, xss, …)" class="input" @keyup.enter="load" />
        <button class="btn btn-ghost" @click="resetFilters">Clear</button>
        <span class="filter-count">{{ events.length }} event</span>
      </div>
    </div>

    <!-- ═══ Events table ═══ -->
    <div class="card">
      <h3 class="card-title">Recent Events</h3>
      <div v-if="!events.length" class="card-empty">Tidak ada event.</div>
      <table v-else class="rf-table">
        <thead>
          <tr>
            <th style="width:120px">When</th>
            <th style="width:90px">Cat.</th>
            <th style="width:60px">Score</th>
            <th style="width:130px">IP</th>
            <th>Path</th>
            <th>Tags</th>
            <th style="width:90px">Action</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(e, i) in pagedEvents" :key="i" :class="rowClass(e)">
            <td class="mono small">{{ formatTs(e.ts) }}</td>
            <td><span class="tag" :class="catClass(e.category)">{{ e.category }}</span></td>
            <td class="mono">{{ e.score }}</td>
            <td class="mono small">{{ e.ip || '—' }}</td>
            <td class="mono small truncate">{{ e.method }} {{ e.path }}</td>
            <td>
              <span v-for="t in e.tags" :key="t" class="tag tag-tag" @click="filterTag = t; load()">{{ t }}</span>
            </td>
            <td>
              <span class="tag" :class="actionClass(e)">{{ e.banned ? 'banned' : (e.blocked ? 'blocked' : 'logged') }}</span>
            </td>
            <td>
              <button class="btn btn-sm btn-ghost" @click="openEvent(e)">Details</button>
            </td>
          </tr>
        </tbody>
      </table>
      <div v-if="events.length > pageSize" class="rf-pagination">
        <button class="rf-page-btn" :disabled="page <= 1" @click="setPage(1)">«</button>
        <button class="rf-page-btn" :disabled="page <= 1" @click="setPage(page - 1)">‹</button>
        <template v-for="p in paginationPages" :key="p">
          <span v-if="p === '...'" class="rf-page-dots">…</span>
          <button v-else class="rf-page-btn rf-page-num" :class="{ active: p === page }" @click="setPage(p)">{{ p }}</button>
        </template>
        <button class="rf-page-btn" :disabled="page >= totalPages" @click="setPage(page + 1)">›</button>
        <button class="rf-page-btn" :disabled="page >= totalPages" @click="setPage(totalPages)">»</button>
        <span class="rf-page-info">{{ events.length }} total · {{ (page-1)*pageSize + 1 }}–{{ Math.min(page*pageSize, events.length) }}</span>
      </div>
    </div>

    <!-- ═══ Detail modal ═══ -->
    <div v-if="selected" class="modal-bg" @click.self="selected = null">
      <div class="modal">
        <div class="modal-head">
          <h3>Event Detail</h3>
          <button class="btn btn-sm btn-ghost" @click="selected = null">×</button>
        </div>
        <div class="modal-body">
          <div class="kv"><span>Time</span><b>{{ selected.ts }}</b></div>
          <div class="kv"><span>Category</span>
            <span class="tag" :class="catClass(selected.category)">{{ selected.category }}</span>
            <span class="tag tag-score">score {{ selected.score }}</span>
          </div>
          <div class="kv"><span>IP / UA</span>
            <b class="mono">{{ selected.ip }}</b>
            <span class="ua">{{ selected.ua }}</span>
          </div>
          <div class="kv"><span>Request</span>
            <b class="mono">{{ selected.method }} {{ selected.path }}</b>
          </div>
          <div class="kv"><span>Tags</span>
            <span v-for="t in selected.tags" :key="t" class="tag tag-tag">{{ t }}</span>
          </div>
          <div class="kv"><span>Action</span>
            <span class="tag" :class="actionClass(selected)">{{ selected.banned ? 'banned' : (selected.blocked ? 'blocked' : 'logged') }}</span>
          </div>

          <h4 class="modal-section">Headers</h4>
          <pre class="codebox">{{ JSON.stringify(selected.headers, null, 2) }}</pre>

          <template v-if="selected.query">
            <h4 class="modal-section">Query (neutralised)</h4>
            <div class="kv"><span>sha256</span><b class="mono">{{ selected.query.sha256 }}</b></div>
            <div class="kv"><span>length</span><b>{{ selected.query.len }} bytes</b></div>
            <button v-if="!decoded.query" class="btn btn-sm btn-warn" @click="decode('query')">⚠ Reveal payload</button>
            <pre v-else class="codebox danger">{{ decoded.query }}</pre>
          </template>

          <template v-if="selected.body">
            <h4 class="modal-section">Body (neutralised)</h4>
            <div class="kv"><span>sha256</span><b class="mono">{{ selected.body.sha256 }}</b></div>
            <div class="kv"><span>length</span><b>{{ selected.body.len }} bytes</b></div>
            <button v-if="!decoded.body" class="btn btn-sm btn-warn" @click="decode('body')">⚠ Reveal payload</button>
            <pre v-else class="codebox danger">{{ decoded.body }}</pre>
          </template>

          <p class="hint">
            ℹ Payload yang di-decode bersifat read-only di browser. Jangan paste
            ke shell, browser tab biasa, atau database — gunakan sandbox.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import axios from 'axios'

const events  = ref([])
const summary = ref({})
const bans    = ref([])
const loading = ref(false)
const autoRefresh = ref(false)

const filterMinScore = ref(0)
const filterIp  = ref('')
const filterTag = ref('')

const selected = ref(null)
const decoded  = reactive({ query: '', body: '' })

// ── Pagination (events table) ──────────────────────────────────────────────
const page     = ref(1)
const pageSize = ref(15)
const totalPages = computed(() => Math.max(1, Math.ceil(events.value.length / pageSize.value)))
const pagedEvents = computed(() => {
  if (page.value > totalPages.value) page.value = totalPages.value
  const start = (page.value - 1) * pageSize.value
  return events.value.slice(start, start + pageSize.value)
})
function setPage(next) { page.value = Math.min(Math.max(1, next), totalPages.value) }
const paginationPages = computed(() => {
  const total = totalPages.value, cur = page.value
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = [1]
  if (cur > 3) pages.push('...')
  for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i)
  if (cur < total - 2) pages.push('...')
  pages.push(total)
  return pages
})

// ── Pagination (bans table) ────────────────────────────────────────────────
const banPage      = ref(1)
const banPageSize  = ref(10)
const banTotalPages = computed(() => Math.max(1, Math.ceil(bans.value.length / banPageSize.value)))
const pagedBans = computed(() => {
  if (banPage.value > banTotalPages.value) banPage.value = banTotalPages.value
  const s = (banPage.value - 1) * banPageSize.value
  return bans.value.slice(s, s + banPageSize.value)
})
function setBanPage(next) { banPage.value = Math.min(Math.max(1, next), banTotalPages.value) }
const banPaginationPages = computed(() => {
  const t = banTotalPages.value, c = banPage.value
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1)
  const pages = [1]
  if (c > 3) pages.push('...')
  for (let i = Math.max(2, c - 1); i <= Math.min(t - 1, c + 1); i++) pages.push(i)
  if (c < t - 2) pages.push('...')
  pages.push(t)
  return pages
})

let timer = null

async function load() {
  loading.value = true
  try {
    const params = {}
    if (filterMinScore.value) params.minScore = filterMinScore.value
    if (filterIp.value)       params.ip       = filterIp.value
    if (filterTag.value)      params.tag      = filterTag.value
    const [recent, sum] = await Promise.all([
      axios.get('/api/security/recent', { params }),
      axios.get('/api/security/summary'),
    ])
    events.value  = recent.data.events  || []
    summary.value = sum.data.summary    || {}
    bans.value    = sum.data.bans       || []
  } catch (e) {
    console.error(e)
  } finally {
    loading.value = false
  }
}

function refresh() { load() }
function resetFilters() { filterMinScore.value = 0; filterIp.value = ''; filterTag.value = ''; load() }

async function unblock(ip) {
  if (!confirm(`Unblock ${ip}?`)) return
  await axios.post('/api/security/unblock', { ip })
  await load()
}

function openEvent(e) {
  selected.value = e
  decoded.query = ''
  decoded.body  = ''
}

async function decode(kind) {
  if (!selected.value?.[kind]?.b64) return
  const res = await axios.post('/api/security/decode', { b64: selected.value[kind].b64 })
  decoded[kind] = res.data.text
}

function formatTs(s) {
  if (!s) return ''
  const d = new Date(s)
  return d.toLocaleString()
}
function formatDuration(sec) {
  if (sec >= 3600) return Math.floor(sec / 3600) + 'h ' + Math.floor((sec % 3600) / 60) + 'm'
  if (sec >= 60)   return Math.floor(sec / 60) + 'm ' + (sec % 60) + 's'
  return sec + 's'
}
function barPct(c, max) { return max ? Math.max(4, Math.round((c / max) * 100)) : 0 }
function catClass(c) {
  return ({
    critical: 'tag-danger', high: 'tag-warn', medium: 'tag-info',
    low: 'tag-muted', normal: 'tag-muted', blocked: 'tag-danger',
  }[c] || 'tag-muted')
}
function actionClass(e) {
  if (e.banned) return 'tag-danger'
  if (e.blocked) return 'tag-warn'
  return 'tag-muted'
}
function rowClass(e) { return e.category === 'critical' ? 'row-critical' : '' }

watch([filterMinScore, filterIp, filterTag], () => { page.value = 1 })
watch(autoRefresh, (v) => {
  if (v) timer = setInterval(load, 5000)
  else { clearInterval(timer); timer = null }
})

onMounted(load)
onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped>
.seclog-page { display: flex; flex-direction: column; gap: 16px; }

.seclog-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.seclog-title { display: flex; align-items: center; gap: 10px; font-size: 18px; font-weight: 700; color: var(--text-primary); margin: 0; }
.seclog-sub   { font-size: 12.5px; color: var(--text-muted); margin: 4px 0 0; max-width: 540px; }
.seclog-actions { display: flex; gap: 8px; align-items: center; }

.stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
.stat-card { padding: 14px 16px; border-radius: 12px; background: var(--bg-surface); border: 1px solid var(--border); }
.stat-label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; }
.stat-value { font-size: 24px; font-weight: 700; color: var(--text-primary); margin-top: 4px; }
.stat-critical { border-left: 3px solid #ef4444; }
.stat-high     { border-left: 3px solid #f59e0b; }
.stat-medium   { border-left: 3px solid #3b82f6; }
.stat-low      { border-left: 3px solid #94a3b8; }
.stat-bans     { border-left: 3px solid #b91c1c; }

.seclog-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 900px) { .seclog-row { grid-template-columns: 1fr; } }

.card { background: var(--bg-surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; }
.card-title { display: flex; align-items: center; gap: 8px; font-size: 13.5px; font-weight: 600; color: var(--text-primary); margin: 0 0 12px; }
.card-empty { font-size: 12.5px; color: var(--text-muted); padding: 12px 0; }

.bar-list { display: flex; flex-direction: column; gap: 8px; }
.bar-row { display: grid; grid-template-columns: 110px 1fr 36px; gap: 10px; align-items: center; cursor: pointer; }
.bar-row:hover .bar-label { color: var(--text-primary); }
.bar-label { font-size: 12px; color: var(--text-muted); }
.bar-label.mono { font-family: ui-monospace, monospace; font-size: 11px; }
.bar-track { height: 6px; background: rgba(148,163,184,.18); border-radius: 99px; overflow: hidden; }
.bar-fill  { height: 100%; background: linear-gradient(90deg, #ef4444, #f97316); border-radius: 99px; }
.bar-fill.bar-ip { background: linear-gradient(90deg, #6366f1, #8b5cf6); }
.bar-count { font-size: 12px; font-weight: 600; color: var(--text-primary); text-align: right; }

.rf-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.rf-table th { text-align: left; font-weight: 600; color: var(--text-muted); padding: 8px 10px; border-bottom: 1px solid var(--border); font-size: 11px; text-transform: uppercase; letter-spacing: .03em; }
.rf-table td { padding: 8px 10px; border-bottom: 1px solid var(--border); color: var(--text-primary); }
.rf-table tr:hover td { background: rgba(148,163,184,.06); }
.rf-table .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.rf-table .small { font-size: 11.5px; }
.rf-table .truncate { max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.row-critical td { background: rgba(239,68,68,.08); }

.tag { display: inline-block; padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; margin-right: 4px; }
.tag-danger { background: rgba(239,68,68,.15); color: #ef4444; }
.tag-warn   { background: rgba(245,158,11,.15); color: #f59e0b; }
.tag-info   { background: rgba(59,130,246,.15); color: #3b82f6; }
.tag-muted  { background: rgba(148,163,184,.15); color: #94a3b8; }
.tag-tag    { background: rgba(99,102,241,.12); color: #6366f1; cursor: pointer; }
.tag-tag:hover { background: rgba(99,102,241,.22); }
.tag-score  { background: rgba(245,158,11,.15); color: #f59e0b; }

.dot { display: inline-block; width: 8px; height: 8px; border-radius: 99px; }
.dot-success { background: #10b981; }
.dot-danger  { background: #ef4444; }
.dot-muted   { background: #94a3b8; }

.btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; border: 1px solid var(--border); background: var(--bg-surface); color: var(--text-primary); cursor: pointer; transition: .15s; }
.btn:hover { background: rgba(148,163,184,.1); }
.btn.is-on { border-color: #10b981; color: #10b981; }
.btn-ghost {}
.btn-warn { background: #f59e0b; color: #fff; border-color: transparent; }
.btn-warn:hover { background: #d97706; }
.btn-sm { padding: 4px 10px; font-size: 11px; }

.input { padding: 6px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-base); color: var(--text-primary); font-size: 12px; }
.filter-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.filter-label { font-size: 12px; color: var(--text-muted); font-weight: 600; }
.filter-count { margin-left: auto; font-size: 12px; color: var(--text-muted); }

.modal-bg { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px; }
.modal { background: var(--bg-surface); border-radius: 14px; max-width: 720px; width: 100%; max-height: 90vh; overflow: auto; border: 1px solid var(--border); }
.modal-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--border); }
.modal-head h3 { margin: 0; font-size: 14.5px; font-weight: 700; color: var(--text-primary); }
.modal-body { padding: 16px 18px; display: flex; flex-direction: column; gap: 8px; }
.modal-section { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: .04em; margin: 14px 0 4px; }
.kv { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-size: 12.5px; color: var(--text-primary); }
.kv > span:first-child { width: 80px; color: var(--text-muted); font-size: 11px; text-transform: uppercase; }
.ua { font-size: 11px; color: var(--text-muted); font-family: ui-monospace, monospace; word-break: break-all; }
.codebox { background: rgba(15,23,42,.06); border: 1px solid var(--border); border-radius: 8px; padding: 10px; font-size: 11.5px; font-family: ui-monospace, monospace; white-space: pre-wrap; word-break: break-all; max-height: 240px; overflow: auto; }
.codebox.danger { background: rgba(239,68,68,.08); border-color: rgba(239,68,68,.3); color: #b91c1c; }
.hint { font-size: 11.5px; color: var(--text-muted); margin: 8px 0 0; padding: 8px; background: rgba(245,158,11,.08); border: 1px solid rgba(245,158,11,.2); border-radius: 8px; }

/* ─── Pagination ─── */
.rf-pagination {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 12px;
}
.rf-page-btn {
  min-width: 30px;
  height: 30px;
  padding: 0 8px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.rf-page-btn:hover:not(:disabled) { background: rgba(148,163,184,.1); color: var(--text-primary); }
.rf-page-btn:disabled { opacity: .45; cursor: not-allowed; }
.rf-page-num.active { background: #6366f1; color: #fff; border-color: #6366f1; }
.rf-page-dots { padding: 0 3px; color: var(--text-muted); }
.rf-page-info {
  margin-left: auto;
  font-size: 11.5px;
  color: var(--text-muted);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
}
</style>
