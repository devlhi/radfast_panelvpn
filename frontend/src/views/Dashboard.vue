<template>
  <div class="rf-dashboard">

    <!-- ═══ Welcome banner ═══ -->
    <section class="rf-hero">
      <div class="rf-hero-content">
        <div class="rf-hero-tag">
          <span class="dot dot-success"></span>
          {{ greeting }}
        </div>
        <h1 class="rf-hero-title">Welcome back, <span class="rf-grad">{{ auth.admin?.username || 'Admin' }}</span></h1>
        <p class="rf-hero-sub">
          {{ todayDate }} — Berikut ringkasan platform RadFast ACS Anda hari ini.
        </p>
        <div class="rf-hero-cta">
          <RouterLink to="/instances" class="btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Instance
          </RouterLink>
          <RouterLink to="/monitor" class="btn-secondary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            Live Monitor
          </RouterLink>
        </div>
      </div>
      <div class="rf-hero-art" aria-hidden="true">
        <div class="rf-art-ring rf-art-ring-1"></div>
        <div class="rf-art-ring rf-art-ring-2"></div>
        <div class="rf-art-ring rf-art-ring-3"></div>
        <div class="rf-art-icon">
          <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <polyline points="2 17 12 22 22 17"/>
            <polyline points="2 12 12 17 22 12"/>
          </svg>
        </div>
      </div>
    </section>

    <!-- ═══ Stat cards ═══ -->
    <section class="rf-stats">
      <article v-for="s in stats" :key="s.label" class="rf-stat rf-card rf-card-hover">
        <div class="rf-stat-top">
          <span class="rf-stat-icon" :style="`background:${s.iconBg};color:${s.color}`" v-html="s.icon"></span>
          <span class="rf-stat-trend" :class="s.trendUp ? 'is-up' : 'is-down'">
            <svg v-if="s.trendUp" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
            <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            {{ s.trend }}
          </span>
        </div>
        <div class="rf-stat-value">{{ s.value }}</div>
        <div class="rf-stat-label">{{ s.label }}</div>
        <div class="rf-stat-foot">
          <div class="rf-progress" style="flex:1;height:4px">
            <div :style="`width:${s.pct}%;background:${s.color}`"></div>
          </div>
          <span class="rf-stat-sub" :style="`color:${s.color}`">{{ s.sub }}</span>
        </div>
      </article>
    </section>

    <!-- ═══ Main grid ═══ -->
    <section class="rf-grid-main">

      <!-- Instances table -->
      <article class="rf-card rf-instances">
        <header class="rf-card-head">
          <div class="rf-card-head-left">
            <span class="rf-head-icon" style="background:var(--info-soft);color:var(--info)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
            </span>
            <div>
              <h3>Active Instances</h3>
              <p>{{ activeCount }} dari {{ instances.length }} sedang online</p>
            </div>
          </div>
          <RouterLink to="/instances" class="btn-ghost">
            View all
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </RouterLink>
        </header>

        <div class="rf-table-wrap">
          <table class="rf-table">
            <thead>
              <tr>
                <th>Instance</th>
                <th>Ports</th>
                <th>Database</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loadingInstances">
                <td colspan="4">
                  <div class="rf-empty">
                    <div class="rf-spinner"></div>
                    <span>Loading instances…</span>
                  </div>
                </td>
              </tr>
              <tr v-else-if="instances.length === 0">
                <td colspan="4">
                  <div class="rf-empty">
                    <div class="rf-empty-ic">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/></svg>
                    </div>
                    <p class="rf-empty-title">Belum ada instance</p>
                    <p class="rf-empty-sub">Mulai dengan membuat GenieACS instance pertama.</p>
                    <RouterLink to="/instances" class="btn-primary" style="margin-top:8px">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Create Instance
                    </RouterLink>
                  </div>
                </td>
              </tr>
              <tr v-for="inst in instances.slice(0,6)" :key="inst.name">
                <td>
                  <div class="rf-cell-instance">
                    <div class="avatar" style="width:32px;height:32px;font-size:12px"
                      :style="!inst.active ? 'background:linear-gradient(135deg,#5d6588,#414866)' : ''">
                      {{ inst.name.charAt(0).toUpperCase() }}
                    </div>
                    <div>
                      <div class="rf-cell-name">{{ inst.name }}</div>
                      <div class="rf-cell-sub">GenieACS instance</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div class="rf-port-row">
                    <span class="code-chip" style="color:var(--info)">UI {{ inst.ui_port }}</span>
                    <span class="code-chip" style="color:var(--purple)">CWMP {{ inst.cwmp_port }}</span>
                  </div>
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
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <!-- Sidebar widgets -->
      <aside class="rf-side-col">

        <!-- Quick actions -->
        <article class="rf-card">
          <header class="rf-card-head rf-card-head-compact">
            <h3>Quick Actions</h3>
          </header>
          <div class="rf-quick-list">
            <RouterLink v-for="a in quickActions" :key="a.path" :to="a.path" class="rf-quick">
              <span class="rf-quick-ic" :style="`background:${a.bg};color:${a.color}`" v-html="a.icon"></span>
              <div class="rf-quick-text">
                <div class="rf-quick-title">{{ a.title }}</div>
                <div class="rf-quick-sub">{{ a.sub }}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--text-muted)"><polyline points="9 18 15 12 9 6"/></svg>
            </RouterLink>
          </div>
        </article>

        <!-- System Health -->
        <article class="rf-card">
          <header class="rf-card-head rf-card-head-compact">
            <h3>System Health</h3>
            <RouterLink to="/monitor" class="rf-link-sm">Detail →</RouterLink>
          </header>
          <div class="rf-health-list">
            <div v-for="m in healthMetrics" :key="m.label" class="rf-health">
              <div class="rf-health-row">
                <div class="rf-health-label">
                  <span class="rf-health-ic" :style="`background:${m.bg};color:${m.color}`" v-html="m.icon"></span>
                  <span>{{ m.label }}</span>
                </div>
                <span class="rf-health-val" :style="`color:${m.color}`">{{ m.value }}</span>
              </div>
              <div class="rf-progress">
                <div :style="`width:${m.pct}%;background:${m.color}`"></div>
              </div>
            </div>
          </div>
        </article>

        <!-- Security mini-widget -->
        <article class="rf-card rf-sec-widget" :class="{ 'rf-sec-alert': secAlert }">
          <header class="rf-card-head rf-card-head-compact">
            <h3>
              <span class="rf-sec-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Security
              </span>
            </h3>
            <RouterLink to="/security" class="rf-link-sm">Detail →</RouterLink>
          </header>

          <div class="rf-sec-stats">
            <div class="rf-sec-stat rf-sec-stat-critical">
              <div class="rf-sec-stat-val">{{ secStats.critical }}</div>
              <div class="rf-sec-stat-lbl">Critical</div>
            </div>
            <div class="rf-sec-stat rf-sec-stat-high">
              <div class="rf-sec-stat-val">{{ secStats.high }}</div>
              <div class="rf-sec-stat-lbl">High</div>
            </div>
            <div class="rf-sec-stat rf-sec-stat-bans">
              <div class="rf-sec-stat-val">{{ secStats.bans }}</div>
              <div class="rf-sec-stat-lbl">Bans</div>
            </div>
          </div>

          <div v-if="secLoading" class="rf-sec-empty">Loading…</div>
          <div v-else-if="secEvents.length === 0" class="rf-sec-empty">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="opacity:.5"><path d="M9 12l2 2 4-4"/><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>Tidak ada serangan terdeteksi.</span>
          </div>
          <ul v-else class="rf-sec-list">
            <li v-for="(e, i) in secEvents" :key="i" class="rf-sec-item" :class="`is-${e.category}`">
              <div class="rf-sec-item-row">
                <span class="rf-sec-cat">{{ e.category }}</span>
                <span class="rf-sec-time">{{ formatRelTime(e.ts) }}</span>
              </div>
              <div class="rf-sec-item-path" :title="`${e.method} ${e.path}`">
                {{ e.method }} {{ e.path }}
              </div>
              <div class="rf-sec-item-meta">
                <span class="rf-sec-ip">{{ e.ip || '—' }}</span>
                <span v-for="t in (e.tags || []).slice(0, 3)" :key="t" class="rf-sec-tag">{{ t }}</span>
              </div>
            </li>
          </ul>
        </article>

      </aside>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useAuthStore } from '../stores/auth'
import axios from 'axios'

const auth = useAuthStore()
const instances = ref([])
const loadingInstances = ref(true)
const cpuVal = ref(0)
const ramVal = ref(0)

// ─── Security widget state ───────────────────────────────────────────────
const secStats   = ref({ critical: 0, high: 0, bans: 0 })
const secEvents  = ref([])
const secLoading = ref(true)
const secAlert   = computed(() => secStats.value.critical > 0 || secStats.value.bans > 0)
let secTimer = null

const activeCount = computed(() => instances.value.filter(i => i.active).length)
const todayDate = computed(() => new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 11) return 'Selamat pagi'
  if (h < 15) return 'Selamat siang'
  if (h < 18) return 'Selamat sore'
  return 'Selamat malam'
})

const ico = {
  server:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`,
  shield:   `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  cpu:      `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="2" x2="9" y2="4"/><line x1="15" y1="2" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="22"/><line x1="15" y1="20" x2="15" y2="22"/><line x1="20" y1="9" x2="22" y2="9"/><line x1="20" y1="14" x2="22" y2="14"/><line x1="2" y1="9" x2="4" y2="9"/><line x1="2" y1="14" x2="4" y2="14"/></svg>`,
  ram:      `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  plus:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  activity: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  vpn:      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
  hdd:      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="12" x2="2" y2="12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
}

const stats = computed(() => {
  const total = instances.value.length
  const active = activeCount.value
  return [
    {
      label: 'Total Instances',
      icon: ico.server,
      value: total || 0,
      sub: `${active} aktif`,
      pct: total ? (active / total) * 100 : 0,
      color: '#605dff',
      iconBg: 'rgba(96,93,255,.12)',
      trend: '+12%', trendUp: true,
    },
    {
      label: 'VPN Sessions',
      icon: ico.shield,
      value: '—',
      sub: 'ONT terhubung',
      pct: 35,
      color: '#a974ff',
      iconBg: 'rgba(169,116,255,.12)',
      trend: '+5%', trendUp: true,
    },
    {
      label: 'CPU Usage',
      icon: ico.cpu,
      value: cpuVal.value ? `${cpuVal.value}%` : '—',
      sub: cpuStatus(cpuVal.value),
      pct: cpuVal.value || 0,
      color: cpuColor(cpuVal.value),
      iconBg: cpuColor(cpuVal.value).replace(')', ',.12)').replace('rgb', 'rgba'),
      trend: cpuVal.value > 70 ? '+8%' : '−3%', trendUp: cpuVal.value > 70,
    },
    {
      label: 'RAM Usage',
      icon: ico.ram,
      value: ramVal.value ? `${ramVal.value}%` : '—',
      sub: ramVal.value > 80 ? 'Hampir penuh' : 'Normal',
      pct: ramVal.value || 0,
      color: ramVal.value > 80 ? '#ff5e5e' : '#1abc9c',
      iconBg: ramVal.value > 80 ? 'rgba(255,94,94,.12)' : 'rgba(26,188,156,.12)',
      trend: '+2%', trendUp: false,
    },
  ]
})

function cpuColor(v) {
  if (!v) return '#5d6588'
  if (v > 80) return '#ff5e5e'
  if (v > 60) return '#f5b829'
  return '#1abc9c'
}
function cpuStatus(v) {
  if (!v) return '—'
  if (v > 80) return 'Beban tinggi'
  if (v > 50) return 'Beban sedang'
  return 'Beban rendah'
}

const quickActions = [
  { path: '/instances', title: 'New Instance',  sub: 'Buat GenieACS instance', icon: ico.plus,     bg: 'rgba(96,93,255,.12)',  color: '#605dff' },
  { path: '/vpn',       title: 'Add VPN Peer',  sub: 'L2TP atau WireGuard',     icon: ico.vpn,      bg: 'rgba(169,116,255,.12)', color: '#a974ff' },
  { path: '/monitor',   title: 'Live Monitor',  sub: 'CPU, RAM, services',     icon: ico.activity, bg: 'rgba(26,188,156,.12)', color: '#1abc9c' },
]

const healthMetrics = computed(() => [
  {
    label: 'CPU',
    icon: ico.cpu,
    value: cpuVal.value ? `${cpuVal.value}%` : '—',
    pct: cpuVal.value || 0,
    color: cpuColor(cpuVal.value),
    bg: 'rgba(245,184,41,.12)',
  },
  {
    label: 'Memory',
    icon: ico.ram,
    value: ramVal.value ? `${ramVal.value}%` : '—',
    pct: ramVal.value || 0,
    color: ramVal.value > 80 ? '#ff5e5e' : '#3b9eff',
    bg: 'rgba(59,158,255,.12)',
  },
  {
    label: 'Instance Active',
    icon: ico.hdd,
    value: `${activeCount.value}/${instances.value.length || 0}`,
    pct: instances.value.length ? (activeCount.value / instances.value.length * 100) : 0,
    color: '#a974ff',
    bg: 'rgba(169,116,255,.12)',
  },
])

onMounted(async () => {
  try {
    const [instRes, sysRes] = await Promise.all([
      axios.get('/api/instances'),
      axios.get('/api/monitor/quick'),
    ])
    instances.value = instRes.data
    cpuVal.value    = sysRes.data?.cpu || 0
    ramVal.value    = sysRes.data?.ram || 0
  } catch (e) {
    console.error(e)
  } finally {
    loadingInstances.value = false
  }

  // Initial security fetch + 30s auto-refresh
  await loadSecurity()
  secTimer = setInterval(loadSecurity, 30_000)
})

onBeforeUnmount(() => {
  if (secTimer) clearInterval(secTimer)
  secTimer = null
})

async function loadSecurity() {
  try {
    const [sumRes, recentRes] = await Promise.all([
      axios.get('/api/security/summary'),
      axios.get('/api/security/recent', { params: { limit: 3, minScore: 20 } }),
    ])
    const cat = sumRes.data?.summary?.byCategory || {}
    secStats.value = {
      critical: cat.critical || 0,
      high:     cat.high     || 0,
      bans:     (sumRes.data?.bans || []).length,
    }
    secEvents.value = recentRes.data?.events || []
  } catch (e) {
    // 401 happens during the brief window before the auth store finishes
    // restoring the session — silent retry on the next tick is fine.
    if (e?.response?.status !== 401) console.error('[security widget]', e)
  } finally {
    secLoading.value = false
  }
}

function formatRelTime(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  if (Number.isNaN(diff)) return ''
  if (diff < 60_000)         return Math.max(1, Math.floor(diff / 1000)) + 's ago'
  if (diff < 3_600_000)      return Math.floor(diff / 60_000) + 'm ago'
  if (diff < 86_400_000)     return Math.floor(diff / 3_600_000) + 'h ago'
  return Math.floor(diff / 86_400_000) + 'd ago'
}
</script>

<style scoped>
.rf-dashboard { display: flex; flex-direction: column; gap: 22px; }

/* ─── Hero ─── */
.rf-hero {
  position: relative;
  display: flex; align-items: center; justify-content: space-between;
  gap: 24px;
  padding: 28px 32px;
  border-radius: 20px;
  background:
    radial-gradient(circle at 88% 50%, rgba(96,93,255,.18), transparent 55%),
    radial-gradient(circle at 95% 100%, rgba(169,116,255,.15), transparent 50%),
    var(--bg-surface);
  border: 1px solid var(--border);
  overflow: hidden;
}
.rf-hero-content { position: relative; z-index: 2; max-width: 620px; }
.rf-hero-tag {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 4px 12px;
  border-radius: 99px;
  background: var(--success-soft);
  border: 1px solid rgba(26,188,156,.22);
  color: var(--success);
  font-size: 11.5px; font-weight: 600;
}
.rf-hero-title {
  margin-top: 14px;
  font-size: 28px; font-weight: 800;
  letter-spacing: -.02em;
  color: var(--text-primary);
  line-height: 1.2;
}
.rf-grad {
  background: linear-gradient(120deg, #605dff, #a974ff);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.rf-hero-sub {
  margin-top: 8px;
  font-size: 13.5px;
  color: var(--text-secondary);
}
.rf-hero-cta {
  display: flex; align-items: center; gap: 10px;
  margin-top: 20px;
}

/* Hero art (rings) */
.rf-hero-art {
  position: relative;
  width: 180px; height: 180px;
  flex-shrink: 0;
  display: none;
}
@media (min-width: 1024px) { .rf-hero-art { display: block; } }
.rf-art-ring {
  position: absolute; inset: 0;
  border-radius: 99px;
  border: 1px dashed var(--border-strong);
}
.rf-art-ring-1 { animation: rf-spin-slow 28s linear infinite; }
.rf-art-ring-2 { inset: 22px; border-color: rgba(96,93,255,.4); animation: rf-spin-slow 16s linear infinite reverse; }
.rf-art-ring-3 { inset: 44px; border-color: rgba(169,116,255,.5); animation: rf-spin-slow 10s linear infinite; }
.rf-art-icon {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: #fff;
}
.rf-art-icon svg {
  filter: drop-shadow(0 6px 18px rgba(96,93,255,.6));
  color: var(--accent);
}
@keyframes rf-spin-slow { to { transform: rotate(360deg); } }

/* ─── Stats grid ─── */
.rf-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
@media (max-width: 1100px) { .rf-stats { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px)  { .rf-stats { grid-template-columns: 1fr; } }

.rf-stat { padding: 20px; }
.rf-stat-top {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 18px;
}
.rf-stat-icon {
  width: 40px; height: 40px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 11px;
}
.rf-stat-trend {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 3px 8px;
  border-radius: 99px;
  font-size: 11px; font-weight: 600;
}
.rf-stat-trend.is-up   { background: var(--success-soft); color: var(--success); }
.rf-stat-trend.is-down { background: var(--danger-soft);  color: var(--danger); }

.rf-stat-value {
  font-size: 28px; font-weight: 700;
  letter-spacing: -.02em;
  color: var(--text-primary);
  line-height: 1.1;
}
.rf-stat-label {
  font-size: 12.5px;
  color: var(--text-muted);
  margin-top: 4px;
}
.rf-stat-foot {
  display: flex; align-items: center; gap: 12px;
  margin-top: 16px;
}
.rf-stat-sub {
  font-size: 11.5px;
  font-weight: 600;
  white-space: nowrap;
}

/* ─── Main grid ─── */
.rf-grid-main {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 20px;
  align-items: start;
}
@media (max-width: 1100px) { .rf-grid-main { grid-template-columns: 1fr; } }

.rf-side-col { display: flex; flex-direction: column; gap: 20px; }

/* ─── Card heads ─── */
.rf-card-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
}
.rf-card-head-compact {
  padding: 16px 20px;
}
.rf-card-head-left { display: flex; align-items: center; gap: 12px; }
.rf-head-icon {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 9px;
}
.rf-card-head h3 {
  font-size: 14px; font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -.005em;
}
.rf-card-head p {
  font-size: 11.5px;
  color: var(--text-muted);
  margin-top: 2px;
}
.rf-link-sm {
  font-size: 11.5px; font-weight: 500;
  color: var(--accent);
  text-decoration: none;
}
.rf-link-sm:hover { color: var(--accent-hover); }

/* ─── Table cells ─── */
.rf-table-wrap { overflow-x: auto; }
.rf-cell-instance { display: flex; align-items: center; gap: 12px; }
.rf-cell-name {
  font-size: 13.5px; font-weight: 600;
  color: var(--text-primary);
}
.rf-cell-sub {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 1px;
}
.rf-port-row { display: flex; gap: 6px; flex-wrap: wrap; }
.rf-db {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px;
  color: var(--text-secondary);
}

/* ─── Empty state ─── */
.rf-empty {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 36px 18px;
  color: var(--text-muted);
  font-size: 12.5px;
}
.rf-empty-ic {
  width: 48px; height: 48px;
  border-radius: 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-muted);
  display: flex; align-items: center; justify-content: center;
}
.rf-empty-title { font-size: 13.5px; font-weight: 600; color: var(--text-secondary); margin-top: 4px; }
.rf-empty-sub { font-size: 12px; color: var(--text-muted); }

/* ─── Quick actions ─── */
.rf-quick-list { padding: 6px; }
.rf-quick {
  display: flex; align-items: center; gap: 12px;
  padding: 11px 14px;
  border-radius: 10px;
  text-decoration: none;
  transition: background .15s;
}
.rf-quick:hover { background: var(--bg-elevated); }
.rf-quick-ic {
  width: 36px; height: 36px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.rf-quick-text { flex: 1; min-width: 0; }
.rf-quick-title {
  font-size: 13px; font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}
.rf-quick-sub {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 1px;
}

/* ─── Health ─── */
.rf-health-list {
  padding: 18px 20px;
  display: flex; flex-direction: column; gap: 16px;
}
.rf-health-row {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 8px;
}
.rf-health-label {
  display: flex; align-items: center; gap: 10px;
  font-size: 12.5px;
  color: var(--text-secondary);
  font-weight: 500;
}
.rf-health-ic {
  width: 26px; height: 26px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
}
.rf-health-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px; font-weight: 700;
}

/* ─── Security mini-widget ─── */
.rf-sec-widget { display: flex; flex-direction: column; gap: 12px; }
.rf-sec-widget.rf-sec-alert {
  border-color: rgba(239, 68, 68, .35);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, .08);
}
.rf-sec-title { display: inline-flex; align-items: center; }
.rf-sec-stats {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
}
.rf-sec-stat {
  padding: 10px 8px; border-radius: 10px; text-align: center;
  background: rgba(148, 163, 184, .08);
  border: 1px solid var(--border);
}
.rf-sec-stat-val { font-size: 20px; font-weight: 800; line-height: 1.1; }
.rf-sec-stat-lbl {
  font-size: 10px; color: var(--text-muted);
  text-transform: uppercase; letter-spacing: .04em;
  margin-top: 2px; font-weight: 600;
}
.rf-sec-stat-critical .rf-sec-stat-val { color: #ef4444; }
.rf-sec-stat-critical { border-left: 3px solid #ef4444; }
.rf-sec-stat-high     .rf-sec-stat-val { color: #f59e0b; }
.rf-sec-stat-high     { border-left: 3px solid #f59e0b; }
.rf-sec-stat-bans     .rf-sec-stat-val { color: #b91c1c; }
.rf-sec-stat-bans     { border-left: 3px solid #b91c1c; }

.rf-sec-empty {
  display: flex; align-items: center; gap: 8px;
  padding: 14px 8px;
  font-size: 12px; color: var(--text-muted);
  justify-content: center;
}
.rf-sec-list {
  list-style: none; margin: 0; padding: 0;
  display: flex; flex-direction: column; gap: 8px;
}
.rf-sec-item {
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(148, 163, 184, .06);
  border-left: 3px solid #94a3b8;
}
.rf-sec-item.is-critical { border-left-color: #ef4444; background: rgba(239, 68, 68, .06); }
.rf-sec-item.is-high     { border-left-color: #f59e0b; background: rgba(245, 158, 11, .05); }
.rf-sec-item.is-medium   { border-left-color: #3b82f6; }
.rf-sec-item-row {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 10.5px;
}
.rf-sec-cat {
  font-weight: 700; text-transform: uppercase; letter-spacing: .05em;
  color: var(--text-secondary);
}
.rf-sec-item.is-critical .rf-sec-cat { color: #ef4444; }
.rf-sec-item.is-high     .rf-sec-cat { color: #f59e0b; }
.rf-sec-item.is-medium   .rf-sec-cat { color: #3b82f6; }
.rf-sec-time { color: var(--text-muted); font-size: 10px; }
.rf-sec-item-path {
  font-family: ui-monospace, 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-primary);
  margin-top: 4px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.rf-sec-item-meta {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  margin-top: 4px;
}
.rf-sec-ip {
  font-family: ui-monospace, monospace; font-size: 10.5px;
  color: var(--text-muted);
}
.rf-sec-tag {
  display: inline-block;
  padding: 1px 6px; border-radius: 99px;
  background: rgba(99, 102, 241, .12);
  color: #6366f1;
  font-size: 9.5px; font-weight: 600;
}
</style>
