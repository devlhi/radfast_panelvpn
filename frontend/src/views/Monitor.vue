<template>
  <div class="rf-monitor">

    <!-- ═══ Toolbar ═══ -->
    <header class="rf-mon-tool">
      <div class="rf-mon-tool-left">
        <span class="dot" :class="autoRefresh ? 'dot-success' : 'dot-muted'"></span>
        <span class="rf-mon-status">{{ autoRefresh ? 'Live' : 'Paused' }}</span>
        <span class="rf-mon-meta">{{ autoRefresh ? 'Update tiap 3 detik' : 'Real-time monitoring dihentikan' }}</span>
      </div>
      <button @click="toggleAuto" class="rf-mon-toggle" :class="{ 'is-on': autoRefresh }">
        <svg v-if="autoRefresh" width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
        {{ autoRefresh ? 'Pause' : 'Resume' }}
      </button>
    </header>

    <!-- ═══ Stat cards ═══ -->
    <section class="rf-stats">
      <!-- CPU -->
      <article class="rf-stat-card rf-card rf-card-hover">
        <div class="rf-stat-head">
          <div class="rf-stat-ic" :style="`background:${cpuColor(stats.cpu).soft};color:${cpuColor(stats.cpu).text}`">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <span class="rf-stat-label">CPU Usage</span>
        </div>
        <div class="rf-stat-row">
          <div class="rf-stat-num" :style="`color:${cpuColor(stats.cpu).text}`">
            {{ stats.cpu ?? '—' }}<span class="rf-stat-unit">%</span>
          </div>
          <span class="badge" :class="cpuBadge(stats.cpu)">{{ cpuLabel(stats.cpu) }}</span>
        </div>
        <div class="rf-progress" style="height:6px">
          <div class="rf-progress-fill" :style="`width:${stats.cpu||0}%;background:${cpuColor(stats.cpu).bar}`"></div>
        </div>
      </article>

      <!-- RAM -->
      <article class="rf-stat-card rf-card rf-card-hover">
        <div class="rf-stat-head">
          <div class="rf-stat-ic" style="background:var(--info-soft);color:var(--info)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
          </div>
          <span class="rf-stat-label">Memory</span>
        </div>
        <div class="rf-stat-row">
          <div class="rf-stat-num" style="color:var(--info)">
            {{ stats.ram ?? '—' }}<span class="rf-stat-unit">%</span>
          </div>
        </div>
        <div class="rf-stat-sub">{{ stats.ram_used || '—' }} / {{ stats.ram_total || '—' }}</div>
        <div class="rf-progress" style="height:6px">
          <div class="rf-progress-fill" :style="`width:${stats.ram||0}%;background:var(--info)`"></div>
        </div>
      </article>

      <!-- Disk -->
      <article class="rf-stat-card rf-card rf-card-hover">
        <div class="rf-stat-head">
          <div class="rf-stat-ic" style="background:var(--purple-soft);color:var(--purple)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="7" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="7" cy="18" r="1.2" fill="currentColor" stroke="none"/></svg>
          </div>
          <span class="rf-stat-label">Disk</span>
        </div>
        <div class="rf-stat-row">
          <div class="rf-stat-num" style="color:var(--purple)">
            {{ stats.disk ?? '—' }}<span class="rf-stat-unit">%</span>
          </div>
        </div>
        <div class="rf-stat-sub">{{ stats.disk_used || '—' }} / {{ stats.disk_total || '—' }}</div>
        <div class="rf-progress" style="height:6px">
          <div class="rf-progress-fill" :style="`width:${stats.disk||0}%;background:var(--purple)`"></div>
        </div>
      </article>

      <!-- Uptime -->
      <article class="rf-stat-card rf-card rf-card-hover">
        <div class="rf-stat-head">
          <div class="rf-stat-ic" style="background:var(--success-soft);color:var(--success)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
          <span class="rf-stat-label">Uptime</span>
        </div>
        <div class="rf-stat-row">
          <div class="rf-stat-num rf-stat-num-sm" style="color:var(--success)">{{ stats.uptime || '—' }}</div>
        </div>
        <div class="rf-stat-sub">Load avg: <code>{{ stats.load || '—' }}</code></div>
        <div class="rf-stat-pulse">
          <span class="dot dot-success"></span>
          <span style="color:var(--success);font-size:11px;font-weight:600">System running</span>
        </div>
      </article>
    </section>

    <!-- ═══ Modern charts ═══ -->
    <section class="rf-grid-2">
      <article class="rf-card rf-chart-card">
        <header class="rf-section-head">
          <div class="rf-section-head-left">
            <span class="rf-section-ic" style="background:var(--accent-soft);color:var(--accent)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-6 4 4 7-9"/><path d="M14 6h5v5"/></svg>
            </span>
            <div>
              <h3>CPU Realtime</h3>
              <p>Smooth graph, last 90 seconds</p>
            </div>
          </div>
          <code class="code-chip">{{ stats.cpu ?? 0 }}% now</code>
        </header>
        <div class="rf-line-chart cpu-modern">
          <svg viewBox="0 0 300 120" preserveAspectRatio="none">
            <defs>
              <linearGradient id="cpuArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.32" />
                <stop offset="100%" stop-color="var(--accent)" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path :d="areaPath(cpuHistory, 100)" fill="url(#cpuArea)" />
            <path :d="linePath(cpuHistory, 100)" class="line cpu-line" />
          </svg>
          <div class="rf-chart-overlay">
            <span>0%</span><span>50%</span><span>100%</span>
          </div>
        </div>
        <div class="rf-chart-axis"><span>90s lalu</span><span>sekarang</span></div>
      </article>

      <article class="rf-card rf-chart-card">
        <header class="rf-section-head">
          <div class="rf-section-head-left">
            <span class="rf-section-ic" style="background:var(--info-soft);color:var(--info)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V4"/><path d="m5 11 7-7 7 7"/><path d="m19 13-7 7-7-7"/></svg>
            </span>
            <div>
              <h3>Traffic VPS</h3>
              <p>Interface aktif: {{ activeNet?.name || '—' }}</p>
            </div>
          </div>
          <div class="net-pills">
            <span class="net-pill down">↓ {{ formatRate(activeNet?.rx_sec || 0) }}</span>
            <span class="net-pill up">↑ {{ formatRate(activeNet?.tx_sec || 0) }}</span>
          </div>
        </header>
        <div class="rf-line-chart net-modern">
          <svg viewBox="0 0 300 120" preserveAspectRatio="none">
            <defs>
              <linearGradient id="rxArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--info)" stop-opacity="0.26" />
                <stop offset="100%" stop-color="var(--info)" stop-opacity="0" />
              </linearGradient>
              <linearGradient id="txArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--success)" stop-opacity="0.2" />
                <stop offset="100%" stop-color="var(--success)" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path :d="areaPath(netRxHistory, maxNetRate)" fill="url(#rxArea)" />
            <path :d="areaPath(netTxHistory, maxNetRate)" fill="url(#txArea)" />
            <path :d="linePath(netRxHistory, maxNetRate)" class="line rx-line" />
            <path :d="linePath(netTxHistory, maxNetRate)" class="line tx-line" />
          </svg>
          <div class="rf-chart-overlay">
            <span>{{ formatRate(maxNetRate) }}</span><span>{{ formatRate(maxNetRate/2) }}</span><span>0 bps</span>
          </div>
        </div>
        <div class="net-ifaces">
          <div v-for="iface in stats.net || []" :key="iface.name" class="net-iface">
            <span class="dot" :class="iface.up ? 'dot-success' : 'dot-muted'"></span>
            <strong>{{ iface.name }}</strong>
            <em>{{ iface.ip || 'no-ip' }}</em>
            <span>↓ {{ formatRate(iface.rx_sec) }}</span>
            <span>↑ {{ formatRate(iface.tx_sec) }}</span>
          </div>
        </div>
      </article>
    </section>

    <!-- ═══ Services + Processes ═══ -->
    <section class="rf-grid-2">

      <article class="rf-card">
        <header class="rf-section-head">
          <div class="rf-section-head-left">
            <span class="rf-section-ic" style="background:var(--success-soft);color:var(--success)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
            </span>
            <div>
              <h3>Services</h3>
              <p>GenieACS &amp; dependencies</p>
            </div>
          </div>
          <span class="badge badge-muted">{{ services.length }}</span>
        </header>
        <div class="rf-list">
          <div v-if="!services.length" class="rf-empty-row">
            <div class="rf-spinner"></div><span>Memuat services…</span>
          </div>
          <div v-for="svc in services" :key="svc.name" class="rf-list-row">
            <span class="dot" :class="svc.running ? 'dot-success' : 'dot-muted'"></span>
            <div class="rf-list-info">
              <div class="rf-list-name">{{ svc.name }}</div>
              <div class="rf-list-sub">{{ svc.desc }}</div>
            </div>
            <span class="badge" :class="svc.running ? 'badge-success' : 'badge-muted'">
              {{ svc.running ? 'Running' : 'Stopped' }}
            </span>
          </div>
        </div>
      </article>

      <article class="rf-card">
        <header class="rf-section-head">
          <div class="rf-section-head-left">
            <span class="rf-section-ic" style="background:var(--info-soft);color:var(--info)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </span>
            <div>
              <h3>Top Processes</h3>
              <p>Sorted by CPU usage</p>
            </div>
          </div>
          <span class="badge badge-muted">{{ topProcs.length }}</span>
        </header>
        <div class="rf-list">
          <div v-if="!topProcs.length" class="rf-empty-row">
            <div class="rf-spinner"></div><span>Memuat proses…</span>
          </div>
          <div v-for="proc in topProcs" :key="proc.pid" class="rf-list-row">
            <code class="rf-pid">{{ String(proc.pid).slice(-4) }}</code>
            <div class="rf-list-info">
              <div class="rf-list-name">{{ proc.name }}</div>
              <div class="rf-list-sub">PID {{ proc.pid }}</div>
            </div>
            <div class="rf-proc-stats">
              <span class="rf-proc-cpu">{{ proc.cpu }}%</span>
              <span class="rf-proc-mem">{{ proc.mem }}</span>
            </div>
          </div>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import axios from 'axios'

const stats = ref({})
const services = ref([])
const topProcs = ref([])
const cpuHistory = ref(Array(30).fill(0))
const netRxHistory = ref(Array(30).fill(0))
const netTxHistory = ref(Array(30).fill(0))
const autoRefresh = ref(true)
let timer = null

function cpuColor(val) {
  if (!val || val <= 0) return { text: 'var(--text-muted)', bar: 'var(--border-strong)', soft: 'var(--bg-elevated)' }
  if (val > 85) return { text: 'var(--danger)',  bar: 'var(--danger)',  soft: 'var(--danger-soft)' }
  if (val > 60) return { text: 'var(--warning)', bar: 'var(--warning)', soft: 'var(--warning-soft)' }
  return            { text: 'var(--success)', bar: 'var(--success)', soft: 'var(--success-soft)' }
}
function cpuBadge(val) {
  if (!val || val <= 0) return 'badge-muted'
  if (val > 85) return 'badge-danger'
  if (val > 60) return 'badge-warning'
  return 'badge-success'
}
function cpuLabel(val) {
  if (!val || val <= 0) return 'Idle'
  if (val > 85) return 'Critical'
  if (val > 60) return 'High'
  return 'Healthy'
}

const activeNet = computed(() => {
  const list = stats.value?.net || []
  if (!list.length) return null
  return [...list].sort((a, b) => (b.up - a.up) || ((b.rx_sec + b.tx_sec) - (a.rx_sec + a.tx_sec)))[0]
})

const maxNetRate = computed(() => {
  const m = Math.max(...netRxHistory.value, ...netTxHistory.value, 1)
  return Math.max(1024, m)
})

function formatRate(bytesPerSec) {
  const b = Number(bytesPerSec || 0)
  if (b >= 1024 * 1024 * 1024) return `${(b / (1024 * 1024 * 1024)).toFixed(2)} Gbps`
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} Mbps`
  if (b >= 1024) return `${(b / 1024).toFixed(1)} Kbps`
  return `${b.toFixed(0)} bps`
}

function linePath(points, maxVal = 100) {
  const vals = points.length ? points : [0]
  const w = 300
  const h = 120
  const step = vals.length > 1 ? w / (vals.length - 1) : w
  return vals.map((v, i) => {
    const x = i * step
    const y = h - ((Math.min(Math.max(v || 0, 0), maxVal) / maxVal) * h)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ')
}

function areaPath(points, maxVal = 100) {
  const vals = points.length ? points : [0]
  const w = 300
  const h = 120
  const step = vals.length > 1 ? w / (vals.length - 1) : w
  const line = linePath(vals, maxVal)
  const endX = ((vals.length - 1) * step).toFixed(2)
  return `${line} L${endX} ${h} L0 ${h} Z`
}

async function fetchStats() {
  try {
    const res = await axios.get('/api/monitor/stats')
    stats.value = res.data

    cpuHistory.value.push(res.data.cpu || 0)
    if (cpuHistory.value.length > 30) cpuHistory.value.shift()

    const net = (res.data.net || [])[0] || { rx_sec: 0, tx_sec: 0 }
    netRxHistory.value.push(net.rx_sec || 0)
    netTxHistory.value.push(net.tx_sec || 0)
    if (netRxHistory.value.length > 30) netRxHistory.value.shift()
    if (netTxHistory.value.length > 30) netTxHistory.value.shift()
  } catch (e) { console.error(e) }
}

async function fetchServices() {
  try { const res = await axios.get('/api/monitor/services'); services.value = res.data }
  catch (e) { console.error(e) }
}

async function fetchProcs() {
  try { const res = await axios.get('/api/monitor/processes'); topProcs.value = res.data }
  catch (e) { console.error(e) }
}

function startTimer() {
  if (timer) return
  timer = setInterval(async () => { await fetchStats(); await fetchProcs() }, 3000)
}
function stopTimer() { clearInterval(timer); timer = null }
function toggleAuto() {
  autoRefresh.value = !autoRefresh.value
  autoRefresh.value ? startTimer() : stopTimer()
}

onMounted(async () => {
  await Promise.all([fetchStats(), fetchServices(), fetchProcs()])
  if (autoRefresh.value) startTimer()
})
onUnmounted(stopTimer)
</script>

<style scoped>
.rf-monitor { display: flex; flex-direction: column; gap: 20px; }

/* ─── Toolbar ─── */
.rf-mon-tool {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 14px;
}
.rf-mon-tool-left { display: flex; align-items: center; gap: 10px; }
.rf-mon-status {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}
.rf-mon-meta {
  font-size: 11.5px;
  color: var(--text-muted);
}

.rf-mon-toggle {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 13px;
  border-radius: 9px;
  font-size: 12px; font-weight: 600;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  transition: all .15s;
}
.rf-mon-toggle.is-on {
  background: var(--success-soft);
  border-color: rgba(26,188,156,.22);
  color: var(--success);
}

/* ─── Stat cards grid ─── */
.rf-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
@media (max-width: 1100px) { .rf-stats { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px)  { .rf-stats { grid-template-columns: 1fr; } }

.rf-stat-card {
  padding: 18px;
  display: flex; flex-direction: column; gap: 12px;
}
.rf-stat-head { display: flex; align-items: center; gap: 10px; }
.rf-stat-ic {
  width: 36px; height: 36px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
}
.rf-stat-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: .04em;
}
.rf-stat-row {
  display: flex; align-items: baseline; justify-content: space-between;
  gap: 8px;
}
.rf-stat-num {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -.02em;
  line-height: 1;
}
.rf-stat-num-sm { font-size: 22px; font-weight: 700; }
.rf-stat-unit { font-size: 16px; font-weight: 600; opacity: .85; margin-left: 2px; }
.rf-stat-sub {
  font-size: 11.5px;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
}
.rf-stat-sub code {
  background: transparent;
  color: var(--text-secondary);
}
.rf-stat-pulse { display: flex; align-items: center; gap: 7px; }

/* ─── Section header ─── */
.rf-section-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}
.rf-section-head-left { display: flex; align-items: center; gap: 12px; }
.rf-section-ic {
  width: 30px; height: 30px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
}
.rf-section-head h3 {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -.005em;
}
.rf-section-head p {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

/* ─── Modern charts ─── */
.rf-chart-card { overflow: hidden; }
.rf-line-chart {
  position: relative;
  height: 140px;
  padding: 10px 18px 4px;
}
.rf-line-chart svg {
  width: 100%;
  height: 100%;
  display: block;
}
.rf-line-chart .line {
  fill: none;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.cpu-line { stroke: var(--accent); }
.rx-line { stroke: var(--info); }
.tx-line { stroke: var(--success); }
.rf-chart-overlay {
  position: absolute;
  right: 12px;
  top: 12px;
  bottom: 8px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  pointer-events: none;
}
.rf-chart-overlay span {
  font-size: 10px;
  color: var(--text-muted);
  background: rgba(15, 23, 42, .38);
  padding: 2px 6px;
  border-radius: 999px;
  font-family: 'JetBrains Mono', monospace;
}
.rf-chart-axis {
  display: flex;
  justify-content: space-between;
  padding: 2px 20px 14px;
  font-size: 10.5px;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
}

.net-pills { display: flex; gap: 6px; }
.net-pill {
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 999px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
}
.net-pill.down { background: var(--info-soft); color: var(--info); }
.net-pill.up { background: var(--success-soft); color: var(--success); }

.net-ifaces {
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
}
.net-iface {
  display: grid;
  grid-template-columns: auto auto 1fr auto auto;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  font-size: 11.5px;
}
.net-iface strong { color: var(--text-primary); font-size: 12px; }
.net-iface em {
  color: var(--text-muted);
  font-style: normal;
  font-family: 'JetBrains Mono', monospace;
}
.net-iface span {
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-secondary);
}
.net-iface:last-child { border-bottom: none; }

/* ─── Lists ─── */
.rf-grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
@media (max-width: 1024px) { .rf-grid-2 { grid-template-columns: 1fr; } }

.rf-list {
  max-height: 340px;
  overflow-y: auto;
}
.rf-list-row {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
  transition: background .15s;
}
.rf-list-row:hover { background: var(--bg-elevated); }
.rf-list-row:last-child { border-bottom: none; }
.rf-list-info { flex: 1; min-width: 0; }
.rf-list-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rf-list-sub {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 1px;
}

.rf-empty-row {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  padding: 40px 20px;
  font-size: 12.5px;
  color: var(--text-muted);
}

.rf-pid {
  flex-shrink: 0;
  width: 44px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-muted);
}

.rf-proc-stats {
  display: flex; flex-direction: column; align-items: flex-end; line-height: 1.2;
}
.rf-proc-cpu {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--warning);
}
.rf-proc-mem {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--info);
  margin-top: 2px;
}
</style>
