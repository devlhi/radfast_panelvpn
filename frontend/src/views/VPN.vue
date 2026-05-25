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
                <th>Status</th>
                <th style="text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loadingL2tp">
                <td colspan="5"><div class="rf-empty"><div class="rf-spinner"></div><span>Memuat user…</span></div></td>
              </tr>
              <tr v-else-if="l2tpUsers.length === 0">
                <td colspan="5">
                  <div class="rf-empty">
                    <div class="rf-empty-ic">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    </div>
                    <p class="rf-empty-title">Belum ada user L2TP</p>
                    <p class="rf-empty-sub">Tambah user untuk tiap MikroTik yang terhubung.</p>
                  </div>
                </td>
              </tr>
              <tr v-for="user in l2tpUsers" :key="user.username">
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
                  <span class="badge" :class="user.connected ? 'badge-success' : 'badge-muted'">
                    <span class="dot" :class="user.connected ? 'dot-success' : 'dot-muted'"></span>
                    {{ user.connected ? 'Connected' : 'Idle' }}
                  </span>
                </td>
                <td style="text-align:right">
                  <div class="rf-actions">
                    <button class="rf-act rf-act-warning" @click="showMikrotikConfig('l2tp', user.username)">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                      ROS Config
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
                <th>Status</th>
                <th style="text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loadingWg">
                <td colspan="6"><div class="rf-empty"><div class="rf-spinner"></div><span>Memuat peers…</span></div></td>
              </tr>
              <tr v-else-if="wgPeers.length === 0">
                <td colspan="6">
                  <div class="rf-empty">
                    <div class="rf-empty-ic">
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                    </div>
                    <p class="rf-empty-title">Belum ada WireGuard peer</p>
                    <p class="rf-empty-sub">Butuh RouterOS 7.x — performanya lebih kencang dari L2TP.</p>
                  </div>
                </td>
              </tr>
              <tr v-for="peer in wgPeers" :key="peer.name">
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
                  <span class="badge" :class="peer.connected ? 'badge-success' : 'badge-muted'">
                    <span class="dot" :class="peer.connected ? 'dot-success' : 'dot-muted'"></span>
                    {{ peer.connected ? 'Connected' : 'Idle' }}
                  </span>
                </td>
                <td style="text-align:right">
                  <div class="rf-actions">
                    <button class="rf-act rf-act-warning" @click="showMikrotikConfig('wg', peer.name)">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                      ROS Config
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
              <label>GenieACS Instance <span class="rf-form-hint-inline">opsional</span></label>
              <select v-model="addL2tpForm.instance">
                <option value="">— Pilih instance —</option>
                <option v-for="inst in instanceList" :key="inst.name" :value="inst.name">{{ inst.name }}</option>
              </select>
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
              <label>GenieACS Instance <span class="rf-form-hint-inline">opsional</span></label>
              <select v-model="addWgForm.instance">
                <option value="">— Pilih instance —</option>
                <option v-for="inst in instanceList" :key="inst.name" :value="inst.name">{{ inst.name }}</option>
              </select>
            </div>
            <div class="rf-form-field">
              <label>Catatan <span class="rf-form-hint-inline">opsional</span></label>
              <input v-model="addWgForm.note" type="text" placeholder="Lokasi / nama ISP" />
            </div>
            <div class="rf-info-box rf-info-box-success">
              Keys di-generate otomatis · Peer IP: <code>10.8.1.{{ wgPeers.length + 2 }}</code>
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

    <!-- ═══ Toast ═══ -->
    <Transition name="slide">
      <div v-if="copied" class="rf-toast">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        Disalin ke clipboard
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const tab          = ref('l2tp')
const status       = ref({ server_ip: '', l2tp: {}, wireguard: {} })
const l2tpUsers    = ref([])
const l2tpConfig   = ref({})
const wgPeers      = ref([])
const wgConfig     = ref({})
const instanceList = ref([])
const loadingL2tp  = ref(true)
const loadingWg    = ref(true)
const addLoading   = ref(false)
const installing   = ref(false)
const addError     = ref('')
const showPSK      = ref(false)
const visiblePass  = ref('')
const rosConfig    = ref(null)
const copied       = ref(false)

const openInstallL2tp = ref(false)
const openAddL2tp     = ref(false)
const openInstallWg   = ref(false)
const openAddWg       = ref(false)

const installL2tpForm = ref({ psk: '' })
const installWgForm   = ref({ port: 51820 })
const addL2tpForm     = ref({ username: '', password: '', instance: '', note: '' })
const addWgForm       = ref({ name: '', instance: '', note: '' })

const icoShield = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`
const icoWg     = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4"/></svg>`

const tabs = computed(() => [
  { id: 'l2tp',      label: 'L2TP / IPsec', icon: icoShield, count: l2tpUsers.value.length },
  { id: 'wireguard', label: 'WireGuard',    icon: icoWg,     count: wgPeers.value.length },
])

async function fetchAll() {
  // allSettled: satu request gagal tidak menghalangi yang lain
  const [statusRes, l2tpRes, l2tpCfgRes, wgRes, wgCfgRes, instRes] = await Promise.allSettled([
    axios.get('/api/vpn/status'),
    axios.get('/api/vpn/l2tp/users'),
    axios.get('/api/vpn/l2tp/config'),
    axios.get('/api/vpn/wireguard/peers'),
    axios.get('/api/vpn/wireguard/config'),
    axios.get('/api/instances'),
  ])
  if (statusRes.status  === 'fulfilled') status.value       = statusRes.value.data
  if (l2tpRes.status    === 'fulfilled') l2tpUsers.value    = l2tpRes.value.data
  if (l2tpCfgRes.status === 'fulfilled') l2tpConfig.value   = l2tpCfgRes.value.data
  if (wgRes.status      === 'fulfilled') wgPeers.value      = wgRes.value.data
  if (wgCfgRes.status   === 'fulfilled') wgConfig.value     = wgCfgRes.value.data
  if (instRes.status    === 'fulfilled') instanceList.value = instRes.value.data

  loadingL2tp.value = false
  loadingWg.value   = false
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
    await axios.post('/api/vpn/l2tp/users', addL2tpForm.value)
    openAddL2tp.value = false
    addL2tpForm.value = { username: '', password: '', instance: '', note: '' }
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
    await axios.post('/api/vpn/wireguard/peers', addWgForm.value)
    openAddWg.value = false
    addWgForm.value = { name: '', instance: '', note: '' }
    await fetchAll()
  } catch (e) { addError.value = e.response?.data?.message || 'Gagal membuat peer.' }
  finally { addLoading.value = false }
}

async function deleteWgPeer(name) {
  if (!confirm(`Hapus WireGuard peer "${name}"?`)) return
  try { await axios.delete(`/api/vpn/wireguard/peers/${name}`); await fetchAll() }
  catch (e) { alert(e.response?.data?.message || 'Gagal hapus') }
}

async function showMikrotikConfig(type, name) {
  try {
    const url = type === 'l2tp' ? `/api/vpn/l2tp/mikrotik/${name}` : `/api/vpn/wireguard/mikrotik/${name}`
    const res = await axios.get(url)
    rosConfig.value = { ...res.data, name }
  } catch (e) { alert(e.response?.data?.message || 'Gagal load config') }
}

function genPass() {
  return Math.random().toString(36).slice(2, 9) + Math.random().toString(36).slice(2, 6).toUpperCase()
}

function copyText(txt) {
  navigator.clipboard.writeText(txt).then(() => { copied.value = true; setTimeout(() => copied.value = false, 2000) })
}

onMounted(fetchAll)
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
.rf-act-danger  { background: var(--danger-soft);  color: var(--danger);  border-color: rgba(255,94,94,.22); padding: 6px 8px; }
.rf-act-danger:hover:not(:disabled)  { background: rgba(255,94,94,.2); }

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
