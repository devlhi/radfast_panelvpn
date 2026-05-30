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
          <div class="rf-head-right">
            <span class="badge badge-muted">{{ services.length }}</span>
            <button class="rf-inline-btn" :disabled="acsBusy" @click="runEnableMultiProxy">
              <svg v-if="!acsBusy" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              {{ acsBusy ? 'Running…' : 'Enable Multi Proxy' }}
            </button>
          </div>
        </header>
        <div v-if="acsErr" class="rf-action-err">{{ acsErr }}</div>
        <div v-else-if="acsMsg" class="rf-action-ok">{{ acsMsg }}</div>
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
            <button
              class="rf-inline-btn danger"
              :disabled="killingPid === String(proc.pid)"
              @click="killProcess(proc)"
              :title="`Kill PID ${proc.pid}`"
            >
              {{ killingPid === String(proc.pid) ? '…' : '✕' }}
            </button>
          </div>
        </div>
      </article>
    </section>

    <!-- ═══ Memory Hogs + Kill All Node ═══ -->
    <section class="rf-grid-2">
      <article class="rf-card">
        <header class="rf-section-head">
          <div class="rf-section-head-left">
            <span class="rf-section-ic" style="background:var(--danger-soft);color:var(--danger)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
            </span>
            <div>
              <h3>Memory Hogs</h3>
              <p>Paling boros RAM, sorted desc</p>
            </div>
          </div>
          <div class="rf-head-right">
            <span class="badge badge-muted">{{ memProcs.length }}</span>
            <button class="rf-inline-btn danger" :disabled="nodeKillBusy" @click="killAllNode">
              <svg v-if="!nodeKillBusy" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              {{ nodeKillBusy ? 'Killing…' : 'Kill All Node' }}
            </button>
          </div>
        </header>
        <div v-if="nodeKillErr" class="rf-action-err">{{ nodeKillErr }}</div>
        <div v-else-if="nodeKillMsg" class="rf-action-ok">{{ nodeKillMsg }}</div>
        <div class="rf-list">
          <div v-if="!memProcs.length" class="rf-empty-row">
            <div class="rf-spinner"></div><span>Memuat data RAM…</span>
          </div>
          <div v-for="proc in memProcs" :key="proc.pid" class="rf-list-row">
            <code class="rf-pid">{{ String(proc.pid).slice(-4) }}</code>
            <div class="rf-list-info">
              <div class="rf-list-name">{{ proc.name }}</div>
              <div class="rf-list-sub">PID {{ proc.pid }}</div>
            </div>
            <div class="rf-proc-stats">
              <span class="rf-proc-mem-strong">{{ proc.memPct }}%</span>
              <span class="rf-proc-mem">{{ proc.mem }}</span>
            </div>
            <button
              class="rf-inline-btn danger"
              :disabled="killingPid === String(proc.pid)"
              @click="killProcess(proc)"
              :title="`Kill PID ${proc.pid}`"
            >
              {{ killingPid === String(proc.pid) ? '…' : '✕' }}
            </button>
          </div>
        </div>
      </article>

      <article class="rf-card rf-node-summary">
        <header class="rf-section-head">
          <div class="rf-section-head-left">
            <span class="rf-section-ic" style="background:var(--warning-soft);color:var(--warning)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </span>
            <div>
              <h3>System Actions</h3>
              <p>Kill &amp; restart controls</p>
            </div>
          </div>
        </header>
        <div class="rf-action-cards">
          <div class="rf-action-card danger-card">
            <div class="rf-action-card-head">
              <span class="rf-action-card-ic" style="background:var(--danger-soft);color:var(--danger)">⚠</span>
              <div>
                <strong>Kill All Node Process</strong>
                <p>Hentikan semua proses Node.js sekaligus, kecuali backend ini. GenieACS / Multi-Proxy akan otomatis di-restart oleh systemd.</p>
              </div>
            </div>
            <button class="rf-full-btn danger" :disabled="nodeKillBusy" @click="killAllNode">
              {{ nodeKillBusy ? 'Menghentikan semua Node…' : 'Kill Semua Node' }}
            </button>
          </div>
          <div class="rf-action-card ok-card">
            <div class="rf-action-card-head">
              <span class="rf-action-card-ic" style="background:var(--success-soft);color:var(--success)">⟳</span>
              <div>
                <strong>Rebuild Multi-Proxy</strong>
                <p>Jalankan ulang enable-multi-proxy.sh. Akan patch worker=1 dan restart semua service GenieACS.</p>
              </div>
            </div>
            <button class="rf-full-btn" :disabled="acsBusy" @click="runEnableMultiProxy">
              {{ acsBusy ? 'Running…' : 'Run enable-multi-proxy' }}
            </button>
          </div>
        </div>
      </article>
    </section>

    <!-- ═══ ACS Memory Limits ═══ -->
    <section>
      <article class="rf-card">
        <header class="rf-section-head">
          <div class="rf-section-head-left">
            <span class="rf-section-ic" style="background:var(--accent-soft);color:var(--accent)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
            </span>
            <div>
              <h3>Batas RAM GenieACS</h3>
              <p>NODE_OPTIONS heap cap &amp; systemd MemoryMax per service</p>
            </div>
          </div>
          <div class="rf-head-right">
            <button class="rf-inline-btn" :disabled="limitsBusy" @click="fetchAcsLimits">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg>
              {{ limitsBusy ? 'Memuat…' : 'Refresh' }}
            </button>
          </div>
        </header>

        <!-- Preset RAM tombol -->
        <div class="rf-preset-row">
          <span class="rf-preset-label">MODE:</span>
          <button class="rf-preset-btn" :class="{ active: activeMemPreset === 'low' }" :disabled="memApplyBusy" @click="applyMemPreset('low')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2v20M2 12h20"/></svg>
            Hemat <span>120 / 160 M</span>
          </button>
          <button class="rf-preset-btn" :class="{ active: activeMemPreset === 'bulk' }" :disabled="memApplyBusy" @click="applyMemPreset('bulk')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            Bulk 400 ONT <span>256 / 320 M</span>
          </button>
          <button class="rf-preset-btn" :class="{ active: activeMemPreset === 'high' }" :disabled="memApplyBusy" @click="applyMemPreset('high')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            High 800+ <span>320 / 448 M</span>
          </button>
          <span v-if="memApplyBusy" class="rf-preset-spinner"></span>
        </div>
        <div v-if="memApplyOk" class="rf-action-ok rf-preset-msg">{{ memApplyOk }}</div>
        <div v-if="memApplyErr" class="rf-action-err rf-preset-msg">{{ memApplyErr }}</div>

        <!-- Multi-proxy row -->
        <div v-if="acsLimits.multiProxy" class="rf-mp-row">
          <span class="dot" :class="acsLimits.multiProxy.active ? 'dot-success' : 'dot-muted'"></span>
          <div class="rf-list-info">
            <div class="rf-list-name">{{ acsLimits.multiProxy.name }}</div>
            <div class="rf-list-sub">
              <code v-if="acsLimits.multiProxy.nodeOptions">{{ acsLimits.multiProxy.nodeOptions }}</code>
              <span v-else>shared logo-proxy (1 process)</span>
            </div>
          </div>
          <div class="rf-mem-cell">
            <span class="rf-mem-cur">{{ acsLimits.multiProxy.memoryCurrent }}</span>
            <span class="rf-mem-max">/ {{ acsLimits.multiProxy.memoryMax }}</span>
          </div>
          <span class="badge" :class="acsLimits.multiProxy.memoryMaxRaw ? 'badge-success' : 'badge-warning'">
            {{ acsLimits.multiProxy.memoryMaxRaw ? 'Limit aktif' : 'Tanpa limit' }}
          </span>
        </div>

        <div v-if="limitsErr" class="rf-action-err">{{ limitsErr }}</div>
        <div v-if="!acsLimits.instances || !acsLimits.instances.length" class="rf-empty-row" style="margin-top:10px">
          <span v-if="limitsBusy"><span class="rf-spinner"></span> Memuat batas RAM…</span>
          <span v-else>Belum ada instance terdaftar.</span>
        </div>

        <!-- Per-instance groups -->
        <div v-for="inst in acsLimits.instances || []" :key="inst.name" class="rf-inst-group">
          <div class="rf-inst-head">
            <strong>{{ inst.name }}</strong>
            <code v-if="inst.nodeOptions" class="rf-inst-opts">{{ inst.nodeOptions }}</code>
            <code v-else class="rf-inst-opts muted">NODE_OPTIONS belum di-patch</code>
          </div>
          <div class="rf-svc-grid">
            <div v-for="svc in inst.services" :key="svc.name" class="rf-svc-cell">
              <div class="rf-svc-top">
                <span class="dot" :class="svc.active ? 'dot-success' : 'dot-muted'"></span>
                <span class="rf-svc-type">{{ svc.type }}</span>
                <span class="badge badge-sm" :class="svc.memoryMaxRaw ? 'badge-success' : 'badge-warning'">
                  {{ svc.memoryMaxRaw ? 'capped' : 'no cap' }}
                </span>
              </div>
              <div class="rf-svc-mem">
                <strong>{{ svc.memoryCurrent }}</strong>
                <span>/ {{ svc.memoryMax }}</span>
              </div>
              <div class="rf-svc-bar" v-if="svc.memoryMaxRaw">
                <div class="rf-svc-bar-fill" :style="`width:${memPctOf(svc)}%;background:${memBarColor(svc)}`"></div>
              </div>
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
const memProcs = ref([])
const cpuHistory = ref(Array(30).fill(0))
const netRxHistory = ref(Array(30).fill(0))
const netTxHistory = ref(Array(30).fill(0))
const autoRefresh = ref(true)
const acsBusy = ref(false)
const acsMsg = ref('')
const acsErr = ref('')
const killingPid = ref('')
const nodeKillBusy = ref(false)
const nodeKillMsg = ref('')
const nodeKillErr = ref('')
const acsLimits = ref({ instances: [], multiProxy: null })
const limitsBusy = ref(false)
const limitsErr = ref('')
const activeMemPreset = ref('bulk')
const memApplyBusy = ref(false)
const memApplyOk = ref('')
const memApplyErr = ref('')
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

function parseMemText(text) {
  const s = String(text || '').trim()
  const n = parseFloat(s)
  if (!n) return 0
  if (/GB/i.test(s)) return n * 1000
  if (/MB/i.test(s)) return n
  if (/KB/i.test(s)) return n / 1000
  return n
}
function memPctOf(svc) {
  const cur = parseMemText(svc.memoryCurrent)
  const max = parseMemText(svc.memoryMax)
  if (!cur || !max) return 0
  return Math.min(100, Math.round((cur / max) * 100))
}
function memBarColor(svc) {
  const p = memPctOf(svc)
  if (p > 85) return 'var(--danger)'
  if (p > 70) return 'var(--warning)'
  return 'var(--success)'
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

async function fetchMemProcs() {
  try { const res = await axios.get('/api/monitor/processes/memory'); memProcs.value = res.data }
  catch (e) { console.error(e) }
}

function detectLimitPreset(data) {
  const mpOpts = data.multiProxy?.nodeOptions || ''
  const heapM = mpOpts.match(/max-old-space-size=(\d+)/)
  const heap = parseInt(heapM?.[1] || '0')
  if (heap >= 300) return 'high'
  if (heap >= 240) return 'bulk'
  return 'low'
}

async function fetchAcsLimits() {
  limitsBusy.value = true
  limitsErr.value = ''
  try {
    const res = await axios.get('/api/monitor/acs/memory-limits')
    acsLimits.value = res.data || { instances: [], multiProxy: null }
    activeMemPreset.value = detectLimitPreset(acsLimits.value)
  } catch (e) {
    limitsErr.value = e.response?.data?.message || e.message
  } finally {
    limitsBusy.value = false
  }
}

async function applyMemPreset(key) {
  const labels = { low: 'Hemat', bulk: 'Bulk 400 ONT', high: 'High 800+' }
  if (!confirm(`Terapkan mode "${labels[key]}" ke SEMUA instance?\nIni akan restart semua service GenieACS.`)) return
  memApplyBusy.value = true
  memApplyOk.value = ''
  memApplyErr.value = ''
  try {
    const res = await axios.post('/api/monitor/acs/memory-limits/apply', { preset: key })
    memApplyOk.value = res.data?.message || 'Berhasil.'
    activeMemPreset.value = key
    await fetchAcsLimits()
  } catch (e) {
    memApplyErr.value = e.response?.data?.message || e.message
  } finally {
    memApplyBusy.value = false
    setTimeout(() => { memApplyOk.value = ''; memApplyErr.value = '' }, 15000)
  }
}

function startTimer() {
  if (timer) return
  timer = setInterval(async () => { await fetchStats(); await fetchProcs(); await fetchMemProcs(); await fetchAcsLimits() }, 3000)
}
function stopTimer() { clearInterval(timer); timer = null }
function toggleAuto() {
  autoRefresh.value = !autoRefresh.value
  autoRefresh.value ? startTimer() : stopTimer()
}

onMounted(async () => {
  await Promise.all([fetchStats(), fetchServices(), fetchProcs(), fetchMemProcs(), fetchAcsLimits()])
  if (autoRefresh.value) startTimer()
})
async function runEnableMultiProxy() {
  acsBusy.value = true
  acsMsg.value = ''
  acsErr.value = ''
  try {
    const res = await axios.post('/api/monitor/acs/enable-multi-proxy')
    acsMsg.value = res.data.message || 'Berhasil.'
  } catch (e) {
    acsErr.value = e.response?.data?.message || e.message
  } finally {
    acsBusy.value = false
    setTimeout(() => { acsMsg.value = ''; acsErr.value = '' }, 12000)
    await fetchServices()
    await fetchProcs()
    await fetchMemProcs()
    await fetchAcsLimits()
  }
}

async function killProcess(proc) {
  if (!confirm(`Kill proses ${proc.name} (PID ${proc.pid})?`)) return
  killingPid.value = String(proc.pid)
  try {
    await axios.post(`/api/monitor/processes/${proc.pid}/kill`, { force: true })
  } catch (e) {
    console.error(e)
  } finally {
    killingPid.value = ''
    await fetchProcs()
    await fetchMemProcs()
    await fetchAcsLimits()
  }
}

async function killAllNode() {
  if (!confirm('Kill SEMUA proses node sekarang?')) return
  nodeKillBusy.value = true
  nodeKillMsg.value = ''
  nodeKillErr.value = ''
  try {
    const res = await axios.post('/api/monitor/processes/kill-node')
    nodeKillMsg.value = res.data?.message || 'Semua proses node dihentikan.'
  } catch (e) {
    nodeKillErr.value = e.response?.data?.message || e.message
  } finally {
    nodeKillBusy.value = false
    setTimeout(() => { nodeKillMsg.value = ''; nodeKillErr.value = '' }, 12000)
    await fetchServices()
    await fetchProcs()
    await fetchMemProcs()
    await fetchAcsLimits()
  }
}

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
.rf-head-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.rf-inline-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all .15s;
}
.rf-inline-btn:hover:not(:disabled) { background: var(--accent-soft); color: var(--accent); border-color: var(--accent); }
.rf-inline-btn:disabled { opacity: .55; cursor: not-allowed; }
.rf-inline-btn.danger { border-color: var(--danger); color: var(--danger); }
.rf-inline-btn.danger:hover:not(:disabled) { background: var(--danger-soft); }
.rf-action-ok, .rf-action-err {
  padding: 9px 20px;
  font-size: 11.5px;
}
.rf-action-ok {
  color: var(--success);
  background: var(--success-soft);
  border-bottom: 1px solid var(--border);
}
.rf-action-err {
  color: var(--danger);
  background: var(--danger-soft);
  border-bottom: 1px solid var(--border);
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
.rf-proc-mem-strong {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--danger);
}

/* ─── Action cards (system panel) ─── */
.rf-action-cards {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 20px;
}
.rf-action-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  background: var(--bg-elevated);
}
.rf-action-card-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 14px;
}
.rf-action-card-ic {
  width: 32px; height: 32px;
  min-width: 32px;
  border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 16px;
  font-weight: 700;
}
.rf-action-card-head strong {
  display: block;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 3px;
}
.rf-action-card-head p {
  font-size: 11.5px;
  color: var(--text-muted);
  line-height: 1.45;
}
.rf-full-btn {
  width: 100%;
  padding: 10px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all .15s;
  text-align: center;
}
.rf-full-btn:hover:not(:disabled) { background: var(--accent-soft); color: var(--accent); border-color: var(--accent); }
.rf-full-btn:disabled { opacity: .55; cursor: not-allowed; }
.rf-full-btn.danger { border-color: var(--danger); color: var(--danger); background: var(--danger-soft); }
.rf-full-btn.danger:hover:not(:disabled) { background: var(--danger); color: #fff; }

/* ─── ACS Memory Preset bar ─── */
.rf-preset-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--bg-elevated);
  flex-wrap: wrap;
}
.rf-preset-label {
  font-size: 10.5px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: .06em;
  margin-right: 4px;
  white-space: nowrap;
}
.rf-preset-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 13px;
  border-radius: 8px;
  border: 1.5px solid var(--border);
  background: var(--bg-surface);
  color: var(--text-primary);
  font-size: 11.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all .15s;
  white-space: nowrap;
  line-height: 1.3;
}
.rf-preset-btn span {
  font-weight: 600;
  font-size: 10px;
  color: var(--text-muted);
  font-family: 'JetBrains Mono', monospace;
}
.rf-preset-btn:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}
.rf-preset-btn:hover:not(:disabled) span {
  color: var(--accent);
}
.rf-preset-btn.active {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
  box-shadow: 0 0 0 2px rgba(99,102,241,.18);
}
.rf-preset-btn.active span {
  color: rgba(255,255,255,.8);
}
.rf-preset-btn:disabled { opacity: .55; cursor: not-allowed; }
.rf-preset-spinner {
  display: inline-block;
  width: 14px; height: 14px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: rf-spin .6s linear infinite;
}
@keyframes rf-spin { to { transform: rotate(360deg); } }
.rf-preset-msg {
  border-radius: 0 0 0 0;
}

/* ─── ACS Memory Limits ─── */
.rf-mp-row {
  display: flex; align-items: center; gap: 12px;
  padding: 14px 20px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  border-radius: 14px 14px 0 0;
}
.rf-mem-cell {
  display: flex; align-items: baseline; gap: 4px;
  margin-left: auto;
  font-family: 'JetBrains Mono', monospace;
}
.rf-mem-cur { font-weight: 700; font-size: 13px; color: var(--info); }
.rf-mem-max { font-size: 11.5px; color: var(--text-muted); }

.rf-inst-group {
  border-bottom: 1px solid var(--border);
}
.rf-inst-group:last-child { border-bottom: none; }
.rf-inst-head {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 20px;
  background: rgba(99,102,241,.04);
  border-bottom: 1px solid var(--border);
}
.rf-inst-head strong {
  font-size: 13px; color: var(--text-primary); font-weight: 700;
}
.rf-inst-opts.muted { color: var(--text-muted); font-size: 11px; }
.rf-inst-opts:not(.muted) {
  font-size: 11px;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 2px 8px;
  border-radius: 999px;
}
.rf-svc-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
}
@media (max-width: 900px) { .rf-svc-grid { grid-template-columns: repeat(2, 1fr); } }
.rf-svc-cell {
  padding: 12px 18px;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.rf-svc-cell:nth-child(4n) { border-right: none; }
@media (max-width: 900px) {
  .rf-svc-cell:nth-child(4n) { border-right: 1px solid var(--border); }
  .rf-svc-cell:nth-child(2n) { border-right: none; }
}
.rf-svc-top {
  display: flex; align-items: center; gap: 6px;
}
.rf-svc-type {
  font-size: 12px; font-weight: 700; color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: .02em;
}
.badge.sm, .badge-sm { font-size: 9.5px; padding: 2px 6px; }
.rf-svc-mem {
  display: flex; align-items: baseline; gap: 4px;
  font-family: 'JetBrains Mono', monospace;
}
.rf-svc-mem strong { font-size: 13px; color: var(--info); }
.rf-svc-mem span  { font-size: 11px; color: var(--text-muted); }
.rf-svc-bar {
  height: 4px;
  background: var(--bg-elevated);
  border-radius: 999px;
  overflow: hidden;
}
.rf-svc-bar-fill {
  height: 100%;
  border-radius: 999px;
  min-width: 3px;
  transition: width .4s ease;
}
</style>
