<template>
  <div class="rf-vpn">

    <!-- ═══ Status overview ═══ -->
    <section class="rf-vpn-status">
      <article class="rf-status-card rf-card rf-card-hover">
        <div class="rf-status-ic" style="background:var(--info-soft);color:var(--info)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        </div>
        <div class="rf-status-body">
          <div class="rf-status-label">Server IP</div>
          <div class="rf-status-value">{{ status.server_ip || '—' }}</div>
        </div>
      </article>

      <article class="rf-status-card rf-card rf-card-hover" :class="{ 'is-active': tab === 'l2tp' }" @click="tab = 'l2tp'">
        <div class="rf-status-ic" style="background:var(--purple-soft);color:var(--purple)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <div class="rf-status-body">
          <div class="rf-status-label">L2TP / IPsec</div>
          <div class="rf-status-row">
            <span class="dot" :class="status.l2tp?.running ? 'dot-success' : 'dot-muted'"></span>
            <span class="rf-status-state" :style="status.l2tp?.running ? 'color:var(--success)' : 'color:var(--text-muted)'">
              {{ status.l2tp?.running ? 'Running' : 'Not installed' }}
            </span>
          </div>
          <div class="rf-status-meta">{{ l2tpUsers.length }} users · UDP 500/4500/1701</div>
        </div>
      </article>

      <article class="rf-status-card rf-card rf-card-hover" :class="{ 'is-active': tab === 'wireguard' }" @click="tab = 'wireguard'">
        <div class="rf-status-ic" style="background:var(--success-soft);color:var(--success)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
        </div>
        <div class="rf-status-body">
          <div class="rf-status-label">WireGuard</div>
          <div class="rf-status-row">
            <span class="dot" :class="status.wireguard?.running ? 'dot-success' : 'dot-muted'"></span>
            <span class="rf-status-state" :style="status.wireguard?.running ? 'color:var(--success)' : 'color:var(--text-muted)'">
              {{ status.wireguard?.running ? 'Running' : 'Not installed' }}
            </span>
          </div>
          <div class="rf-status-meta">{{ wgPeers.length }} peers · UDP {{ wgConfig.port || 51820 }}</div>
        </div>
      </article>

      <article class="rf-status-card rf-card">
        <div class="rf-status-ic" style="background:var(--warning-soft);color:var(--warning)">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="9" width="20" height="12" rx="2"/><path d="M12 9V5M8 9V7M16 9V7"/><circle cx="7" cy="15" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="15" r="1" fill="currentColor" stroke="none"/></svg>
        </div>
        <div class="rf-status-body">
          <div class="rf-status-label">MikroTik</div>
          <div class="rf-status-value" style="font-size:14px">Config siap export</div>
          <div class="rf-status-meta">L2TP: all RouterOS · WG: 7+</div>
        </div>
      </article>
    </section>

    <!-- ═══ Tabs ═══ -->
    <div class="rf-tabs">
      <button v-for="t in tabs" :key="t.id" @click="tab = t.id" class="rf-tab" :class="{ 'is-active': tab === t.id }">
        <span class="rf-tab-ic" v-html="t.icon"></span>
        <span>{{ t.label }}</span>
        <span class="rf-tab-count">{{ t.count }}</span>
      </button>
    </div>

    <!-- ═══ L2TP TAB ═══ -->
    <div v-if="tab === 'l2tp'" class="rf-section">
      <article class="rf-card rf-section-tool">
        <div class="rf-section-tool-left">
          <div v-if="l2tpConfig.psk" class="rf-key-line">
            <span class="rf-key-label">PSK:</span>
            <code class="rf-key-val">{{ showPSK ? l2tpConfig.psk : '••••••••••••' }}</code>
            <button class="btn-ghost rf-eye" @click="showPSK = !showPSK">
              <svg v-if="!showPSK" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            </button>
            <button class="btn-ghost" @click="copyText(l2tpConfig.psk)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy
            </button>
          </div>
        </div>
        <div class="rf-section-tool-right">
          <button v-if="!status.l2tp?.running" @click="openInstallL2tp = true" class="btn-secondary">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            Install L2TP
          </button>
          <button @click="openPoolModal('l2tp')" class="btn-secondary" title="Atur IP Pool L2TP">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            IP Pool
          </button>
          <button @click="openAddL2tp = true" class="btn-primary">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add User
          </button>
        </div>
      </article>

      <article class="rf-card">
        <div class="rf-table-wrap">
          <table class="rf-table">
            <thead>
              <tr>
                <th>MikroTik / User</th>
                <th>Password</th>
                <th>Instance</th>
                <th>Speed Limit</th>
                <th>Traffic</th>
                <th>Status</th>
                <th style="text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loadingL2tp">
                <td colspan="7"><div class="rf-empty"><div class="rf-spinner"></div><span>Memuat user…</span></div></td>
              </tr>
              <tr v-else-if="l2tpUsers.length === 0">
                <td colspan="7">
                  <div class="rf-empty">
                    <div class="rf-empty-ic">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    </div>
                    <p class="rf-empty-title">Belum ada user L2TP</p>
                    <p class="rf-empty-sub">Tambah user untuk tiap MikroTik yang terhubung.</p>
                  </div>
                </td>
              </tr>
              <tr v-for="user in pagedL2tpUsers" :key="user.username">
                <td>
                  <div class="rf-cell-user">
                    <div class="avatar" style="width:34px;height:34px;font-size:13px"
                      :style="user.connected ? 'background:linear-gradient(135deg,#a974ff,#8b5cf6)' : 'background:linear-gradient(135deg,#5d6588,#414866)'">
                      {{ user.username.charAt(0).toUpperCase() }}
                    </div>
                    <div>
                      <div class="rf-cell-name">{{ user.username }}</div>
                      <div class="rf-cell-sub">{{ user.note || 'MikroTik L2TP' }}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div class="rf-pass-row">
                    <code class="rf-pass">{{ visiblePass === user.username ? user.password : '••••••••' }}</code>
                    <button class="btn-ghost" @click="visiblePass = visiblePass === user.username ? '' : user.username">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                  </div>
                </td>
                <td>
                  <span v-if="user.instance" class="badge badge-info">{{ user.instance }}</span>
                  <span v-else class="rf-cell-sub">—</span>
                </td>
                <td>
                  <div v-if="user.rate_down || user.rate_up" class="rf-speed-badge">
                    <span class="rf-speed-dn">↓{{ user.rate_down || '∞' }}M</span>
                    <span class="rf-speed-up">↑{{ user.rate_up || '∞' }}M</span>
                  </div>
                  <span v-else class="rf-cell-sub">Unlimited</span>
                </td>
                <td>
                  <div class="rf-traffic-cell" @click="openTrafficModal('l2tp', user.username)" title="Lihat grafik traffic">
                    <TrafficSparkline :history="trafficHistory.l2tp[user.username] || []" />
                    <div class="rf-traffic-nums" v-if="trafficHistory.l2tp[user.username]?.length">
                      <span class="rf-dn">↓{{ formatBytes(lastTrafficRate('l2tp', user.username, 'rx')) }}/s</span>
                      <span class="rf-up">↑{{ formatBytes(lastTrafficRate('l2tp', user.username, 'tx')) }}/s</span>
                    </div>
                    <span v-else class="rf-cell-sub">—</span>
                  </div>
                </td>
                <td>
                  <span v-if="user.disabled" class="badge badge-muted" title="VPN dinonaktifkan">
                    <span class="dot dot-muted"></span>Disabled
                  </span>
                  <span v-else class="badge" :class="user.connected ? 'badge-success' : 'badge-muted'">
                    <span class="dot" :class="user.connected ? 'dot-success' : 'dot-muted'"></span>
                    {{ user.connected ? 'Connected' : 'Idle' }}
                  </span>
                  <div v-if="user.lan_subnet || user.ont_ip" class="rf-ont-status">
                    <span v-if="ontStatusFor('l2tp', user.username)?.ont_reachable" class="badge badge-success" title="GenieACS bisa ping ONT">
                      <span class="dot dot-success"></span>ONT online<template v-if="ontStatusFor('l2tp', user.username)?.ont_rtt_ms != null"> · {{ ontStatusFor('l2tp', user.username).ont_rtt_ms }}ms</template>
                    </span>
                    <span v-else class="badge badge-muted" :title="user.ont_ip ? ('Ping ' + user.ont_ip) : 'Subnet: ' + user.lan_subnet">
                      <span class="dot dot-muted"></span>ONT unreachable
                    </span>
                    <div v-if="user.lan_subnet" class="rf-cell-sub" style="margin-top:2px">net {{ user.lan_subnet }}</div>
                  </div>
                </td>
                <td style="text-align:right">
                  <div class="rf-actions">
                    <button class="rf-act rf-act-warning" @click="showMikrotikConfig('l2tp', user.username)">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                      ROS Config
                    </button>
                    <button class="rf-act rf-act-info" @click="openEdit(user, 'l2tp')" title="Edit VPN">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit
                    </button>
                    <button class="rf-act rf-act-info" @click="openLimitModal({...user, name: user.username, peer_ip: '—'}, 'l2tp')" title="Set Speed Limit">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="4"/></svg>
                      Limit
                    </button>
                    <button class="rf-act" :class="user.disabled ? 'rf-act-success' : 'rf-act-muted'" :disabled="togglingState === user.username" @click="toggleState(user, 'l2tp')" :title="user.disabled ? 'Aktifkan VPN' : 'Nonaktifkan VPN'">
                      <svg v-if="user.disabled" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                      {{ user.disabled ? 'Enable' : 'Disable' }}
                    </button>
                    <button class="rf-act rf-act-danger" @click="deleteL2tpUser(user.username)">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- L2TP Pagination -->
        <div v-if="l2tpUsers.length > l2tpPageSize" class="rf-pagination">
          <button class="rf-page-btn" :disabled="l2tpPage <= 1" @click="setL2tpPage(1)" title="First">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M11 17l-5-5 5-5v10zM18 17l-5-5 5-5v10z"/></svg>
          </button>
          <button class="rf-page-btn" :disabled="l2tpPage <= 1" @click="setL2tpPage(l2tpPage - 1)" title="Prev">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M14 17l-5-5 5-5v10z"/></svg>
          </button>
          <template v-for="p in l2tpPaginationPages" :key="p">
            <span v-if="p === '...'" class="rf-page-dots">…</span>
            <button v-else class="rf-page-btn rf-page-num" :class="{ active: p === l2tpPage }" @click="setL2tpPage(p)">{{ p }}</button>
          </template>
          <button class="rf-page-btn" :disabled="l2tpPage >= l2tpTotalPages" @click="setL2tpPage(l2tpPage + 1)" title="Next">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M10 7l5 5-5 5V7z"/></svg>
          </button>
          <button class="rf-page-btn" :disabled="l2tpPage >= l2tpTotalPages" @click="setL2tpPage(l2tpTotalPages)" title="Last">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M13 17l5-5-5-5v10zM6 17l5-5-5-5v10z"/></svg>
          </button>
          <span class="rf-page-info">{{ l2tpUsers.length }} total · {{ (l2tpPage-1)*l2tpPageSize + 1 }}–{{ Math.min(l2tpPage*l2tpPageSize, l2tpUsers.length) }}</span>
        </div>
      </article>
    </div>

    <!-- ═══ WIREGUARD TAB ═══ -->
    <div v-if="tab === 'wireguard'" class="rf-section">
      <article class="rf-card rf-section-tool">
        <div class="rf-section-tool-left">
          <div v-if="wgConfig.server_pubkey" class="rf-key-line">
            <span class="rf-key-label">Server Key:</span>
            <code class="rf-key-val rf-key-truncate">{{ wgConfig.server_pubkey }}</code>
            <button class="btn-ghost" @click="copyText(wgConfig.server_pubkey)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copy
            </button>
          </div>
          <div class="rf-key-meta">UDP {{ wgConfig.port || 51820 }} · {{ wgConfig.subnet || '10.8.1.0/24' }}</div>
        </div>
        <div class="rf-section-tool-right">
          <button v-if="!status.wireguard?.running" @click="openInstallWg = true" class="btn-secondary">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            Install WireGuard
          </button>
          <button @click="openPoolModal('wireguard')" class="btn-secondary" title="Atur IP Pool WireGuard">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            IP Pool
          </button>
          <button @click="openAddWg = true" class="btn-primary">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Peer
          </button>
        </div>
      </article>

      <article class="rf-card">
        <div class="rf-table-wrap">
          <table class="rf-table">
            <thead>
              <tr>
                <th>MikroTik / Peer</th>
                <th>VPN IP</th>
                <th>Public Key</th>
                <th>Instance</th>
                <th>Speed Limit</th>
                <th>Traffic</th>
                <th>Status</th>
                <th style="text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loadingWg">
                <td colspan="8"><div class="rf-empty"><div class="rf-spinner"></div><span>Memuat peers…</span></div></td>
              </tr>
              <tr v-else-if="wgPeers.length === 0">
                <td colspan="8">
                  <div class="rf-empty">
                    <div class="rf-empty-ic">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                    </div>
                    <p class="rf-empty-title">Belum ada WireGuard peer</p>
                    <p class="rf-empty-sub">Butuh RouterOS 7.x — performanya lebih kencang dari L2TP.</p>
                  </div>
                </td>
              </tr>
              <tr v-for="peer in pagedWgPeers" :key="peer.name">
                <td>
                  <div class="rf-cell-user">
                    <div class="avatar" style="width:34px;height:34px;font-size:13px"
                      :style="peer.connected ? 'background:linear-gradient(135deg,#1abc9c,#16a085)' : 'background:linear-gradient(135deg,#5d6588,#414866)'">
                      {{ peer.name.charAt(0).toUpperCase() }}
                    </div>
                    <div>
                      <div class="rf-cell-name">{{ peer.name }}</div>
                      <div class="rf-cell-sub">{{ peer.note || 'WireGuard peer' }}</div>
                    </div>
                  </div>
                </td>
                <td><code class="rf-pass" style="color:var(--info)">{{ peer.peer_ip }}</code></td>
                <td><code class="rf-pass">{{ peer.pubkey?.slice(0, 18) }}…</code></td>
                <td>
                  <span v-if="peer.instance" class="badge badge-info">{{ peer.instance }}</span>
                  <span v-else class="rf-cell-sub">—</span>
                </td>
                <td>
                  <div v-if="peer.rate_down || peer.rate_up" class="rf-speed-badge">
                    <span class="rf-speed-dn" title="Download limit">↓{{ peer.rate_down || '∞' }}M</span>
                    <span class="rf-speed-up" title="Upload limit">↑{{ peer.rate_up || '∞' }}M</span>
                  </div>
                  <span v-else class="rf-cell-sub">Unlimited</span>
                </td>
                <td>
                  <div class="rf-traffic-cell" @click="openTrafficModal('wg', peer.name)" title="Lihat grafik traffic">
                    <TrafficSparkline :history="trafficHistory.wg[peer.name] || []" />
                    <div class="rf-traffic-nums" v-if="trafficHistory.wg[peer.name]?.length">
                      <span class="rf-dn">↓{{ formatBytes(lastTrafficRate('wg', peer.name, 'rx')) }}/s</span>
                      <span class="rf-up">↑{{ formatBytes(lastTrafficRate('wg', peer.name, 'tx')) }}/s</span>
                    </div>
                    <span v-else class="rf-cell-sub">—</span>
                  </div>
                </td>
                <td>
                  <span v-if="peer.disabled" class="badge badge-muted" title="VPN dinonaktifkan">
                    <span class="dot dot-muted"></span>Disabled
                  </span>
                  <span v-else class="badge" :class="peer.connected ? 'badge-success' : 'badge-muted'">
                    <span class="dot" :class="peer.connected ? 'dot-success' : 'dot-muted'"></span>
                    {{ peer.connected ? 'Connected' : 'Idle' }}
                  </span>
                  <div v-if="peer.lan_subnet || peer.ont_ip" class="rf-ont-status">
                    <span v-if="ontStatusFor('wg', peer.name)?.ont_reachable" class="badge badge-success" title="GenieACS bisa ping ONT">
                      <span class="dot dot-success"></span>ONT online<template v-if="ontStatusFor('wg', peer.name)?.ont_rtt_ms != null"> · {{ ontStatusFor('wg', peer.name).ont_rtt_ms }}ms</template>
                    </span>
                    <span v-else class="badge badge-muted" :title="peer.ont_ip ? ('Ping ' + peer.ont_ip) : 'Subnet: ' + peer.lan_subnet">
                      <span class="dot dot-muted"></span>ONT unreachable
                    </span>
                    <div v-if="peer.lan_subnet" class="rf-cell-sub" style="margin-top:2px">net {{ peer.lan_subnet }}</div>
                  </div>
                </td>
                <td style="text-align:right">
                  <div class="rf-actions">
                    <button class="rf-act rf-act-warning" @click="showMikrotikConfig('wg', peer.name)">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                      ROS Config
                    </button>
                    <button class="rf-act rf-act-info" @click="openEdit(peer, 'wg')" title="Edit VPN">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit
                    </button>
                    <button class="rf-act rf-act-info" @click="openLimitModal(peer)" title="Set Speed Limit">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="4"/></svg>
                      Limit
                    </button>
                    <button class="rf-act" :class="peer.disabled ? 'rf-act-success' : 'rf-act-muted'" :disabled="togglingState === peer.name" @click="toggleState(peer, 'wg')" :title="peer.disabled ? 'Aktifkan VPN' : 'Nonaktifkan VPN'">
                      <svg v-if="peer.disabled" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                      <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                      {{ peer.disabled ? 'Enable' : 'Disable' }}
                    </button>
                    <button class="rf-act rf-act-danger" @click="deleteWgPeer(peer.name)">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- WireGuard Pagination -->
        <div v-if="wgPeers.length > wgPageSize" class="rf-pagination">
          <button class="rf-page-btn" :disabled="wgPage <= 1" @click="setWgPage(1)" title="First">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M11 17l-5-5 5-5v10zM18 17l-5-5 5-5v10z"/></svg>
          </button>
          <button class="rf-page-btn" :disabled="wgPage <= 1" @click="setWgPage(wgPage - 1)" title="Prev">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M14 17l-5-5 5-5v10z"/></svg>
          </button>
          <template v-for="p in wgPaginationPages" :key="p">
            <span v-if="p === '...'" class="rf-page-dots">…</span>
            <button v-else class="rf-page-btn rf-page-num" :class="{ active: p === wgPage }" @click="setWgPage(p)">{{ p }}</button>
          </template>
          <button class="rf-page-btn" :disabled="wgPage >= wgTotalPages" @click="setWgPage(wgPage + 1)" title="Next">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M10 7l5 5-5 5V7z"/></svg>
          </button>
          <button class="rf-page-btn" :disabled="wgPage >= wgTotalPages" @click="setWgPage(wgTotalPages)" title="Last">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M13 17l5-5-5-5v10zM6 17l5-5-5-5v10z"/></svg>
          </button>
          <span class="rf-page-info">{{ wgPeers.length }} total · {{ (wgPage-1)*wgPageSize + 1 }}–{{ Math.min(wgPage*wgPageSize, wgPeers.length) }}</span>
        </div>
      </article>
    </div>

    <!-- ═══ Tab: Static Route ═══ -->
    <div v-if="tab === 'routes'" class="rf-section">
      <article class="rf-card rf-section-tool">
        <div class="rf-section-tool-left">
          <div class="rf-key-meta">
            Routing manual subnet ONT lewat tunnel VPN — agar server GenieACS bisa ping / akses
            perangkat di belakang router pelanggan.
          </div>
        </div>
        <div class="rf-section-tool-right">
          <button @click="openAddRouteModal" class="btn-primary">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Route
          </button>
        </div>
      </article>

      <article class="rf-card">
        <div class="rf-table-wrap">
          <table class="rf-table">
            <thead>
              <tr>
                <th>Subnet Tujuan (ONT)</th>
                <th>Gateway VPN</th>
                <th>Catatan</th>
                <th>Status</th>
                <th style="text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="staticRoutes.length === 0">
                <td colspan="5">
                  <div class="rf-empty">
                    <div class="rf-empty-ic">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M6 16V9a4 4 0 0 1 4-4h4"/><path d="M18 8v7a4 4 0 0 1-4 4h-4"/></svg>
                    </div>
                    <p class="rf-empty-title">Belum ada static route</p>
                    <p class="rf-empty-sub">Daftarkan subnet ONT (mis. 192.168.1.0/24) via IP VPN MikroTik agar GenieACS bisa menjangkaunya.</p>
                  </div>
                </td>
              </tr>
              <tr v-for="r in staticRoutes" :key="r.id">
                <td><code class="rf-pass" style="color:var(--info)">{{ r.subnet }}</code></td>
                <td>
                  <code class="rf-pass">{{ r.gateway }}</code>
                  <span class="rf-cell-sub">{{ r.gateway_type === 'dev' ? '(interface)' : '(via)' }}</span>
                </td>
                <td><span class="rf-cell-sub">{{ r.note || '—' }}</span></td>
                <td>
                  <span v-if="r.enabled === false" class="badge badge-muted">Nonaktif</span>
                  <span v-else-if="r.active === false" class="badge badge-warning" title="Belum terpasang di kernel">Pending</span>
                  <span v-else class="badge badge-success">Aktif</span>
                </td>
                <td style="text-align:right">
                  <button class="btn-ghost" @click="pingRouteGateway(r)">Ping GW</button>
                  <button class="btn-ghost" :disabled="togglingRoute === r.id" @click="toggleRoute(r)">
                    {{ r.enabled === false ? 'Aktifkan' : 'Nonaktifkan' }}
                  </button>
                  <button class="btn-ghost rf-act-danger" @click="deleteRoute(r)">Hapus</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article class="rf-card rf-terminal-card">
        <div class="rf-terminal-head">
          <div>
            <h3>Ping Check & Terminal Diagnostik</h3>
            <p>Tes ping, route table, dan status WireGuard langsung dari server VPN.</p>
          </div>
          <button class="btn-secondary" :disabled="terminalLoading" @click="runTerminalCommand">
            <span v-if="terminalLoading" class="rf-spinner" style="width:14px;height:14px;border-width:2px"></span>
            Run
          </button>
        </div>
        <div class="rf-form-row">
          <div class="rf-form-field">
            <label>Command</label>
            <select v-model="terminalForm.command">
              <option value="ping">ping target</option>
              <option value="tracepath">tracepath target</option>
              <option value="route">ip route show</option>
              <option value="wg">wg show</option>
              <option value="wg-peer">wg show peer by VPN IP</option>
              <option value="ip-neigh">ip neigh show</option>
            </select>
          </div>
          <div class="rf-form-field">
            <label>Target IP</label>
            <input v-model="terminalForm.target" type="text" placeholder="10.130.130.1 / 10.8.1.2" :disabled="['route','wg','ip-neigh'].includes(terminalForm.command)" />
          </div>
        </div>
        <pre class="rf-terminal-output">{{ terminalOutput || 'Output command akan tampil di sini…' }}</pre>
      </article>
    </div>

    <!-- ═══ Modal: Install L2TP ═══ -->
    <Transition name="modal">
      <div v-if="openInstallL2tp" class="rf-modal" @click.self="openInstallL2tp = false">
        <div class="modal-box rf-modal-card">
          <header class="rf-modal-head">
            <div class="rf-modal-head-left">
              <span class="rf-modal-icon" style="background:var(--purple-soft);color:var(--purple)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </span>
              <div>
                <h3>Install L2TP / IPsec</h3>
                <p>strongswan + xl2tpd · UDP 500/4500/1701</p>
              </div>
            </div>
            <button @click="openInstallL2tp = false" class="rf-modal-close">×</button>
          </header>
          <div class="rf-modal-body">
            <div class="rf-info-box">
              <div>📦 Package: <code>strongswan</code> + <code>xl2tpd</code></div>
              <div>🔑 PSK auto-generate jika kosong</div>
              <div style="color:var(--warning)">⚠ Butuh root / sudo di server</div>
            </div>
            <div class="rf-form-field">
              <label>Custom PSK <span class="rf-form-hint-inline">opsional, min 8 karakter</span></label>
              <input v-model="installL2tpForm.psk" type="text" placeholder="Kosongkan untuk auto-generate" />
            </div>
          </div>
          <footer class="rf-modal-foot">
            <button @click="openInstallL2tp = false" class="btn-secondary">Cancel</button>
            <button @click="installL2tp" :disabled="installing" class="btn-primary">
              <span v-if="installing" class="rf-spinner" style="width:14px;height:14px;border-width:2px"></span>
              {{ installing ? 'Installing…' : 'Install' }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>

    <!-- ═══ Modal: Add L2TP User ═══ -->
    <Transition name="modal">
      <div v-if="openAddL2tp" class="rf-modal" @click.self="openAddL2tp = false">
        <div class="modal-box rf-modal-card">
          <header class="rf-modal-head">
            <div class="rf-modal-head-left">
              <span class="rf-modal-icon" style="background:var(--accent-soft);color:var(--accent)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </span>
              <div>
                <h3>Add L2TP User</h3>
                <p>Buat user untuk MikroTik yang akan dial in.</p>
              </div>
            </div>
            <button @click="openAddL2tp = false" class="rf-modal-close">×</button>
          </header>
          <div class="rf-modal-body">
            <Transition name="slide">
              <div v-if="addError" class="rf-alert">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
                <span>{{ addError }}</span>
              </div>
            </Transition>
            <div class="rf-form-row">
              <div class="rf-form-field">
                <label>Username</label>
                <input v-model="addL2tpForm.username" type="text" placeholder="mikrotik-site1" />
              </div>
              <div class="rf-form-field">
                <label>Password</label>
                <div class="rf-input-group">
                  <input v-model="addL2tpForm.password" type="text" placeholder="auto-generate" />
                  <button class="btn-secondary rf-gen" @click="addL2tpForm.password = genPass()" title="Generate">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/></svg>
                  </button>
                </div>
              </div>
            </div>
            <div class="rf-form-field">
              <label class="rf-switch-row">
                <input type="checkbox" v-model="addL2tpForm.personal" />
                <span>Mode Pribadi <span class="rf-form-hint-inline">VPN personal, tanpa instance/ONT</span></span>
              </label>
            </div>
            <div class="rf-form-field" v-if="!addL2tpForm.personal">
              <label>GenieACS Instance <span class="rf-form-hint-inline">opsional</span></label>
              <select v-model="addL2tpForm.instance">
                <option value="">— Pilih instance —</option>
                <option v-for="inst in instanceList" :key="inst.name" :value="inst.name">{{ inst.name }}</option>
              </select>
            </div>
            <div class="rf-form-field">
              <label>Versi RouterOS</label>
              <select v-model="addL2tpForm.ros_version">
                <option value="7">RouterOS 7.x</option>
                <option value="6">RouterOS 6.x (L2TP saja)</option>
              </select>
              <span class="rf-form-hint-inline">Script dial-in disesuaikan dengan versi ROS.</span>
            </div>
            <div class="rf-form-row" v-if="!addL2tpForm.personal">
              <div class="rf-form-field">
                <label>IP Block ONT <span class="rf-form-hint-inline">opsional</span></label>
                <input v-model="addL2tpForm.lan_subnet" type="text" placeholder="192.168.100.0/24" />
                <span class="rf-form-hint-inline">Subnet LAN di belakang router; di-route ke GenieACS lewat tunnel.</span>
              </div>
              <div class="rf-form-field">
                <label>IP Manajemen ONT <span class="rf-form-hint-inline">opsional</span></label>
                <input v-model="addL2tpForm.ont_ip" type="text" placeholder="192.168.100.2" />
                <span class="rf-form-hint-inline">IP yang akan di-ping untuk cek status.</span>
              </div>
            </div>
            <div class="rf-form-field">
              <label>Catatan <span class="rf-form-hint-inline">opsional</span></label>
              <input v-model="addL2tpForm.note" type="text" placeholder="Lokasi / nama pelanggan" />
            </div>
          </div>
          <footer class="rf-modal-foot">
            <button @click="openAddL2tp = false" class="btn-secondary">Cancel</button>
            <button @click="addL2tpUser" :disabled="addLoading" class="btn-primary">
              <span v-if="addLoading" class="rf-spinner" style="width:14px;height:14px;border-width:2px"></span>
              {{ addLoading ? 'Creating…' : 'Create User' }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>

    <!-- ═══ Modal: Install WG ═══ -->
    <Transition name="modal">
      <div v-if="openInstallWg" class="rf-modal" @click.self="openInstallWg = false">
        <div class="modal-box rf-modal-card">
          <header class="rf-modal-head">
            <div class="rf-modal-head-left">
              <span class="rf-modal-icon" style="background:var(--success-soft);color:var(--success)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4"/></svg>
              </span>
              <div>
                <h3>Install WireGuard</h3>
                <p>Modern, fast VPN. RouterOS 7+ required.</p>
              </div>
            </div>
            <button @click="openInstallWg = false" class="rf-modal-close">×</button>
          </header>
          <div class="rf-modal-body">
            <div class="rf-info-box">
              <div>📦 Package: <code>wireguard-tools</code></div>
              <div>⚡ Lebih cepat dari L2TP</div>
              <div style="color:var(--warning)">⚠ Butuh root / sudo</div>
            </div>
            <div class="rf-form-field">
              <label>Listen Port</label>
              <input v-model.number="installWgForm.port" type="number" placeholder="51820" />
            </div>
          </div>
          <footer class="rf-modal-foot">
            <button @click="openInstallWg = false" class="btn-secondary">Cancel</button>
            <button @click="installWg" :disabled="installing" class="btn-primary">
              <span v-if="installing" class="rf-spinner" style="width:14px;height:14px;border-width:2px"></span>
              {{ installing ? 'Installing…' : 'Install' }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>

    <!-- ═══ Modal: Add WG Peer ═══ -->
    <Transition name="modal">
      <div v-if="openAddWg" class="rf-modal" @click.self="openAddWg = false">
        <div class="modal-box rf-modal-card">
          <header class="rf-modal-head">
            <div class="rf-modal-head-left">
              <span class="rf-modal-icon" style="background:var(--accent-soft);color:var(--accent)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </span>
              <div>
                <h3>Add WireGuard Peer</h3>
                <p>Auto-generate key pair untuk peer baru.</p>
              </div>
            </div>
            <button @click="openAddWg = false" class="rf-modal-close">×</button>
          </header>
          <div class="rf-modal-body">
            <Transition name="slide">
              <div v-if="addError" class="rf-alert">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
                <span>{{ addError }}</span>
              </div>
            </Transition>
            <div class="rf-form-field">
              <label>Peer Name</label>
              <input v-model="addWgForm.name" type="text" placeholder="mikrotik-cabang-surabaya" />
            </div>
            <div class="rf-form-field">
              <label class="rf-switch-row">
                <input type="checkbox" v-model="addWgForm.personal" />
                <span>Mode Pribadi <span class="rf-form-hint-inline">VPN personal, tanpa instance/ONT</span></span>
              </label>
            </div>
            <div class="rf-form-field" v-if="!addWgForm.personal">
              <label>GenieACS Instance <span class="rf-form-hint-inline">opsional</span></label>
              <select v-model="addWgForm.instance">
                <option value="">— Pilih instance —</option>
                <option v-for="inst in instanceList" :key="inst.name" :value="inst.name">{{ inst.name }}</option>
              </select>
            </div>
            <div class="rf-form-row" v-if="!addWgForm.personal">
              <div class="rf-form-field">
                <label>IP Block ONT <span class="rf-form-hint-inline">opsional</span></label>
                <input v-model="addWgForm.lan_subnet" type="text" placeholder="192.168.100.0/24" />
                <span class="rf-form-hint-inline">Subnet LAN di belakang router; di-route ke GenieACS lewat tunnel.</span>
              </div>
              <div class="rf-form-field">
                <label>IP Manajemen ONT <span class="rf-form-hint-inline">opsional</span></label>
                <input v-model="addWgForm.ont_ip" type="text" placeholder="192.168.100.2" />
                <span class="rf-form-hint-inline">IP yang akan di-ping untuk cek status.</span>
              </div>
            </div>
            <div class="rf-form-field">
              <label>Catatan <span class="rf-form-hint-inline">opsional</span></label>
              <input v-model="addWgForm.note" type="text" placeholder="Lokasi / nama ISP" />
            </div>
            <div class="rf-info-box rf-info-box-success">
              Keys di-generate otomatis · Peer IP: <code>{{ wgNextIpPreview }}</code> · WireGuard butuh RouterOS 7+
            </div>
          </div>
          <footer class="rf-modal-foot">
            <button @click="openAddWg = false" class="btn-secondary">Cancel</button>
            <button @click="addWgPeer" :disabled="addLoading" class="btn-primary">
              <span v-if="addLoading" class="rf-spinner" style="width:14px;height:14px;border-width:2px"></span>
              {{ addLoading ? 'Creating…' : 'Create Peer' }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>

    <!-- ═══ Modal: Add Static Route ═══ -->
    <Transition name="modal">
      <div v-if="openAddRoute" class="rf-modal" @click.self="openAddRoute = false">
        <div class="modal-box rf-modal-card">
          <header class="rf-modal-head">
            <div class="rf-modal-head-left">
              <span class="rf-modal-icon" style="background:var(--info-soft);color:var(--info)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M6 16V9a4 4 0 0 1 4-4h4"/><path d="M18 8v7a4 4 0 0 1-4 4h-4"/></svg>
              </span>
              <div>
                <h3>Tambah Static Route</h3>
                <p>Routing subnet ONT lewat tunnel VPN — agar GenieACS bisa menjangkau perangkat di belakang router.</p>
              </div>
            </div>
            <button @click="openAddRoute = false" class="rf-modal-close">×</button>
          </header>

          <div class="rf-modal-body">
            <div v-if="routeError" class="rf-alert rf-alert-error">{{ routeError }}</div>

            <div class="rf-form-field">
              <label>Subnet Tujuan (CIDR ONT) <span class="rf-req">*</span></label>
              <input v-model="addRouteForm.subnet" type="text" placeholder="192.168.1.0/24" />
              <p class="rf-help">Subnet LAN di belakang router pelanggan. Mis. <code>192.168.1.0/24</code>.</p>
            </div>

            <div class="rf-form-field">
              <label>Tipe Gateway</label>
              <select v-model="addRouteForm.gateway_type">
                <option value="via">via IP VPN client</option>
                <option value="dev">dev interface (mis. wg0)</option>
              </select>
            </div>

            <div class="rf-form-field" v-if="addRouteForm.gateway_type === 'via'">
              <label>Gateway VPN <span class="rf-req">*</span></label>
              <input v-model="addRouteForm.gateway" type="text" placeholder="10.66.66.2" list="route-gw-options" />
              <datalist id="route-gw-options">
                <option v-for="o in gatewayOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
              </datalist>
              <p class="rf-help">IP VPN dari MikroTik / peer yang terhubung ke subnet ONT tersebut.</p>
            </div>

            <div class="rf-form-field" v-else>
              <label>Interface <span class="rf-req">*</span></label>
              <input v-model="addRouteForm.gateway" type="text" placeholder="wg0" />
              <p class="rf-help">Nama interface VPN (mis. <code>wg0</code>). Cocok jika peer mengiklankan subnet via AllowedIPs.</p>
            </div>

            <div class="rf-form-field">
              <label>Catatan</label>
              <input v-model="addRouteForm.note" type="text" placeholder="Lokasi / nama ISP" />
            </div>
          </div>

          <footer class="rf-modal-foot">
            <button @click="openAddRoute = false" class="btn-secondary">Cancel</button>
            <button @click="addRoute" :disabled="routeLoading" class="btn-primary">
              <span v-if="routeLoading" class="rf-spinner" style="width:14px;height:14px;border-width:2px"></span>
              {{ routeLoading ? 'Menambah…' : 'Tambah Route' }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>

    <!-- ═══ Modal: Edit VPN (L2TP / WG) ═══ -->
    <Transition name="modal">
      <div v-if="openEditModal" class="rf-modal" @click.self="openEditModal = false">
        <div class="modal-box rf-modal-card">
          <header class="rf-modal-head">
            <div class="rf-modal-head-left">
              <span class="rf-modal-icon" style="background:var(--info-soft);color:var(--info)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </span>
              <div>
                <h3>Edit VPN — {{ editForm.name }}</h3>
                <p>{{ editForm._type === 'l2tp' ? 'L2TP / IPsec user' : 'WireGuard peer' }} · ubah instance, ONT, & catatan.</p>
              </div>
            </div>
            <button @click="openEditModal = false" class="rf-modal-close">×</button>
          </header>
          <div class="rf-modal-body">
            <Transition name="slide">
              <div v-if="editError" class="rf-alert">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>
                <span>{{ editError }}</span>
              </div>
            </Transition>
            <div class="rf-form-field">
              <label>GenieACS Instance <span class="rf-form-hint-inline">opsional</span></label>
              <select v-model="editForm.instance">
                <option value="">— Pilih instance —</option>
                <option v-for="inst in instanceList" :key="inst.name" :value="inst.name">{{ inst.name }}</option>
              </select>
              <span class="rf-form-hint-inline">Pindahkan VPN ini ke instance GenieACS lain.</span>
            </div>
            <div v-if="editForm._type === 'l2tp'" class="rf-form-field">
              <label>Versi RouterOS</label>
              <select v-model="editForm.ros_version">
                <option value="7">RouterOS 7.x</option>
                <option value="6">RouterOS 6.x (L2TP saja)</option>
              </select>
            </div>
            <div class="rf-form-row">
              <div class="rf-form-field">
                <label>IP Block ONT <span class="rf-form-hint-inline">opsional</span></label>
                <input v-model="editForm.lan_subnet" type="text" placeholder="192.168.100.0/24" />
                <span class="rf-form-hint-inline">Kosongkan untuk menghapus routing ONT.</span>
              </div>
              <div class="rf-form-field">
                <label>IP Manajemen ONT <span class="rf-form-hint-inline">opsional</span></label>
                <input v-model="editForm.ont_ip" type="text" placeholder="192.168.100.2" />
                <span class="rf-form-hint-inline">IP yang akan di-ping untuk cek status.</span>
              </div>
            </div>
            <div class="rf-form-field">
              <label>Catatan <span class="rf-form-hint-inline">opsional</span></label>
              <input v-model="editForm.note" type="text" placeholder="Lokasi / nama pelanggan" />
            </div>
          </div>
          <footer class="rf-modal-foot">
            <button @click="openEditModal = false" class="btn-secondary">Cancel</button>
            <button @click="saveEdit" :disabled="editLoading" class="btn-primary">
              <span v-if="editLoading" class="rf-spinner" style="width:14px;height:14px;border-width:2px"></span>
              {{ editLoading ? 'Saving…' : 'Save Changes' }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>

    <!-- ═══ Modal: Pool Settings ═══ -->
    <Transition name="modal">
      <div v-if="openPoolSettings" class="rf-modal" @click.self="openPoolSettings = false">
        <div class="modal-box rf-modal-card" style="max-width:520px">
          <header class="rf-modal-head">
            <div class="rf-modal-head-left">
              <span class="rf-modal-icon" style="background:var(--info-soft);color:var(--info)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </span>
              <div>
                <h3>IP Pool Settings — {{ poolForm.type === 'l2tp' ? 'L2TP/IPsec' : 'WireGuard' }}</h3>
                <p>Subnet saat ini harus format /24.</p>
              </div>
            </div>
            <button @click="openPoolSettings = false" class="rf-modal-close">×</button>
          </header>
          <div class="rf-modal-body">
            <div class="rf-form-field">
              <label>Subnet</label>
              <input v-model="poolForm.subnet" type="text" placeholder="192.168.42.0/24" />
            </div>

            <template v-if="poolForm.type === 'l2tp'">
              <div class="rf-form-field">
                <label>Gateway / Local IP</label>
                <input v-model="poolForm.local_ip" type="text" placeholder="192.168.42.1" />
              </div>
              <div class="rf-grid-2" style="gap:12px">
                <div class="rf-form-field" style="margin-bottom:0">
                  <label>Range Start</label>
                  <input v-model="poolForm.range_start" type="text" placeholder="192.168.42.10" />
                </div>
                <div class="rf-form-field" style="margin-bottom:0">
                  <label>Range End</label>
                  <input v-model="poolForm.range_end" type="text" placeholder="192.168.42.100" />
                </div>
              </div>
            </template>

            <template v-else>
              <div class="rf-form-field">
                <label>Server VPN IP</label>
                <input v-model="poolForm.server_vpn_ip" type="text" placeholder="10.8.1.1" />
              </div>
              <div class="rf-form-field">
                <label>Next Peer IP Octet</label>
                <input v-model.number="poolForm.next_ip" type="number" min="2" max="254" />
              </div>
            </template>
          </div>
          <footer class="rf-modal-foot">
            <button @click="openPoolSettings = false" class="btn-secondary">Cancel</button>
            <button @click="savePoolSettings" :disabled="poolLoading" class="btn-primary">
              <span v-if="poolLoading" class="rf-spinner" style="width:14px;height:14px;border-width:2px"></span>
              {{ poolLoading ? 'Saving…' : 'Save Pool' }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>

    <!-- ═══ Modal: Set Speed Limit ═══ -->
    <Transition name="modal">
      <div v-if="openLimitWg" class="rf-modal" @click.self="openLimitWg = false">
        <div class="modal-box rf-modal-card" style="max-width:420px">
          <header class="rf-modal-head">
            <div class="rf-modal-head-left">
              <span class="rf-modal-icon" style="background:var(--info-soft);color:var(--info)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/><circle cx="12" cy="12" r="4"/></svg>
              </span>
              <div>
                <h3>Speed Limit — {{ limitForm.name }}</h3>
                <p>Limit bandwidth via tc HTB · 0 = unlimited</p>
              </div>
            </div>
            <button @click="openLimitWg = false" class="rf-modal-close">×</button>
          </header>
          <div class="rf-modal-body">
            <div class="rf-info-box">
              <div>VPN IP: <code>{{ limitForm.peer_ip }}</code></div>
              <div style="color:var(--text-muted);font-size:12px">Limit diterapkan real-time · 0 = hapus limit</div>
            </div>
            <div class="rf-form-row">
              <div class="rf-form-field">
                <label>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                  Download (Mbps)
                </label>
                <div class="rf-input-unit">
                  <input v-model.number="limitForm.rate_down" type="number" min="0" max="10000" placeholder="0 = unlimited" />
                  <span class="rf-unit">Mbps</span>
                </div>
                <div class="rf-form-hint">Kecepatan MikroTik menerima data</div>
              </div>
              <div class="rf-form-field">
                <label>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                  Upload (Mbps)
                </label>
                <div class="rf-input-unit">
                  <input v-model.number="limitForm.rate_up" type="number" min="0" max="10000" placeholder="0 = unlimited" />
                  <span class="rf-unit">Mbps</span>
                </div>
                <div class="rf-form-hint">Kecepatan MikroTik mengirim data</div>
              </div>
            </div>
            <div v-if="limitForm.rate_down || limitForm.rate_up" class="rf-info-box rf-info-box-success">
              Akan diterapkan: ↓{{ limitForm.rate_down || '∞' }} Mbps · ↑{{ limitForm.rate_up || '∞' }} Mbps
            </div>
            <div v-else class="rf-info-box">
              Kosong / 0 = hapus semua limit (unlimited)
            </div>
          </div>
          <footer class="rf-modal-foot">
            <button @click="openLimitWg = false" class="btn-secondary">Cancel</button>
            <button v-if="limitForm.rate_down || limitForm.rate_up" @click="limitForm.rate_down=0;limitForm.rate_up=0;setWgLimit()" class="btn-secondary" style="color:var(--danger)">
              Hapus Limit
            </button>
            <button @click="setWgLimit" :disabled="limitLoading" class="btn-primary">
              <span v-if="limitLoading" class="rf-spinner" style="width:14px;height:14px;border-width:2px"></span>
              {{ limitLoading ? 'Applying…' : 'Apply Limit' }}
            </button>
          </footer>
        </div>
      </div>
    </Transition>

    <!-- ═══ Modal: ROS Config ═══ -->
    <Transition name="modal">
      <div v-if="rosConfig" class="rf-modal" @click.self="rosConfig = null">
        <div class="modal-box rf-modal-card" style="max-width:680px">
          <header class="rf-modal-head">
            <div class="rf-modal-head-left">
              <span class="rf-modal-icon" style="background:var(--warning-soft);color:var(--warning)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
              </span>
              <div>
                <h3>RouterOS Config — {{ rosConfig.name }}</h3>
                <p>Paste ke Winbox → New Terminal</p>
              </div>
            </div>
            <button @click="rosConfig = null" class="rf-modal-close">×</button>
          </header>
          <div class="rf-modal-body">
            <div class="rf-meta-chips">
              <span class="badge badge-info">🌐 {{ rosConfig.server_ip }}</span>
              <span v-if="rosConfig.peer_ip" class="badge badge-success">VPN: {{ rosConfig.peer_ip }}</span>
            </div>
            <div class="rf-code-block">
              <div class="rf-code-head">
                <span>RouterOS Terminal</span>
                <button class="btn-ghost" @click="copyText(rosConfig.config)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  Copy All
                </button>
              </div>
              <pre class="rf-code">{{ rosConfig.config }}</pre>
            </div>
            <p class="rf-form-hint" style="text-align:center">
              Buka <strong>Winbox → New Terminal</strong> atau SSH ke MikroTik, lalu paste.
            </p>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ═══ Modal: Traffic Graph ═══ -->
    <Transition name="modal">
      <div v-if="trafficModal" class="rf-modal" @click.self="trafficModal = null">
        <div class="modal-box rf-modal-card" style="max-width:640px">
          <header class="rf-modal-head">
            <div class="rf-modal-head-left">
              <span class="rf-modal-icon" style="background:var(--success-soft);color:var(--success)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </span>
              <div>
                <h3>Traffic — {{ trafficModal.name }}</h3>
                <p>Update setiap 30 detik · {{ trafficModal.type === 'wg' ? 'WireGuard' : 'L2TP' }}</p>
              </div>
            </div>
            <button @click="trafficModal = null" class="rf-modal-close">×</button>
          </header>
          <div class="rf-modal-body">
            <div class="rf-traffic-stats">
              <div class="rf-tstat">
                <div class="rf-tstat-label">↓ Download now</div>
                <div class="rf-tstat-val rf-dn">{{ formatBytes(lastTrafficRate(trafficModal.type, trafficModal.name, 'rx')) }}/s</div>
              </div>
              <div class="rf-tstat">
                <div class="rf-tstat-label">↑ Upload now</div>
                <div class="rf-tstat-val rf-up">{{ formatBytes(lastTrafficRate(trafficModal.type, trafficModal.name, 'tx')) }}/s</div>
              </div>
              <div class="rf-tstat">
                <div class="rf-tstat-label">Total RX</div>
                <div class="rf-tstat-val">{{ formatBytes(lastTrafficTotal(trafficModal.type, trafficModal.name, 'rx')) }}</div>
              </div>
              <div class="rf-tstat">
                <div class="rf-tstat-label">Total TX</div>
                <div class="rf-tstat-val">{{ formatBytes(lastTrafficTotal(trafficModal.type, trafficModal.name, 'tx')) }}</div>
              </div>
            </div>
            <div class="rf-graph-wrap">
              <TrafficGraph :history="(trafficModal.type === 'wg' ? trafficHistory.wg : trafficHistory.l2tp)[trafficModal.name] || []" />
            </div>
            <p class="rf-form-hint" style="text-align:center">Grafik menampilkan 10 menit terakhir (20 titik × 30s)</p>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ═══ Toast ═══ -->
    <Transition name="slide">
      <div v-if="copied" class="rf-toast">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        {{ toastMsg }}
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, defineComponent, h } from 'vue'
import axios from 'axios'

// ── Inline sparkline component (mini, 60×20px) ───────────────────────────
const TrafficSparkline = defineComponent({
  props: { history: Array },
  setup(props) {
    return () => {
      const hist = props.history || []
      if (hist.length < 2) return h('span', { class: 'rf-cell-sub', style: 'font-size:10px' }, '—')
      const W = 64, H = 18
      const rates = hist.slice(-20).map((p, i, a) => {
        if (i === 0) return 0
        const dt = Math.max((a[i].ts - a[i-1].ts) / 1000, 1)
        return (a[i].rx - a[i-1].rx + a[i].tx - a[i-1].tx) / dt
      }).slice(1)
      const max = Math.max(...rates, 1)
      const pts = rates.map((v, i) => {
        const x = (i / (rates.length - 1)) * W
        const y = H - (v / max) * H
        return `${x.toFixed(1)},${y.toFixed(1)}`
      }).join(' ')
      return h('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, style: 'overflow:visible' }, [
        h('polyline', { points: pts, fill: 'none', stroke: 'var(--success)', 'stroke-width': '1.5', 'stroke-linejoin': 'round' }),
      ])
    }
  },
})

// ── Full graph component (560×120px) ────────────────────────────────────
const TrafficGraph = defineComponent({
  props: { history: Array },
  setup(props) {
    return () => {
      const hist = props.history || []
      if (hist.length < 2) return h('div', { class: 'rf-graph-empty' }, 'Belum ada data traffic')
      const W = 560, H = 120, PAD = 8
      const items = hist.slice(-20)
      const rxRates = items.map((p, i, a) => {
        if (i === 0) return 0
        const dt = Math.max((a[i].ts - a[i-1].ts) / 1000, 1)
        return (a[i].rx - a[i-1].rx) / dt
      }).slice(1)
      const txRates = items.map((p, i, a) => {
        if (i === 0) return 0
        const dt = Math.max((a[i].ts - a[i-1].ts) / 1000, 1)
        return (a[i].tx - a[i-1].tx) / dt
      }).slice(1)
      const maxVal = Math.max(...rxRates, ...txRates, 1024)
      const toX = (i) => PAD + (i / (rxRates.length - 1 || 1)) * (W - PAD * 2)
      const toY = (v) => H - PAD - (v / maxVal) * (H - PAD * 2)
      const rxPts = rxRates.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')
      const txPts = txRates.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')
      return h('svg', { width: '100%', viewBox: `0 0 ${W} ${H}`, style: 'display:block' }, [
        // Grid lines
        ...[0.25, 0.5, 0.75, 1].map(f =>
          h('line', { x1: PAD, x2: W - PAD, y1: toY(maxVal * f), y2: toY(maxVal * f),
            stroke: 'var(--border)', 'stroke-width': '1', 'stroke-dasharray': '3,3' })
        ),
        h('polyline', { points: rxPts, fill: 'none', stroke: 'var(--success)', 'stroke-width': '2', 'stroke-linejoin': 'round' }),
        h('polyline', { points: txPts, fill: 'none', stroke: 'var(--warning)', 'stroke-width': '2', 'stroke-linejoin': 'round' }),
      ])
    }
  },
})

const tab          = ref('l2tp')
const status       = ref({ server_ip: '', l2tp: {}, wireguard: {} })
const l2tpUsers    = ref([])
const l2tpConfig   = ref({})
const wgPeers      = ref([])
const wgConfig     = ref({})
const instanceList = ref([])
const staticRoutes = ref([])
const loadingL2tp  = ref(true)
const loadingWg    = ref(true)
const addLoading   = ref(false)
const installing   = ref(false)
const addError     = ref('')
const showPSK      = ref(false)
const visiblePass  = ref('')
const rosConfig    = ref(null)
const copied       = ref(false)
const toastMsg     = ref('Disalin ke clipboard')

// ── Pagination: L2TP ─────────────────────────────────────────────────────
const l2tpPage     = ref(1)
const l2tpPageSize  = ref(10)
const l2tpTotalPages = computed(() => Math.max(1, Math.ceil(l2tpUsers.value.length / l2tpPageSize.value)))
const pagedL2tpUsers = computed(() => {
  if (l2tpPage.value > l2tpTotalPages.value) l2tpPage.value = l2tpTotalPages.value
  const s = (l2tpPage.value - 1) * l2tpPageSize.value
  return l2tpUsers.value.slice(s, s + l2tpPageSize.value)
})
function setL2tpPage(next) { l2tpPage.value = Math.min(Math.max(1, next), l2tpTotalPages.value) }
const l2tpPaginationPages = computed(() => {
  const t = l2tpTotalPages.value, c = l2tpPage.value
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1)
  const p = [1]
  if (c > 3) p.push('...')
  for (let i = Math.max(2, c - 1); i <= Math.min(t - 1, c + 1); i++) p.push(i)
  if (c < t - 2) p.push('...')
  p.push(t)
  return p
})

// ── Pagination: WireGuard ────────────────────────────────────────────────
const wgPage       = ref(1)
const wgPageSize   = ref(10)
const wgTotalPages  = computed(() => Math.max(1, Math.ceil(wgPeers.value.length / wgPageSize.value)))
const pagedWgPeers  = computed(() => {
  if (wgPage.value > wgTotalPages.value) wgPage.value = wgTotalPages.value
  const s = (wgPage.value - 1) * wgPageSize.value
  return wgPeers.value.slice(s, s + wgPageSize.value)
})
function setWgPage(next) { wgPage.value = Math.min(Math.max(1, next), wgTotalPages.value) }
const wgPaginationPages = computed(() => {
  const t = wgTotalPages.value, c = wgPage.value
  if (t <= 7) return Array.from({ length: t }, (_, i) => i + 1)
  const p = [1]
  if (c > 3) p.push('...')
  for (let i = Math.max(2, c - 1); i <= Math.min(t - 1, c + 1); i++) p.push(i)
  if (c < t - 2) p.push('...')
  p.push(t)
  return p
})

// Reset to page 1 saat tab berubah
watch(tab, () => { l2tpPage.value = 1; wgPage.value = 1 })

const openInstallL2tp = ref(false)
const openAddL2tp     = ref(false)
const openInstallWg   = ref(false)
const openAddWg       = ref(false)
const openPoolSettings = ref(false)
const poolLoading     = ref(false)
const poolForm        = ref({ type:'l2tp', subnet:'', local_ip:'', range_start:'', range_end:'', server_vpn_ip:'', next_ip:2 })
const openLimitWg     = ref(false)
const limitLoading    = ref(false)
const limitForm       = ref({ name: '', peer_ip: '', rate_down: 0, rate_up: 0, _type: 'wg' })
const trafficHistory  = ref({ wg: {}, l2tp: {} })  // { name: [{ts, rx, tx}, ...] }
const trafficModal    = ref(null)  // { type, name }
let trafficTimer      = null

const installL2tpForm = ref({ psk: '' })
const installWgForm   = ref({ port: 51820 })
const addL2tpForm     = ref({ username: '', password: '', instance: '', note: '', ros_version: '7', lan_subnet: '', ont_ip: '', personal: false })
const addWgForm       = ref({ name: '', instance: '', note: '', lan_subnet: '', ont_ip: '', personal: false })

// ── Static Route ───────────────────────────────────────────────────────────
const openAddRoute    = ref(false)
const routeLoading    = ref(false)
const routeError      = ref('')
const togglingRoute   = ref('')   // id route yang sedang di-toggle
const addRouteForm    = ref({ subnet: '', gateway: '', gateway_type: 'via', note: '' })
const terminalLoading = ref(false)
const terminalOutput  = ref('')
const terminalForm    = ref({ command: 'ping', target: '' })

// ── Edit VPN (L2TP user / WG peer) ─────────────────────────────────────────
const openEditModal = ref(false)
const editLoading    = ref(false)
const editError      = ref('')
const editForm       = ref({ _type: 'wg', name: '', instance: '', note: '', ros_version: '7', lan_subnet: '', ont_ip: '' })
const togglingState  = ref('')   // name yang sedang di-toggle enable/disable

// Status VPN ONT (per akun): { l2tp:[...], wireguard:[...] }
const ontStatus    = ref({ l2tp: [], wireguard: [] })
let ontStatusTimer = null
const ontStatusFor = (type, key) => {
  const list = type === 'wg' ? ontStatus.value.wireguard : ontStatus.value.l2tp
  const id = type === 'wg' ? 'name' : 'username'
  return (list || []).find(x => x[id] === key) || null
}

const icoShield = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`
const icoWg     = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4"/></svg>`
const icoRoute  = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M6 16V9a4 4 0 0 1 4-4h4"/><path d="M18 8v7a4 4 0 0 1-4 4h-4"/></svg>`

const tabs = computed(() => [
  { id: 'l2tp',      label: 'L2TP / IPsec', icon: icoShield, count: l2tpUsers.value.length },
  { id: 'wireguard', label: 'WireGuard',    icon: icoWg,     count: wgPeers.value.length },
  { id: 'routes',    label: 'Static Route', icon: icoRoute,  count: staticRoutes.value.length },
])

const wgPrefix = computed(() => {
  const m = String(wgConfig.value.subnet || '10.8.1.0/24').match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.0\/24$/)
  return m ? m[1] + '.' : '10.8.1.'
})
const wgNextIpPreview = computed(() => {
  if (wgConfig.value.next_ip) return `${wgPrefix.value}${wgConfig.value.next_ip}`
  return `${wgPrefix.value}${(wgPeers.value.length || 0) + 2}`
})

async function fetchAll() {
  // allSettled: satu request gagal tidak menghalangi yang lain
  const [healthRes, statusRes, l2tpRes, l2tpCfgRes, wgRes, wgCfgRes, instRes, ontRes, routesRes] = await Promise.allSettled([
    axios.get('/api/health'),           // no auth — untuk server_ip
    axios.get('/api/vpn/status'),
    axios.get('/api/vpn/l2tp/users'),
    axios.get('/api/vpn/l2tp/config'),
    axios.get('/api/vpn/wireguard/peers'),
    axios.get('/api/vpn/wireguard/config'),
    axios.get('/api/instances'),
    axios.get('/api/vpn/ont-status'),
    axios.get('/api/vpn/routes'),
  ])
  // server_ip dari health (no auth), sisanya dari status
  if (healthRes.status  === 'fulfilled') status.value.server_ip = healthRes.value.data.server_ip
  if (statusRes.status  === 'fulfilled') {
    status.value = { ...statusRes.value.data, server_ip: status.value.server_ip || statusRes.value.data.server_ip }
  }
  if (l2tpRes.status    === 'fulfilled') l2tpUsers.value    = l2tpRes.value.data
  if (l2tpCfgRes.status === 'fulfilled') l2tpConfig.value   = l2tpCfgRes.value.data
  if (wgRes.status      === 'fulfilled') wgPeers.value      = wgRes.value.data
  if (wgCfgRes.status   === 'fulfilled') wgConfig.value     = wgCfgRes.value.data
  if (instRes.status    === 'fulfilled') instanceList.value  = instRes.value.data
  if (ontRes.status     === 'fulfilled') ontStatus.value     = ontRes.value.data
  if (routesRes.status  === 'fulfilled') staticRoutes.value  = routesRes.value.data.routes || []

  loadingL2tp.value = false
  loadingWg.value   = false
}

// Refresh status VPN ONT saja (untuk polling ringan).
async function refreshOntStatus() {
  try {
    const res = await axios.get('/api/vpn/ont-status')
    ontStatus.value = res.data
  } catch { /* abaikan error transient */ }
}

async function installL2tp() {
  installing.value = true
  try {
    const res = await axios.post('/api/vpn/l2tp/install', { psk: installL2tpForm.value.psk })
    openInstallL2tp.value = false
    alert(`✅ L2TP/IPsec installed!\nPSK: ${res.data.psk}\nDefault: ${res.data.default_user} / ${res.data.default_pass}`)
    await fetchAll()
  } catch (e) { alert(e.response?.data?.message || 'Gagal install L2TP') }
  finally { installing.value = false }
}

async function installWg() {
  installing.value = true
  try {
    const res = await axios.post('/api/vpn/wireguard/install', { port: installWgForm.value.port })
    openInstallWg.value = false
    alert(`✅ WireGuard installed!\nServer PubKey:\n${res.data.server_pubkey}`)
    await fetchAll()
  } catch (e) { alert(e.response?.data?.message || 'Gagal install WireGuard') }
  finally { installing.value = false }
}

async function addL2tpUser() {
  addError.value = ''
  if (!addL2tpForm.value.username) { addError.value = 'Username wajib diisi.'; return }
  if (!addL2tpForm.value.password) addL2tpForm.value.password = genPass()
  addLoading.value = true
  try {
    const payload = { ...addL2tpForm.value }
    // Mode pribadi: VPN personal tanpa kaitan instance/ONT.
    if (payload.personal) { payload.instance = ''; payload.lan_subnet = ''; payload.ont_ip = '' }
    delete payload.personal
    await axios.post('/api/vpn/l2tp/users', payload)
    openAddL2tp.value = false
    addL2tpForm.value = { username: '', password: '', instance: '', note: '', ros_version: '7', lan_subnet: '', ont_ip: '', personal: false }
    await fetchAll()
  } catch (e) { addError.value = e.response?.data?.message || 'Gagal membuat user.' }
  finally { addLoading.value = false }
}

async function deleteL2tpUser(name) {
  if (!confirm(`Hapus user L2TP "${name}"?`)) return
  try { await axios.delete(`/api/vpn/l2tp/users/${name}`); await fetchAll() }
  catch (e) { alert(e.response?.data?.message || 'Gagal hapus') }
}

async function addWgPeer() {
  addError.value = ''
  if (!addWgForm.value.name) { addError.value = 'Nama peer wajib diisi.'; return }
  addLoading.value = true
  try {
    const payload = { ...addWgForm.value }
    // Mode pribadi: VPN personal tanpa kaitan instance/ONT.
    if (payload.personal) { payload.instance = ''; payload.lan_subnet = ''; payload.ont_ip = '' }
    delete payload.personal
    await axios.post('/api/vpn/wireguard/peers', payload)
    openAddWg.value = false
    addWgForm.value = { name: '', instance: '', note: '', lan_subnet: '', ont_ip: '', personal: false }
    await fetchAll()
  } catch (e) { addError.value = e.response?.data?.message || 'Gagal membuat peer.' }
  finally { addLoading.value = false }
}

async function deleteWgPeer(name) {
  if (!confirm(`Hapus WireGuard peer "${name}"?`)) return
  try { await axios.delete(`/api/vpn/wireguard/peers/${name}`); await fetchAll() }
  catch (e) { alert(e.response?.data?.message || 'Gagal hapus') }
}

// ── Static Route ───────────────────────────────────────────────────────────
// Saran gateway: IP VPN dari peer WireGuard + user L2TP yang punya static IP.
const gatewayOptions = computed(() => {
  const opts = []
  for (const p of wgPeers.value) {
    if (p.peer_ip) opts.push({ value: p.peer_ip, label: `${p.peer_ip} — WG: ${p.name}` })
  }
  for (const u of l2tpUsers.value) {
    if (u.vpn_ip) opts.push({ value: u.vpn_ip, label: `${u.vpn_ip} — L2TP: ${u.username}` })
  }
  return opts
})

function openAddRouteModal() {
  routeError.value = ''
  addRouteForm.value = { subnet: '', gateway: '', gateway_type: 'via', note: '' }
  openAddRoute.value = true
}

async function addRoute() {
  routeError.value = ''
  const f = addRouteForm.value
  if (!f.subnet) { routeError.value = 'Subnet tujuan wajib diisi (mis. 192.168.1.0/24).'; return }
  if (!f.gateway) { routeError.value = f.gateway_type === 'dev' ? 'Interface wajib diisi (mis. wg0).' : 'Gateway IP VPN wajib diisi.'; return }
  routeLoading.value = true
  try {
    await axios.post('/api/vpn/routes', {
      subnet: f.subnet.trim(),
      gateway: f.gateway.trim(),
      gateway_type: f.gateway_type,
      note: f.note || '',
    })
    openAddRoute.value = false
    await fetchAll()
    showToast('✓ Static route ditambahkan')
  } catch (e) { routeError.value = e.response?.data?.message || 'Gagal menambah route.' }
  finally { routeLoading.value = false }
}

async function toggleRoute(route) {
  togglingRoute.value = route.id
  try {
    await axios.put(`/api/vpn/routes/${route.id}/toggle`, { enabled: route.enabled === false })
    await fetchAll()
    showToast(route.enabled === false ? '✓ Route diaktifkan' : '✓ Route dinonaktifkan')
  } catch (e) { alert(e.response?.data?.message || 'Gagal mengubah route') }
  finally { togglingRoute.value = '' }
}

async function deleteRoute(route) {
  if (!confirm(`Hapus static route ke ${route.subnet}?`)) return
  try { await axios.delete(`/api/vpn/routes/${route.id}`); await fetchAll(); showToast('✓ Route dihapus') }
  catch (e) { alert(e.response?.data?.message || 'Gagal hapus route') }
}

async function runTerminalCommand() {
  terminalLoading.value = true
  terminalOutput.value = 'Menjalankan command…'
  try {
    const payload = { ...terminalForm.value }
    const { data } = await axios.post('/api/vpn/terminal', payload)
    terminalOutput.value = data.output || (data.ok ? 'OK' : 'Tidak ada output.')
  } catch (e) {
    terminalOutput.value = e.response?.data?.message || 'Command gagal.'
  } finally {
    terminalLoading.value = false
  }
}

async function pingRouteGateway(route) {
  terminalForm.value = { command: 'ping', target: route.gateway }
  terminalLoading.value = true
  terminalOutput.value = `Ping ${route.gateway} dari server VPN…`
  try {
    const { data } = await axios.post('/api/vpn/terminal', { command: 'ping', target: route.gateway })
    terminalOutput.value = data.output || (data.ok ? 'OK' : 'Tidak ada output.')
  } catch (e) {
    terminalOutput.value = e.response?.data?.message || 'Ping gagal.'
  } finally {
    terminalLoading.value = false
  }
}

// ── Edit VPN (L2TP user / WG peer) ─────────────────────────────────────────
function openEdit(item, type) {
  editError.value = ''
  editForm.value = {
    _type:       type,
    name:        type === 'l2tp' ? item.username : item.name,
    instance:    item.instance || '',
    note:        item.note || '',
    ros_version: type === 'l2tp' ? (String(item.ros_version) === '6' ? '6' : '7') : '7',
    lan_subnet:  item.lan_subnet || '',
    ont_ip:      item.ont_ip || '',
  }
  openEditModal.value = true
}

async function saveEdit() {
  editError.value = ''
  editLoading.value = true
  try {
    const f = editForm.value
    const payload = {
      instance:   f.instance || '',
      note:       f.note || '',
      lan_subnet: f.lan_subnet || null,
      ont_ip:     f.ont_ip || null,
    }
    if (f._type === 'l2tp') {
      payload.ros_version = f.ros_version
      await axios.put(`/api/vpn/l2tp/users/${f.name}`, payload)
    } else {
      await axios.put(`/api/vpn/wireguard/peers/${f.name}`, payload)
    }
    openEditModal.value = false
    await fetchAll()
    showToast('✓ VPN berhasil diperbarui')
  } catch (e) { editError.value = e.response?.data?.message || 'Gagal menyimpan perubahan.' }
  finally { editLoading.value = false }
}

async function toggleState(item, type) {
  const name = type === 'l2tp' ? item.username : item.name
  const next = !item.disabled
  if (!confirm(next ? `Nonaktifkan VPN "${name}"? Koneksi akan diputus.` : `Aktifkan kembali VPN "${name}"?`)) return
  togglingState.value = name
  try {
    const url = type === 'l2tp'
      ? `/api/vpn/l2tp/users/${name}/state`
      : `/api/vpn/wireguard/peers/${name}/state`
    await axios.patch(url, { disabled: next })
    await fetchAll()
    showToast(next ? `✓ "${name}" dinonaktifkan` : `✓ "${name}" diaktifkan`)
  } catch (e) { alert(e.response?.data?.message || 'Gagal mengubah status') }
  finally { togglingState.value = '' }
}

function openPoolModal(type) {
  if (type === 'l2tp') {
    poolForm.value = {
      type: 'l2tp',
      subnet:     l2tpConfig.value.subnet     || '192.168.42.0/24',
      local_ip:   l2tpConfig.value.local_ip   || '192.168.42.1',
      range_start:l2tpConfig.value.range_start || '192.168.42.10',
      range_end:  l2tpConfig.value.range_end  || '192.168.42.100',
    }
  } else {
    poolForm.value = {
      type: 'wireguard',
      subnet:       wgConfig.value.subnet       || '10.8.1.0/24',
      server_vpn_ip:wgConfig.value.server_vpn_ip || '10.8.1.1',
      next_ip:      wgConfig.value.next_ip      || 2,
    }
  }
  openPoolSettings.value = true
}

async function savePoolSettings() {
  poolLoading.value = true
  try {
    if (poolForm.value.type === 'l2tp') {
      await axios.put('/api/vpn/l2tp/config', {
        subnet:     poolForm.value.subnet,
        local_ip:   poolForm.value.local_ip,
        range_start:poolForm.value.range_start,
        range_end:  poolForm.value.range_end,
      })
    } else {
      await axios.put('/api/vpn/wireguard/config', {
        subnet:       poolForm.value.subnet,
        server_vpn_ip:poolForm.value.server_vpn_ip,
        next_ip:      poolForm.value.next_ip,
      })
    }
    openPoolSettings.value = false
    showToast('✓ IP Pool berhasil diperbarui')
    await fetchAll()
  } catch (e) { alert(e.response?.data?.message || 'Gagal simpan IP Pool') }
  finally { poolLoading.value = false }
}

function openLimitModal(peer, type = 'wg') {
  limitForm.value = {
    name:      peer.name || peer.username,
    peer_ip:   peer.peer_ip || '—',
    rate_down: peer.rate_down || 0,
    rate_up:   peer.rate_up   || 0,
    _type:     type,
  }
  openLimitWg.value = true
}

async function setWgLimit() {
  limitLoading.value = true
  try {
    const { name, rate_down, rate_up, _type } = limitForm.value
    const url = _type === 'l2tp'
      ? `/api/vpn/l2tp/users/${name}/limit`
      : `/api/vpn/wireguard/peers/${name}/limit`
    await axios.put(url, { rate_down: rate_down || 0, rate_up: rate_up || 0 })
    openLimitWg.value = false
    await fetchAll()
    showToast(rate_down || rate_up
      ? `✓ Limit: ↓${rate_down||'∞'}M ↑${rate_up||'∞'}M`
      : '✓ Speed limit dihapus')
  } catch (e) { alert(e.response?.data?.message || 'Gagal set limit') }
  finally { limitLoading.value = false }
}

// ── Traffic polling ───────────────────────────────────────────────────────
async function fetchTraffic() {
  try {
    const res = await axios.get('/api/vpn/traffic')
    const { wg, l2tp, ts } = res.data
    const MAX_HISTORY = 20

    for (const peer of (wg || [])) {
      if (!trafficHistory.value.wg[peer.name]) trafficHistory.value.wg[peer.name] = []
      const hist = trafficHistory.value.wg[peer.name]
      hist.push({ ts, rx: peer.rx, tx: peer.tx })
      if (hist.length > MAX_HISTORY) hist.splice(0, hist.length - MAX_HISTORY)
    }
    for (const user of (l2tp || [])) {
      if (!trafficHistory.value.l2tp[user.name]) trafficHistory.value.l2tp[user.name] = []
      const hist = trafficHistory.value.l2tp[user.name]
      hist.push({ ts, rx: user.rx, tx: user.tx })
      if (hist.length > MAX_HISTORY) hist.splice(0, hist.length - MAX_HISTORY)
    }
  } catch {}
}

function lastTrafficRate(type, name, field) {
  const hist = trafficHistory.value[type]?.[name] || []
  if (hist.length < 2) return 0
  const a = hist[hist.length - 2], b = hist[hist.length - 1]
  const dt = Math.max((b.ts - a.ts) / 1000, 1)
  return Math.max((b[field] - a[field]) / dt, 0)
}

function lastTrafficTotal(type, name, field) {
  const hist = trafficHistory.value[type]?.[name] || []
  return hist.length ? hist[hist.length - 1][field] : 0
}

function formatBytes(bytes) {
  if (bytes < 1024)       return `${bytes.toFixed(0)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} K`
  return `${(bytes / 1024 / 1024).toFixed(2)} M`
}

function openTrafficModal(type, name) {
  trafficModal.value = { type, name }
}

async function showMikrotikConfig(type, name, rosOverride) {
  try {
    // Tentukan versi ROS: override (tombol) > nilai tersimpan di akun > 7.
    let ros = rosOverride
    if (!ros) {
      if (type === 'l2tp') {
        const u = l2tpUsers.value.find(x => x.username === name)
        ros = u?.ros_version || '7'
      } else {
        ros = '7' // WireGuard hanya ROS7
      }
    }
    const base = type === 'l2tp' ? `/api/vpn/l2tp/mikrotik/${name}` : `/api/vpn/wireguard/mikrotik/${name}`
    const url = `${base}?ros=${ros}`
    const res = await axios.get(url)
    rosConfig.value = { ...res.data, name, type, ros_version: res.data.ros_version || ros }
  } catch (e) { alert(e.response?.data?.message || 'Gagal load config') }
}

function genPass() {
  return Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 6).toUpperCase()
}

function showToast(msg = 'Disalin ke clipboard') {
  toastMsg.value = msg
  copied.value = true
  setTimeout(() => copied.value = false, 2500)
}

function copyText(txt) {
  navigator.clipboard.writeText(txt).then(() => showToast('Disalin ke clipboard'))
}

onMounted(async () => {
  await fetchAll()
  await fetchTraffic()
  trafficTimer = setInterval(fetchTraffic, 30_000)
  // Polling status VPN ONT tiap 30s (ringan, hanya status + ping).
  ontStatusTimer = setInterval(refreshOntStatus, 30_000)
})

onUnmounted(() => {
  if (trafficTimer) clearInterval(trafficTimer)
  if (ontStatusTimer) clearInterval(ontStatusTimer)
})
</script>

<style scoped>
.rf-vpn { display: flex; flex-direction: column; gap: 20px; }

/* ─── Status grid ─── */
.rf-vpn-status {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
@media (max-width: 1100px) { .rf-vpn-status { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px)  { .rf-vpn-status { grid-template-columns: 1fr; } }

.rf-status-card {
  display: flex; align-items: center; gap: 14px;
  padding: 18px 20px;
  cursor: default;
}
.rf-status-card[class*="rf-card-hover"] { cursor: pointer; }
.rf-status-card.is-active {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent), 0 6px 20px rgba(96,93,255,.2);
}
.rf-status-ic {
  width: 42px; height: 42px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.rf-status-body { flex: 1; min-width: 0; }
.rf-status-label {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
  letter-spacing: .04em;
  text-transform: uppercase;
}
.rf-status-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -.005em;
  font-family: 'JetBrains Mono', monospace;
  margin-top: 2px;
}
.rf-status-row {
  display: flex; align-items: center; gap: 7px;
  margin-top: 4px;
}
.rf-status-state {
  font-size: 13px; font-weight: 600;
}
.rf-status-meta {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 4px;
}

/* ─── Tabs ─── */
.rf-tabs {
  display: inline-flex;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 4px;
  gap: 4px;
  width: fit-content;
}
.rf-tab {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px; font-weight: 500;
  color: var(--text-secondary);
  border: none;
  background: transparent;
  transition: all .15s;
}
.rf-tab:hover { color: var(--text-primary); }
.rf-tab.is-active {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 4px 14px rgba(96,93,255,.3);
}
.rf-tab-ic { display: inline-flex; }
.rf-tab-count {
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  padding: 1px 7px;
  border-radius: 99px;
  background: rgba(255,255,255,.15);
}
.rf-tab:not(.is-active) .rf-tab-count {
  background: var(--bg-elevated);
  color: var(--text-muted);
}

.rf-section { display: flex; flex-direction: column; gap: 16px; }

/* ─── Section toolbar ─── */
.rf-section-tool {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 16px;
  padding: 16px 20px;
}
.rf-section-tool-left { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.rf-section-tool-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

.rf-key-line {
  display: flex; align-items: center; gap: 8px;
  flex-wrap: wrap;
}
.rf-key-label {
  font-size: 11.5px;
  color: var(--text-muted);
  font-weight: 500;
}
.rf-key-val {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 7px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--purple);
}
.rf-key-truncate { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rf-key-meta {
  font-size: 11.5px;
  color: var(--text-muted);
  margin-top: 4px;
}

/* ─── Table cells ─── */
.rf-table-wrap { overflow-x: auto; }
.rf-cell-user { display: flex; align-items: center; gap: 12px; }
.rf-cell-name { font-size: 13.5px; font-weight: 600; color: var(--text-primary); }
.rf-cell-sub  { font-size: 11px; color: var(--text-muted); margin-top: 1px; }

.rf-pass-row { display: flex; align-items: center; gap: 6px; }
.rf-pass {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
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
.rf-act-warning { background: var(--warning-soft); color: var(--warning); border-color: rgba(245,184,41,.22); }
.rf-act-warning:hover:not(:disabled) { background: rgba(245,184,41,.2); }
.rf-act-info    { background: var(--info-soft);    color: var(--info);    border-color: rgba(96,190,255,.22); }
.rf-act-info:hover:not(:disabled)    { background: rgba(96,190,255,.18); }
.rf-act-danger  { background: var(--danger-soft);  color: var(--danger);  border-color: rgba(255,94,94,.22); padding: 6px 8px; }
.rf-act-danger:hover:not(:disabled)  { background: rgba(255,94,94,.2); }
.rf-act-success { background: var(--success-soft); color: var(--success); border-color: rgba(26,188,156,.22); }
.rf-act-success:hover:not(:disabled) { background: rgba(26,188,156,.2); }
.rf-act-muted   { background: rgba(120,130,160,.12); color: var(--text-muted); border-color: rgba(120,130,160,.22); }
.rf-act-muted:hover:not(:disabled)   { background: rgba(120,130,160,.22); }
.rf-act:disabled { opacity: .55; cursor: not-allowed; }

/* ─── Speed badge ─── */
.rf-speed-badge { display: flex; flex-direction: column; gap: 2px; }
.rf-speed-dn { font-size: 11px; font-weight: 600; color: var(--success); font-family: 'JetBrains Mono', monospace; }
.rf-speed-up { font-size: 11px; font-weight: 600; color: var(--warning); font-family: 'JetBrains Mono', monospace; }

/* ─── ONT VPN status ─── */
.rf-ont-status { margin-top: 6px; display: flex; flex-direction: column; gap: 2px; align-items: flex-start; }
.rf-ont-status .badge { font-size: 10px; }

/* ─── Input with unit suffix ─── */
.rf-input-unit { position: relative; display: flex; }
.rf-input-unit input { flex: 1; padding-right: 52px; }
.rf-unit {
  position: absolute; right: 0; top: 0; bottom: 0;
  display: flex; align-items: center; padding: 0 12px;
  font-size: 11px; font-weight: 600; color: var(--text-muted);
  background: var(--bg-elevated); border-left: 1px solid var(--border);
  border-radius: 0 8px 8px 0; pointer-events: none;
}

/* ─── Traffic cell ─── */
.rf-traffic-cell {
  display: flex; flex-direction: column; gap: 3px;
  cursor: pointer; padding: 4px 6px; border-radius: 6px;
  transition: background .15s;
}
.rf-traffic-cell:hover { background: var(--bg-elevated); }
.rf-traffic-nums { display: flex; flex-direction: column; gap: 1px; }
.rf-dn { font-size: 10px; font-weight: 600; color: var(--success); font-family: 'JetBrains Mono', monospace; }
.rf-up { font-size: 10px; font-weight: 600; color: var(--warning); font-family: 'JetBrains Mono', monospace; }

/* ─── Traffic modal stats ─── */
.rf-traffic-stats {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 12px; margin-bottom: 20px;
}
.rf-tstat {
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 10px; padding: 12px 14px;
}
.rf-tstat-label { font-size: 10px; color: var(--text-muted); font-weight: 500; text-transform: uppercase; letter-spacing: .04em; }
.rf-tstat-val { font-size: 16px; font-weight: 700; font-family: 'JetBrains Mono', monospace; color: var(--text-primary); margin-top: 4px; }

/* ─── Traffic graph ─── */
.rf-graph-wrap {
  background: var(--bg-elevated); border: 1px solid var(--border);
  border-radius: 10px; padding: 14px; min-height: 130px;
  display: flex; align-items: center; justify-content: center;
}
.rf-graph-empty { color: var(--text-muted); font-size: 13px; }

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
  background: rgba(8,11,22,.65);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.rf-modal-card {
  width: 100%; max-width: 520px;
  background: var(--bg-surface);
  border: 1px solid var(--border-strong);
  border-radius: 18px;
  box-shadow: var(--shadow-modal);
  overflow: hidden;
  max-height: 90vh;
  display: flex; flex-direction: column;
}
.rf-modal-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.rf-modal-head-left { display: flex; align-items: center; gap: 12px; }
.rf-modal-icon {
  width: 38px; height: 38px;
  border-radius: 11px;
  display: flex; align-items: center; justify-content: center;
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
  font-size: 18px; line-height: 1;
  transition: all .15s;
}
.rf-modal-close:hover { background: var(--bg-hover); color: var(--text-primary); }

.rf-modal-body {
  padding: 22px;
  display: flex; flex-direction: column; gap: 16px;
  overflow-y: auto;
}
.rf-modal-foot {
  display: flex; gap: 10px; justify-content: flex-end;
  padding: 16px 22px;
  background: var(--bg-elevated);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}

.rf-info-box {
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-secondary);
  display: flex; flex-direction: column; gap: 5px;
}
.rf-info-box code {
  background: var(--bg-base);
  padding: 1px 6px;
  border-radius: 4px;
  color: var(--accent);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}
.rf-info-box-success {
  background: var(--success-soft);
  border-color: rgba(26,188,156,.22);
  color: var(--success);
}

.rf-terminal-card { margin-top: 16px; }
.rf-terminal-head {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  margin-bottom: 14px;
}
.rf-terminal-head h3 { margin: 0 0 4px; font-size: 15px; color: var(--text-primary); }
.rf-terminal-head p { margin: 0; font-size: 12px; color: var(--text-muted); }
.rf-terminal-output {
  min-height: 170px; max-height: 360px; overflow: auto;
  margin: 12px 0 0; padding: 14px;
  border-radius: 12px; border: 1px solid var(--border);
  background: #050711; color: #dbeafe;
  font: 12px/1.5 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  white-space: pre-wrap;
}

.rf-form-field { display: flex; flex-direction: column; gap: 6px; }
.rf-form-field label {
  font-size: 12px; font-weight: 600;
  color: var(--text-secondary);
}
.rf-form-field input,
.rf-form-field select { padding: 10px 12px; border-radius: 10px; }
.rf-form-hint { font-size: 11px; color: var(--text-muted); }
.rf-form-hint-inline {
  font-weight: 500;
  color: var(--text-muted);
  margin-left: 4px;
}
.rf-form-row {
  display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
}
.rf-input-group {
  display: flex; gap: 6px;
}
.rf-input-group input { flex: 1; }
.rf-gen { padding: 0 12px; }

/* Toggle "Mode Pribadi" — minimalist switch row dalam form modal */
.rf-switch-row {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 10px; border-radius: 8px;
  background: var(--bg-soft, rgba(0,0,0,0.03));
  cursor: pointer; user-select: none;
  font-size: 12px; font-weight: 600;
  color: var(--text-primary);
}
.rf-switch-row input[type="checkbox"] {
  width: 14px; height: 14px; margin: 0; cursor: pointer;
  accent-color: var(--accent, #4f46e5);
}
.rf-switch-row span { display: inline-flex; align-items: baseline; gap: 6px; }

.rf-alert {
  display: flex; align-items: center; gap: 9px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--danger-soft);
  border: 1px solid rgba(255,94,94,.22);
  color: var(--danger);
  font-size: 12px;
}

/* ─── Code block ─── */
.rf-meta-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.rf-code-block {
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--border-strong);
  background: #050709;
}
.rf-code-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 9px 14px;
  background: var(--bg-elevated);
  border-bottom: 1px solid var(--border);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-muted);
}
.rf-code {
  padding: 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: #86efac;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 360px;
  overflow-y: auto;
  line-height: 1.65;
}

/* ─── Pagination ─── */
.rf-pagination {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 12px 16px 16px;
  border-top: 1px solid var(--border);
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

/* ─── Toast ─── */
.rf-toast {
  position: fixed;
  bottom: 24px; right: 24px;
  z-index: 100;
  display: inline-flex; align-items: center; gap: 8px;
  padding: 11px 16px;
  border-radius: 12px;
  background: var(--success-soft);
  border: 1px solid rgba(26,188,156,.3);
  color: var(--success);
  font-size: 12.5px; font-weight: 600;
  box-shadow: var(--shadow-lg);
}
</style>
