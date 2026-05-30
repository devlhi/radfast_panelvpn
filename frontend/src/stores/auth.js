import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

// ─── Axios baseline — cookie-based auth ────────────────────────────────────
axios.defaults.timeout = 25_000
axios.defaults.withCredentials = true   // send/receive cookies cross-origin

// XSRF cookie/header pair (matches backend lib/csrf.js).
axios.defaults.xsrfCookieName  = 'XSRF-TOKEN'
axios.defaults.xsrfHeaderName  = 'X-CSRF-Token'

let interceptorsInstalled = false

export const useAuthStore = defineStore('auth', () => {
  const admin   = ref(safeParse(localStorage.getItem('rf_admin')))
  const lockout = ref(null)
  const ready   = ref(false)
  const challengeToken = ref('')   // 2FA partial-session
  const requires2FA    = ref(false)

  const isAuthenticated = computed(() => !!admin.value)
  const username = computed(() => admin.value?.username || '')
  const role     = computed(() => admin.value?.role || '')

  // ───────────────────────────────────────────────────────────────────────
  // Boot — fetch CSRF cookie then check session via /me.
  // ───────────────────────────────────────────────────────────────────────
  async function restore() {
    try {
      // Always issue/refresh a CSRF cookie so subsequent POSTs work.
      await axios.get('/api/auth/csrf').catch(() => {})

      const res = await axios.get('/api/auth/me')
      if (res.data?.admin) _persist(res.data.admin)
    } catch (e) {
      if (e?.response?.status === 401) _clear()
    } finally {
      ready.value = true
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Login — step 1 (password). Returns either { ok } or { requires2FA }.
  // ───────────────────────────────────────────────────────────────────────
  async function login(usernameInput, password) {
    lockout.value = null
    challengeToken.value = ''
    requires2FA.value = false

    // Make sure we have CSRF cookie before the POST.
    await axios.get('/api/auth/csrf').catch(() => {})

    try {
      const res = await axios.post('/api/auth/login', {
        username: usernameInput,
        password,
      })

      if (res.data?.requires2FA) {
        challengeToken.value = res.data.challengeToken
        requires2FA.value = true
        return { requires2FA: true }
      }

      _persist(res.data.admin)
      return { ok: true }
    } catch (e) {
      if (e?.response?.status === 429) {
        const retry = parseInt(e.response.headers?.['retry-after']) || 60
        lockout.value = {
          retryInSec: retry,
          message: e.response.data?.message
            || `Terlalu banyak percobaan. Coba lagi dalam ${retry} detik.`,
        }
      }
      throw e
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Login — step 2 (TOTP / recovery code).
  // ───────────────────────────────────────────────────────────────────────
  async function verify2FA(code) {
    if (!challengeToken.value) throw new Error('No challenge in progress')
    const res = await axios.post('/api/auth/verify-2fa', {
      challengeToken: challengeToken.value,
      code,
    })
    _persist(res.data.admin)
    challengeToken.value = ''
    requires2FA.value = false
    return res.data
  }

  function cancelChallenge() {
    challengeToken.value = ''
    requires2FA.value = false
  }

  // ───────────────────────────────────────────────────────────────────────
  // Logout — backend clears cookies + revokes JWT.
  // ───────────────────────────────────────────────────────────────────────
  async function logout({ silent = false } = {}) {
    if (!silent) {
      try { await axios.post('/api/auth/logout') } catch {}
    }
    _clear()
  }

  // ───────────────────────────────────────────────────────────────────────
  // 2FA management (post-login)
  // ───────────────────────────────────────────────────────────────────────
  async function setup2FA() {
    const res = await axios.post('/api/auth/2fa/setup')
    return res.data // { qrDataUrl, otpauthUrl, base32 }
  }

  async function enable2FA(code) {
    const res = await axios.post('/api/auth/2fa/enable', { code })
    if (admin.value) admin.value = { ...admin.value, twofaEnabled: true }
    return res.data // { ok, recoveryCodes }
  }

  async function disable2FA(password) {
    await axios.post('/api/auth/2fa/disable', { password })
    if (admin.value) admin.value = { ...admin.value, twofaEnabled: false }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Provisioning API key management
  // ───────────────────────────────────────────────────────────────────────
  async function getProvisioningKey() {
    const res = await axios.get('/api/auth/provisioning-key')
    return res.data // { enabled, source, masked, updatedAt, ageDays, maxAgeDays, expiresAt, rotateRecommended, expired, warning }
  }

  async function generateProvisioningKey() {
    const res = await axios.post('/api/auth/provisioning-key/generate')
    return res.data // { apiKey, mask, warning }
  }

  async function rotateProvisioningKey() {
    const res = await axios.post('/api/auth/provisioning-key/rotate')
    return res.data // { apiKey, mask, updatedAt, warning, expiresAt }
  }

  async function setProvisioningKey(apiKey) {
    const res = await axios.put('/api/auth/provisioning-key', { apiKey })
    return res.data // { ok, mask, updatedAt, expiresAt }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Internals
  // ───────────────────────────────────────────────────────────────────────
  function _persist(newAdmin) {
    admin.value = newAdmin
    localStorage.setItem('rf_admin', JSON.stringify(newAdmin))
  }

  function _clear() {
    admin.value = null
    localStorage.removeItem('rf_admin')
    challengeToken.value = ''
    requires2FA.value = false
  }

  function safeParse(raw) {
    try { return raw ? JSON.parse(raw) : null } catch { return null }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Global interceptor — auto-logout on 401, surface 429.
  // ───────────────────────────────────────────────────────────────────────
  function installInterceptors(router) {
    if (interceptorsInstalled) return
    interceptorsInstalled = true

    axios.interceptors.response.use(
      (res) => res,
      (err) => {
        const status = err?.response?.status
        const url    = err?.config?.url || ''
        const isAuthFlow =
          url.endsWith('/api/auth/login') ||
          url.endsWith('/api/auth/verify-2fa') ||
          url.endsWith('/api/auth/me')

        if (status === 401 && !isAuthFlow && admin.value) {
          _clear()
          if (router?.currentRoute?.value?.path !== '/login') {
            router?.push({ path: '/login', query: { reason: 'expired' } })
          }
        }
        if (status === 403 && err.response?.data?.message?.includes('CSRF')) {
          // Re-issue CSRF cookie and let the caller retry once.
          axios.get('/api/auth/csrf').catch(() => {})
        }
        if (status === 429) {
          const retry = parseInt(err.response.headers?.['retry-after']) || 60
          lockout.value = {
            retryInSec: retry,
            message: err.response.data?.message || `Rate limit. Tunggu ${retry} detik.`,
          }
        }
        return Promise.reject(err)
      },
    )
  }

  return {
    // state
    admin, lockout, ready, requires2FA, challengeToken,
    // computed
    isAuthenticated, username, role,
    // actions
    login, verify2FA, cancelChallenge, logout, restore, installInterceptors,
    setup2FA, enable2FA, disable2FA,
    getProvisioningKey, generateProvisioningKey, rotateProvisioningKey, setProvisioningKey,
  }
})
