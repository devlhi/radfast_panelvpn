<template>
  <div class="rf-shell">

    <!-- ═══════════ SIDEBAR ═══════════ -->
    <aside class="rf-sidebar">
      <!-- Brand -->
      <div class="rf-brand">
        <div class="rf-brand-logo">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white"/>
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="min-w-0">
          <div class="rf-brand-name">RadFast ACS</div>
          <div class="rf-brand-sub">Admin Console</div>
        </div>
      </div>

      <!-- Nav sections -->
      <nav class="rf-nav">
        <div v-for="section in navSections" :key="section.label" class="rf-nav-section">
          <div class="rf-nav-label">{{ section.label }}</div>
          <RouterLink v-for="item in section.items" :key="item.path" :to="item.path"
            class="rf-nav-item" :class="{ 'is-active': isActive(item.path) }">
            <span class="rf-nav-icon" v-html="item.icon"></span>
            <span class="rf-nav-text">{{ item.label }}</span>
            <span v-if="item.badge" class="rf-nav-badge">{{ item.badge }}</span>
          </RouterLink>
        </div>
      </nav>

      <!-- Footer -->
      <div class="rf-side-foot">
        <div class="rf-user-card">
          <div class="avatar" style="width:34px;height:34px;font-size:12px">{{ adminInitial }}</div>
          <div class="flex-1 min-w-0">
            <div class="text-[12.5px] font-semibold truncate" style="color:var(--text-primary)">
              {{ auth.admin?.username || 'Admin' }}
            </div>
            <div class="text-[10.5px]" style="color:var(--text-muted)">Super Administrator</div>
          </div>
          <button @click="handleLogout" class="rf-logout" title="Logout">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>

    <!-- ═══════════ MAIN ═══════════ -->
    <div class="rf-main">

      <!-- Topbar -->
      <header class="rf-topbar">
        <div class="rf-topbar-left">
          <h1 class="rf-page-title">{{ currentPageTitle }}</h1>
          <div class="rf-breadcrumb">
            <span>Dashboard</span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            <span class="rf-crumb-current">{{ currentPageTitle }}</span>
          </div>
        </div>
        <div class="rf-topbar-right">
          <div class="rf-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="Search..." />
            <kbd>⌘K</kbd>
          </div>
          <div class="rf-status-pill">
            <span class="dot dot-success"></span>
            <span>System Online</span>
          </div>
          <div class="rf-icon-btn" title="Notifications">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span class="rf-icon-dot"></span>
          </div>
        </div>
      </header>

      <!-- Page -->
      <main class="rf-page">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const ico = {
  dashboard: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>`,
  server:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>`,
  shield:    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
  activity:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`,
  lock:      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  cloud:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><path d="m9 13 2 2 4-4"/></svg>`,
  book:      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
}

const navSections = [
  {
    label: 'Main Menu',
    items: [
      { path: '/dashboard', icon: ico.dashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Management',
    items: [
      { path: '/instances', icon: ico.server,   label: 'Instances' },
      { path: '/vpn',       icon: ico.shield,   label: 'VPN Manager' },
      { path: '/api-vpn',   icon: ico.cloud,    label: 'VPN dari API' },
    ],
  },
  {
    label: 'System',
    items: [
      { path: '/monitor',  icon: ico.activity, label: 'Live Monitor' },
      { path: '/security', icon: ico.shield,   label: 'Security Log' },
      { path: '/settings', icon: ico.lock,     label: 'Security' },
      { path: '/api-docs', icon: ico.book,     label: 'Dokumentasi API' },
    ],
  },
]

const pageMeta = {
  '/dashboard': 'Dashboard',
  '/instances': 'Instance Manager',
  '/vpn':       'VPN Manager',
  '/api-vpn':   'VPN dari API',
  '/monitor':   'System Monitor',
  '/security':  'Security Log',
  '/settings':  'Security Settings',
  '/api-docs':  'Dokumentasi API',
}

const currentPageTitle = computed(() => pageMeta[route.path] || 'RadFast Admin')
const adminInitial     = computed(() => auth.admin?.username?.charAt(0).toUpperCase() || 'A')
const isActive         = (path) => route.path === path

function handleLogout() {
  auth.logout().finally(() => router.push('/login'))
}
</script>

<style scoped>
/* ═══ Shell ═══ */
.rf-shell {
  display: flex;
  min-height: 100vh;
  background: var(--bg-base);
}

/* ═══ Sidebar ═══ */
.rf-sidebar {
  position: fixed;
  top: 0; left: 0; bottom: 0;
  width: 256px;
  background: var(--bg-surface);
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
  z-index: 30;
}

.rf-brand {
  display: flex; align-items: center; gap: 12px;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
  height: 68px;
  flex-shrink: 0;
}
.rf-brand-logo {
  width: 36px; height: 36px;
  border-radius: 10px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #605dff 0%, #4b48d6 100%);
  box-shadow: 0 4px 14px rgba(96,93,255,.4);
  flex-shrink: 0;
}
.rf-brand-name {
  font-size: 15px; font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -.01em;
  line-height: 1.2;
}
.rf-brand-sub {
  font-size: 11px; color: var(--text-muted);
  margin-top: 2px;
  letter-spacing: .01em;
}

.rf-nav {
  flex: 1;
  padding: 16px 12px;
  overflow-y: auto;
}
.rf-nav-section + .rf-nav-section { margin-top: 18px; }

.rf-nav-label {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--text-muted);
  padding: 0 12px;
  margin-bottom: 6px;
}

.rf-nav-item {
  display: flex; align-items: center; gap: 12px;
  padding: 9px 12px;
  border-radius: 10px;
  font-size: 13.5px; font-weight: 500;
  color: var(--text-secondary);
  text-decoration: none;
  transition: background .15s, color .15s;
  margin-bottom: 2px;
  position: relative;
}
.rf-nav-item:hover {
  background: var(--bg-elevated);
  color: var(--text-primary);
}
.rf-nav-item.is-active {
  background: var(--accent);
  color: #fff;
  box-shadow: 0 4px 14px rgba(96,93,255,.35);
}
.rf-nav-item.is-active .rf-nav-icon { color: #fff; }
.rf-nav-icon {
  display: inline-flex;
  width: 18px; height: 18px;
  align-items: center; justify-content: center;
  color: var(--text-muted);
  flex-shrink: 0;
  transition: color .15s;
}
.rf-nav-item:hover .rf-nav-icon { color: var(--accent); }
.rf-nav-text { flex: 1; }
.rf-nav-badge {
  font-size: 10px; font-weight: 700;
  padding: 1px 7px;
  border-radius: 99px;
  background: rgba(255,255,255,.15);
  color: #fff;
}

.rf-side-foot {
  border-top: 1px solid var(--border);
  padding: 12px;
  flex-shrink: 0;
}
.rf-user-card {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
}
.rf-logout {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  border: 1px solid transparent;
  transition: all .15s;
}
.rf-logout:hover {
  background: var(--danger-soft);
  color: var(--danger);
  border-color: rgba(255,94,94,.2);
}

/* ═══ Main ═══ */
.rf-main {
  flex: 1;
  margin-left: 256px;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

/* ═══ Topbar ═══ */
.rf-topbar {
  position: sticky; top: 0; z-index: 20;
  display: flex; align-items: center; justify-content: space-between;
  height: 68px;
  padding: 0 28px;
  background: rgba(10,14,28,.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border);
}

.rf-page-title {
  font-size: 18px; font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -.015em;
  line-height: 1.2;
}
.rf-breadcrumb {
  display: flex; align-items: center; gap: 6px;
  margin-top: 3px;
  font-size: 12px;
  color: var(--text-muted);
}
.rf-breadcrumb svg { color: var(--text-muted); opacity: .6; }
.rf-crumb-current { color: var(--text-secondary); font-weight: 500; }

.rf-topbar-right {
  display: flex; align-items: center; gap: 12px;
}

.rf-search {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  width: 280px;
  transition: border-color .15s;
}
.rf-search:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-ring);
}
.rf-search svg { color: var(--text-muted); flex-shrink: 0; }
.rf-search input {
  flex: 1; min-width: 0;
  background: transparent; border: none; outline: none;
  font-size: 13px;
  color: var(--text-primary);
  padding: 0;
}
.rf-search input:focus { background: transparent; box-shadow: none; }
.rf-search kbd {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 5px;
  background: var(--bg-base);
  border: 1px solid var(--border-strong);
  color: var(--text-muted);
}

.rf-status-pill {
  display: flex; align-items: center; gap: 7px;
  padding: 6px 12px;
  background: var(--success-soft);
  border: 1px solid rgba(26,188,156,.22);
  border-radius: 99px;
  font-size: 11.5px; font-weight: 600;
  color: var(--success);
}

.rf-icon-btn {
  position: relative;
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all .15s;
}
.rf-icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--border-strong);
}
.rf-icon-dot {
  position: absolute;
  top: 8px; right: 8px;
  width: 7px; height: 7px;
  border-radius: 99px;
  background: var(--danger);
  border: 2px solid var(--bg-surface);
}

/* ═══ Page content ═══ */
.rf-page {
  flex: 1;
  padding: 28px;
  min-width: 0;
  overflow-x: auto;
}

@media (max-width: 1024px) {
  .rf-search { width: 200px; }
}
@media (max-width: 768px) {
  .rf-search { display: none; }
}
</style>
