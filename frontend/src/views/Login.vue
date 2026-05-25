<template>
  <div class="rf-login">
    <!-- Background mesh -->
    <div class="rf-bg-mesh">
      <div class="rf-orb rf-orb-1"></div>
      <div class="rf-orb rf-orb-2"></div>
      <div class="rf-orb rf-orb-3"></div>
      <div class="rf-grid"></div>
    </div>

    <!-- ═══ Left brand panel ═══ -->
    <aside class="rf-login-side">
      <div class="rf-side-top">
        <div class="rf-brand-logo">
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5z" fill="white"/>
            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <span class="rf-brand-name">RadFast ACS</span>
      </div>

      <div class="rf-side-content">
        <div class="rf-tag">
          <span class="dot dot-success"></span>
          v1.0 Enterprise Edition
        </div>
        <h2 class="rf-side-title">
          Multi-tenant <span class="rf-grad">GenieACS</span> command center for ISPs.
        </h2>
        <p class="rf-side-desc">
          Kelola ratusan instance, monitoring real-time, dan VPN ONT — semua dari satu dashboard yang clean dan cepat.
        </p>

        <ul class="rf-side-feats">
          <li>
            <span class="rf-feat-ic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
            Multi-instance GenieACS isolation
          </li>
          <li>
            <span class="rf-feat-ic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
            L2TP/IPsec & WireGuard VPN built-in
          </li>
          <li>
            <span class="rf-feat-ic"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>
            Live system metrics & service health
          </li>
        </ul>
      </div>

      <div class="rf-side-foot">
        © {{ year }} RadFast Bill — All rights reserved.
      </div>
    </aside>

    <!-- ═══ Right form ═══ -->
    <main class="rf-login-main">
      <div class="rf-login-card">
        <div class="rf-login-header">
          <h1>Welcome back</h1>
          <p>Masuk ke dashboard untuk melanjutkan.</p>
        </div>

        <Transition name="slide">
          <div v-if="error" class="rf-alert">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{{ error }}</span>
          </div>
        </Transition>

        <form v-if="!auth.requires2FA" @submit.prevent="handleLogin" class="rf-login-form">
          <div class="rf-field">
            <label>Username</label>
            <div class="rf-input">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <input v-model="form.username" type="text" placeholder="admin" autocomplete="username" :disabled="loading" />
            </div>
          </div>

          <div class="rf-field">
            <label>
              <span>Password</span>
              <a href="#" @click.prevent class="rf-forgot">Forgot?</a>
            </label>
            <div class="rf-input">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input v-model="form.password" :type="showPass ? 'text' : 'password'" placeholder="••••••••" autocomplete="current-password" :disabled="loading" />
              <button type="button" @click="showPass = !showPass" class="rf-eye" :title="showPass ? 'Hide' : 'Show'">
                <svg v-if="!showPass" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </button>
            </div>
          </div>

          <label class="rf-remember">
            <input type="checkbox" v-model="remember" />
            <span class="rf-checkbox"></span>
            <span>Keep me signed in</span>
          </label>

          <button type="submit" :disabled="loading" class="rf-submit">
            <span v-if="loading" class="rf-spinner" style="width:16px;height:16px;border-width:2px"></span>
            <span>{{ loading ? 'Signing in…' : 'Sign In' }}</span>
            <svg v-if="!loading" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        </form>

        <!-- ── 2FA challenge step ─────────────────────────────────────── -->
        <form v-else @submit.prevent="handle2FA" class="rf-login-form">
          <div class="rf-2fa-head">
            <div class="rf-2fa-ic">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h2>Verifikasi 2 langkah</h2>
            <p>Masukkan 6 digit kode dari authenticator app, atau gunakan recovery code (XXXX-XXXX-XXXX).</p>
          </div>

          <div class="rf-field">
            <label>Kode autentikasi</label>
            <div class="rf-input">
              <input v-model="twofaCode" type="text" placeholder="123456"
                     autocomplete="one-time-code" autofocus :disabled="loading"
                     maxlength="14" />
            </div>
          </div>

          <button type="submit" :disabled="loading" class="rf-submit">
            <span v-if="loading" class="rf-spinner" style="width:16px;height:16px;border-width:2px"></span>
            <span>{{ loading ? 'Verifying…' : 'Verifikasi' }}</span>
          </button>

          <button type="button" class="rf-cancel" @click="cancelChallenge" :disabled="loading">
            Kembali ke login
          </button>
        </form>

        <div class="rf-login-foot">
          Need help? <a href="#" @click.prevent>Contact administrator</a>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const form = ref({ username: '', password: '' })
const twofaCode = ref('')
const loading = ref(false)
const error = ref('')
const showPass = ref(false)
const remember = ref(true)
const year = computed(() => new Date().getFullYear())

// Show "session expired" hint when redirected by axios interceptor.
if (route.query.reason === 'expired') {
  error.value = 'Sesi berakhir. Silakan login kembali.'
}

async function handleLogin() {
  if (!form.value.username || !form.value.password) {
    error.value = 'Username dan password wajib diisi.'
    return
  }
  if (auth.lockout) {
    error.value = auth.lockout.message
    return
  }
  loading.value = true
  error.value = ''
  try {
    const res = await auth.login(form.value.username, form.value.password)
    if (res?.requires2FA) {
      // UI flips to 2FA step automatically via auth.requires2FA.
      twofaCode.value = ''
      return
    }
    router.push('/dashboard')
  } catch (e) {
    const status = e.response?.status
    if (status === 429) {
      error.value = auth.lockout?.message || 'Terlalu banyak percobaan login.'
    } else if (status === 400) {
      error.value = 'Format input tidak valid.'
    } else {
      error.value = e.response?.data?.message || 'Login gagal. Periksa username / password.'
    }
  } finally {
    loading.value = false
  }
}

async function handle2FA() {
  const code = twofaCode.value.trim()
  if (!code) { error.value = 'Masukkan kode 2FA.'; return }
  loading.value = true
  error.value = ''
  try {
    await auth.verify2FA(code)
    router.push('/dashboard')
  } catch (e) {
    const status = e.response?.status
    if (status === 401) {
      error.value = e.response?.data?.message || 'Kode 2FA salah.'
    } else if (status === 429) {
      error.value = 'Terlalu banyak percobaan. Login ulang.'
      auth.cancelChallenge()
    } else {
      error.value = 'Verifikasi 2FA gagal.'
    }
  } finally {
    loading.value = false
  }
}

function cancelChallenge() {
  auth.cancelChallenge()
  twofaCode.value = ''
  error.value = ''
}
</script>

<style scoped>
.rf-login {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  background: var(--bg-base);
}

/* ─── Background mesh ─── */
.rf-bg-mesh {
  position: absolute; inset: 0;
  pointer-events: none;
  overflow: hidden;
}
.rf-orb { position: absolute; border-radius: 99px; filter: blur(80px); opacity: .35; }
.rf-orb-1 { width: 500px; height: 500px; background: #605dff; top: -150px; left: -120px; }
.rf-orb-2 { width: 420px; height: 420px; background: #a974ff; bottom: -120px; left: 35%; opacity: .25; }
.rf-orb-3 { width: 380px; height: 380px; background: #1abc9c; bottom: -100px; right: -100px; opacity: .15; }
.rf-grid {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(var(--border) 1px, transparent 1px),
    linear-gradient(90deg, var(--border) 1px, transparent 1px);
  background-size: 56px 56px;
  opacity: .25;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
}

/* ─── Side panel ─── */
.rf-login-side {
  position: relative;
  z-index: 2;
  display: flex; flex-direction: column;
  padding: 36px 44px;
  border-right: 1px solid var(--border);
}
.rf-side-top {
  display: flex; align-items: center; gap: 12px;
}
.rf-brand-logo {
  width: 40px; height: 40px;
  border-radius: 11px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #605dff, #4b48d6);
  box-shadow: 0 6px 20px rgba(96,93,255,.45);
}
.rf-brand-name {
  font-size: 16px; font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -.01em;
}
.rf-side-content {
  flex: 1;
  display: flex; flex-direction: column; justify-content: center;
  max-width: 460px;
}
.rf-tag {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 5px 12px;
  border-radius: 99px;
  background: var(--success-soft);
  border: 1px solid rgba(26,188,156,.22);
  color: var(--success);
  font-size: 11.5px; font-weight: 600;
  width: fit-content;
}
.rf-side-title {
  margin-top: 20px;
  font-size: 38px; line-height: 1.15; font-weight: 800;
  letter-spacing: -.025em;
  color: var(--text-primary);
}
.rf-grad {
  background: linear-gradient(120deg, #605dff 0%, #a974ff 50%, #1abc9c 100%);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.rf-side-desc {
  margin-top: 16px;
  font-size: 14.5px; line-height: 1.6;
  color: var(--text-secondary);
}
.rf-side-feats {
  list-style: none;
  margin-top: 28px;
  display: flex; flex-direction: column; gap: 12px;
}
.rf-side-feats li {
  display: flex; align-items: center; gap: 12px;
  font-size: 13.5px;
  color: var(--text-primary);
}
.rf-feat-ic {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px;
  border-radius: 7px;
  background: var(--accent-soft);
  color: var(--accent);
  flex-shrink: 0;
}
.rf-side-foot {
  font-size: 12px; color: var(--text-muted);
}

/* ─── Form ─── */
.rf-login-main {
  position: relative;
  z-index: 2;
  display: flex; align-items: center; justify-content: center;
  padding: 36px;
}
.rf-login-card {
  width: 100%;
  max-width: 420px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--r-xl);
  padding: 36px 32px;
  box-shadow: var(--shadow-modal);
}
.rf-login-header h1 {
  font-size: 24px; font-weight: 700;
  letter-spacing: -.02em;
  color: var(--text-primary);
}
.rf-login-header p {
  font-size: 13.5px; color: var(--text-secondary);
  margin-top: 6px;
}

.rf-alert {
  display: flex; align-items: center; gap: 10px;
  margin-top: 22px;
  padding: 11px 14px;
  border-radius: 10px;
  background: var(--danger-soft);
  border: 1px solid rgba(255,94,94,.22);
  color: var(--danger);
  font-size: 12.5px;
}
.rf-alert svg { flex-shrink: 0; }

.rf-login-form {
  margin-top: 26px;
  display: flex; flex-direction: column; gap: 16px;
}
.rf-field { display: flex; flex-direction: column; gap: 7px; }
.rf-field label {
  font-size: 12.5px; font-weight: 600;
  color: var(--text-secondary);
  display: flex; align-items: center; justify-content: space-between;
}
.rf-forgot {
  font-size: 11.5px;
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
}
.rf-forgot:hover { color: var(--accent-hover); }

.rf-input {
  display: flex; align-items: center; gap: 10px;
  padding: 0 12px;
  background: var(--bg-input);
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  transition: border-color .15s, box-shadow .15s;
}
.rf-input:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-ring);
}
.rf-input svg { color: var(--text-muted); flex-shrink: 0; }
.rf-input input {
  flex: 1; min-width: 0;
  background: transparent;
  border: none; outline: none;
  padding: 12px 0;
  font-size: 13.5px;
  color: var(--text-primary);
}
.rf-input input:focus { background: transparent; box-shadow: none; }
.rf-eye {
  background: transparent; border: none;
  color: var(--text-muted);
  display: flex; align-items: center;
  padding: 4px;
  border-radius: 6px;
}
.rf-eye:hover { color: var(--text-primary); background: var(--bg-elevated); }

.rf-remember {
  display: flex; align-items: center; gap: 10px;
  font-size: 12.5px;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}
.rf-remember input { display: none; }
.rf-checkbox {
  width: 17px; height: 17px;
  border-radius: 5px;
  background: var(--bg-input);
  border: 1.5px solid var(--border-strong);
  display: inline-flex; align-items: center; justify-content: center;
  transition: all .15s;
  flex-shrink: 0;
  position: relative;
}
.rf-remember input:checked + .rf-checkbox {
  background: var(--accent);
  border-color: var(--accent);
}
.rf-remember input:checked + .rf-checkbox::after {
  content: '';
  width: 9px; height: 5px;
  border-left: 2px solid #fff; border-bottom: 2px solid #fff;
  transform: rotate(-45deg) translate(1px, -1px);
}

.rf-submit {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  margin-top: 6px;
  padding: 13px 20px;
  background: var(--accent);
  color: #fff;
  font-size: 13.5px; font-weight: 600;
  border: none; border-radius: 10px;
  transition: background .15s, transform .1s, box-shadow .15s;
  box-shadow: 0 4px 18px rgba(96,93,255,.4);
}
.rf-submit:hover:not(:disabled) { background: var(--accent-hover); }
.rf-submit:active:not(:disabled) { transform: translateY(1px); }
.rf-submit:disabled { opacity: .65; }

/* ─── 2FA challenge step ─── */
.rf-2fa-head { text-align: center; margin-bottom: 4px; }
.rf-2fa-ic {
  width: 44px; height: 44px;
  margin: 0 auto 12px;
  display: grid; place-items: center;
  background: rgba(96,93,255,.1);
  color: var(--accent);
  border-radius: 12px;
}
.rf-2fa-head h2 {
  font-size: 18px; font-weight: 600;
  margin: 0 0 4px;
  color: var(--text-strong);
}
.rf-2fa-head p {
  font-size: 12.5px;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.5;
}
.rf-cancel {
  margin-top: 4px;
  background: transparent;
  color: var(--text-muted);
  border: none;
  font-size: 12.5px;
  cursor: pointer;
  padding: 8px;
}
.rf-cancel:hover:not(:disabled) { color: var(--text-strong); }

.rf-login-foot {
  margin-top: 24px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
}
.rf-login-foot a {
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
}
.rf-login-foot a:hover { color: var(--accent-hover); }

/* ─── Responsive ─── */
@media (max-width: 960px) {
  .rf-login { grid-template-columns: 1fr; }
  .rf-login-side { display: none; }
}
</style>
