<template>
  <div class="rf-settings">
    <header class="rf-page-head">
      <h1>Security Settings</h1>
      <p>Akun: <strong>{{ auth.username }}</strong></p>
    </header>

    <!-- ═══ Change Password Card ════════════════════════════════════════ -->
    <section class="rf-card" style="margin-bottom: 24px;">
      <div class="rf-card-head">
        <div>
          <h2>Ganti Password Admin</h2>
          <p>Update password login dashboard. Wajib login ulang setelah berhasil.</p>
        </div>
      </div>

      <div class="rf-card-body">
        <p class="rf-help">
          Aturan password: minimal 12 karakter, mengandung huruf besar, huruf kecil, angka, dan simbol.
        </p>

        <div class="rf-pwd-form">
          <label class="rf-field">
            <span>Password lama</span>
            <input v-model="pwdForm.current" type="password" autocomplete="current-password"
                   class="rf-input-text" :disabled="pwdBusy" />
          </label>

          <label class="rf-field">
            <span>Password baru</span>
            <input v-model="pwdForm.next" type="password" autocomplete="new-password"
                   class="rf-input-text" :disabled="pwdBusy" />
          </label>

          <label class="rf-field">
            <span>Konfirmasi password baru</span>
            <input v-model="pwdForm.confirm" type="password" autocomplete="new-password"
                   class="rf-input-text" :disabled="pwdBusy" />
          </label>

          <label v-if="auth.admin?.twofaEnabled" class="rf-field">
            <span>Kode 2FA (6 digit / recovery code)</span>
            <input v-model="pwdForm.twofa" type="text" maxlength="32"
                   autocomplete="one-time-code" class="rf-input-text" :disabled="pwdBusy" />
          </label>

          <div class="rf-actions">
            <button class="rf-btn rf-btn-primary" @click="submitChangePassword" :disabled="pwdBusy">
              {{ pwdBusy ? 'Menyimpan…' : 'Ganti password' }}
            </button>
            <button class="rf-btn rf-btn-ghost" @click="resetPwdForm" :disabled="pwdBusy">
              Reset
            </button>
          </div>

          <p v-if="pwdError" class="rf-err">{{ pwdError }}</p>
          <p v-if="pwdSuccess" class="rf-help" style="color:var(--success);">{{ pwdSuccess }}</p>
        </div>
      </div>
    </section>

    <!-- ═══ 2FA Card ═════════════════════════════════════════════════════ -->
    <section class="rf-card">
      <div class="rf-card-head">
        <div>
          <h2>Two-Factor Authentication</h2>
          <p>Tambahkan lapisan keamanan kedua menggunakan authenticator app.</p>
        </div>
        <span class="rf-badge" :class="auth.admin?.twofaEnabled ? 'rf-badge-on' : 'rf-badge-off'">
          {{ auth.admin?.twofaEnabled ? 'Aktif' : 'Nonaktif' }}
        </span>
      </div>

      <!-- ─── Disabled state: show enrollment flow ─── -->
      <div v-if="!auth.admin?.twofaEnabled" class="rf-2fa-flow">
        <div v-if="!enrollment" class="rf-card-body">
          <p class="rf-help">
            Direkomendasikan: gunakan <strong>Google Authenticator</strong>,
            <strong>Authy</strong>, atau <strong>1Password</strong>.
          </p>
          <button class="rf-btn rf-btn-primary" @click="startEnroll" :disabled="busy">
            {{ busy ? 'Loading…' : 'Aktifkan 2FA' }}
          </button>
        </div>

        <div v-else class="rf-2fa-enroll">
          <ol class="rf-steps">
            <li>
              <h4>1. Scan QR code</h4>
              <img :src="enrollment.qrDataUrl" alt="QR Code" class="rf-qr" />
              <details class="rf-manual">
                <summary>Atau masukkan secret manual</summary>
                <code class="rf-secret">{{ enrollment.base32 }}</code>
              </details>
            </li>
            <li>
              <h4>2. Masukkan 6 digit kode dari app</h4>
              <input v-model="enrollCode" type="text" maxlength="6" placeholder="123456"
                     autocomplete="one-time-code" class="rf-input-code" />
              <div class="rf-actions">
                <button class="rf-btn rf-btn-primary" @click="confirmEnable" :disabled="busy">
                  {{ busy ? 'Verifying…' : 'Verifikasi & aktifkan' }}
                </button>
                <button class="rf-btn rf-btn-ghost" @click="cancelEnroll" :disabled="busy">Batal</button>
              </div>
            </li>
          </ol>

          <p v-if="enrollError" class="rf-err">{{ enrollError }}</p>
        </div>

        <!-- Recovery codes shown ONCE after success -->
        <div v-if="recoveryCodes.length" class="rf-recovery">
          <h4>📋 Recovery Codes</h4>
          <p class="rf-help">
            Simpan baik-baik. Setiap code hanya bisa dipakai 1×. Tanpa code ini
            dan tanpa app authenticator, akun tidak bisa diakses.
          </p>
          <div class="rf-codes">
            <code v-for="c in recoveryCodes" :key="c">{{ c }}</code>
          </div>
          <button class="rf-btn rf-btn-ghost" @click="copyCodes">📋 Copy semua</button>
          <button class="rf-btn rf-btn-primary" @click="dismissCodes">Saya sudah simpan</button>
        </div>
      </div>

      <!-- ─── Enabled state: show disable option ─── -->
      <div v-else class="rf-card-body">
        <p class="rf-help">
          2FA aktif. Recovery codes tersisa:
          <strong>{{ auth.admin?.recoveryRemaining ?? '—' }}</strong>
        </p>
        <div v-if="!showDisable">
          <button class="rf-btn rf-btn-danger" @click="showDisable = true">
            Nonaktifkan 2FA
          </button>
        </div>
        <div v-else class="rf-disable-form">
          <p class="rf-help">Konfirmasi password untuk nonaktifkan 2FA:</p>
          <input v-model="disablePass" type="password" placeholder="Password admin"
                 class="rf-input-text" />
          <div class="rf-actions">
            <button class="rf-btn rf-btn-danger" @click="confirmDisable" :disabled="busy">
              {{ busy ? 'Memproses…' : 'Konfirmasi nonaktifkan' }}
            </button>
            <button class="rf-btn rf-btn-ghost" @click="showDisable = false; disablePass=''" :disabled="busy">
              Batal
            </button>
          </div>
          <p v-if="disableError" class="rf-err">{{ disableError }}</p>
        </div>
      </div>
    </section>

    <!-- ═══ Provisioning API Key Card ════════════════════════════════════ -->
    <section class="rf-card" style="margin-top: 24px;">
      <div class="rf-card-head">
        <div>
          <h2>Provisioning API Key</h2>
          <p>Key untuk billing/portal membuat instance GenieACS lewat API (header <code>X-API-Key</code>).</p>
        </div>
        <span class="rf-badge" :class="keyMeta.enabled ? 'rf-badge-on' : 'rf-badge-off'">
          {{ keyMeta.enabled ? 'Aktif' : 'Belum diset' }}
        </span>
      </div>

      <div class="rf-card-body">
        <p class="rf-help" v-if="keyMeta.enabled">
          Key aktif: <code class="rf-secret">{{ keyMeta.masked }}</code>
          <template v-if="keyMeta.source"> · sumber: <strong>{{ keyMeta.source }}</strong></template>
          <template v-if="keyMeta.updatedAt"> · diubah: {{ formatDate(keyMeta.updatedAt) }}</template>
          <template v-if="keyMeta.ageDays !== null"> · umur: <strong>{{ keyMeta.ageDays }} hari</strong></template>
          <template v-if="keyMeta.expiresAt"> · kadaluarsa: {{ formatDate(keyMeta.expiresAt) }}</template>
        </p>
        <p v-if="keyMeta.warning" class="rf-help" :style="{ color: keyMeta.expired ? 'var(--danger)' : 'var(--warning)' }">
          ⚠️ {{ keyMeta.warning }}
        </p>
        <p class="rf-help" v-else>
          Belum ada API key. Generate otomatis atau masukkan manual (minimal 32 karakter).
        </p>

        <!-- Newly generated key shown ONCE -->
        <div v-if="newKey" class="rf-recovery">
          <h4>🔑 API Key Baru</h4>
          <p class="rf-help">{{ newKeyWarning }}</p>
          <code class="rf-secret" style="display:block; word-break:break-all; margin:10px 0;">{{ newKey }}</code>
          <div class="rf-actions">
            <button class="rf-btn rf-btn-ghost" @click="copyNewKey">📋 Copy key</button>
            <button class="rf-btn rf-btn-primary" @click="dismissNewKey">Saya sudah simpan</button>
          </div>
          <p v-if="copyOk" class="rf-help" style="color:var(--success);">Tersalin ke clipboard.</p>
        </div>

        <template v-else>
          <div class="rf-actions">
            <button class="rf-btn rf-btn-primary" @click="generateKey" :disabled="keyBusy">
              {{ keyBusy ? 'Memproses…' : (keyMeta.enabled ? 'Generate ulang' : 'Generate key') }}
            </button>
            <button class="rf-btn rf-btn-ghost" @click="rotateKey" :disabled="keyBusy || !keyMeta.enabled">
              {{ keyBusy ? 'Memproses…' : 'Rotate key' }}
            </button>
            <button class="rf-btn rf-btn-ghost" @click="showManual = !showManual" :disabled="keyBusy">
              {{ showManual ? 'Tutup input manual' : 'Set manual' }}
            </button>
          </div>

          <div v-if="showManual" class="rf-disable-form" style="max-width:100%;">
            <p class="rf-help">Masukkan API key (min. 32 karakter):</p>
            <input v-model="manualKey" type="text" placeholder="rfprov_…"
                   class="rf-input-text" style="max-width:100%;" />
            <div class="rf-actions">
              <button class="rf-btn rf-btn-primary" @click="saveManualKey" :disabled="keyBusy">
                {{ keyBusy ? 'Menyimpan…' : 'Simpan key' }}
              </button>
              <button class="rf-btn rf-btn-ghost" @click="showManual=false; manualKey=''" :disabled="keyBusy">
                Batal
              </button>
            </div>
          </div>
        </template>

        <p v-if="keyError" class="rf-err">{{ keyError }}</p>
      </div>
    </section>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const busy = ref(false)
const enrollment = ref(null)
const enrollCode = ref('')
const enrollError = ref('')
const recoveryCodes = ref([])
const showDisable = ref(false)
const disablePass = ref('')
const disableError = ref('')

// ─── Change password state ───
const pwdForm = reactive({ current: '', next: '', confirm: '', twofa: '' })
const pwdBusy = ref(false)
const pwdError = ref('')
const pwdSuccess = ref('')

// ─── Provisioning API key state ───
const keyMeta = ref({
  enabled: false,
  source: 'none',
  masked: '',
  updatedAt: null,
  ageDays: null,
  maxAgeDays: null,
  warnAgeDays: null,
  expiresAt: null,
  rotateRecommended: false,
  expired: false,
  warning: '',
})
const keyBusy = ref(false)
const keyError = ref('')
const showManual = ref(false)
const manualKey = ref('')
const newKey = ref('')
const newKeyWarning = ref('')
const copyOk = ref(false)

onMounted(loadKeyMeta)

function resetPwdForm() {
  pwdForm.current = ''
  pwdForm.next = ''
  pwdForm.confirm = ''
  pwdForm.twofa = ''
  pwdError.value = ''
  pwdSuccess.value = ''
}

async function submitChangePassword() {
  if (!pwdForm.current || !pwdForm.next || !pwdForm.confirm) {
    pwdError.value = 'Mohon isi password lama, baru, dan konfirmasi.'
    return
  }
  if (pwdForm.next !== pwdForm.confirm) {
    pwdError.value = 'Konfirmasi password baru tidak cocok.'
    return
  }
  if (auth.admin?.twofaEnabled && !pwdForm.twofa) {
    pwdError.value = 'Kode 2FA wajib diisi.'
    return
  }

  pwdBusy.value = true
  pwdError.value = ''
  pwdSuccess.value = ''
  try {
    const res = await auth.changePassword({
      currentPassword: pwdForm.current,
      newPassword: pwdForm.next,
      confirmPassword: pwdForm.confirm,
      twofaCode: pwdForm.twofa
    })
    pwdSuccess.value = res.message || 'Password berhasil diganti. Mengalihkan...'
    setTimeout(() => {
      router.push('/login')
    }, 1500)
  } catch (e) {
    pwdError.value = e.response?.data?.message || 'Gagal mengganti password.'
  } finally {
    pwdBusy.value = false
  }
}

async function loadKeyMeta() {
  try {
    keyMeta.value = await auth.getProvisioningKey()
  } catch (e) {
    keyError.value = e.response?.data?.message || 'Gagal memuat status API key.'
  }
}

async function generateKey() {
  keyBusy.value = true
  keyError.value = ''
  try {
    const res = await auth.generateProvisioningKey()
    newKey.value = res.apiKey
    newKeyWarning.value = res.warning || 'Simpan key ini sekarang.'
    showManual.value = false
    await loadKeyMeta()
  } catch (e) {
    keyError.value = e.response?.data?.message || 'Gagal generate API key.'
  } finally {
    keyBusy.value = false
  }
}

async function rotateKey() {
  keyBusy.value = true
  keyError.value = ''
  try {
    const res = await auth.rotateProvisioningKey()
    newKey.value = res.apiKey
    newKeyWarning.value = res.warning || 'Key berhasil di-rotate. Simpan key baru sekarang.'
    showManual.value = false
    await loadKeyMeta()
  } catch (e) {
    keyError.value = e.response?.data?.message || 'Gagal rotate API key.'
  } finally {
    keyBusy.value = false
  }
}

async function saveManualKey() {
  const key = manualKey.value.trim()
  if (key.length < 32) {
    keyError.value = 'API key minimal 32 karakter.'
    return
  }
  keyBusy.value = true
  keyError.value = ''
  try {
    await auth.setProvisioningKey(key)
    manualKey.value = ''
    showManual.value = false
    await loadKeyMeta()
  } catch (e) {
    keyError.value = e.response?.data?.message || 'Gagal menyimpan API key.'
  } finally {
    keyBusy.value = false
  }
}

async function copyNewKey() {
  try {
    await navigator.clipboard.writeText(newKey.value)
    copyOk.value = true
  } catch {}
}

function dismissNewKey() {
  newKey.value = ''
  newKeyWarning.value = ''
  copyOk.value = false
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString('id-ID')
  } catch {
    return iso
  }
}

async function startEnroll() {
  busy.value = true
  enrollError.value = ''
  try {
    enrollment.value = await auth.setup2FA()
  } catch (e) {
    enrollError.value = e.response?.data?.message || 'Gagal memulai enrollment.'
  } finally {
    busy.value = false
  }
}

function cancelEnroll() {
  enrollment.value = null
  enrollCode.value = ''
  enrollError.value = ''
}

async function confirmEnable() {
  const code = enrollCode.value.trim()
  if (!/^\d{6}$/.test(code)) {
    enrollError.value = 'Kode harus 6 digit.'
    return
  }
  busy.value = true
  enrollError.value = ''
  try {
    const res = await auth.enable2FA(code)
    recoveryCodes.value = res.recoveryCodes || []
    enrollment.value = null
    enrollCode.value = ''
  } catch (e) {
    enrollError.value = e.response?.data?.message || 'Verifikasi gagal.'
  } finally {
    busy.value = false
  }
}

function dismissCodes() {
  recoveryCodes.value = []
}

async function copyCodes() {
  try {
    await navigator.clipboard.writeText(recoveryCodes.value.join('\n'))
  } catch {}
}

async function confirmDisable() {
  if (!disablePass.value) {
    disableError.value = 'Password wajib.'
    return
  }
  busy.value = true
  disableError.value = ''
  try {
    await auth.disable2FA(disablePass.value)
    showDisable.value = false
    disablePass.value = ''
  } catch (e) {
    disableError.value = e.response?.data?.message || 'Gagal menonaktifkan 2FA.'
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.rf-settings { max-width: 720px; margin: 0 auto; padding: 24px; }
.rf-page-head { margin-bottom: 24px; }
.rf-page-head h1 { font-size: 22px; font-weight: 600; margin: 0 0 4px; color: var(--text-primary); }
.rf-page-head p { color: var(--text-muted); font-size: 13px; margin: 0; }

.rf-card {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 20px;
}
.rf-card-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}
.rf-card-head h2 { font-size: 16px; font-weight: 600; margin: 0 0 4px; color: var(--text-primary); }
.rf-card-head p  { font-size: 12.5px; color: var(--text-secondary); margin: 0; }
.rf-card-body { display: flex; flex-direction: column; gap: 12px; }

.rf-badge {
  font-size: 11px; font-weight: 600;
  padding: 4px 10px; border-radius: 99px;
  text-transform: uppercase; letter-spacing: .04em;
}
.rf-badge-on  { background: rgba(26,188,156,.12); color: #1abc9c; border: 1px solid rgba(26,188,156,.2); }
.rf-badge-off { background: rgba(255,94,94,.12); color: #ff5e5e; border: 1px solid rgba(255,94,94,.2); }

.rf-help { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
.rf-err  { font-size: 12.5px; color: #ff5e5e; margin-top: 8px; }

.rf-btn {
  font-size: 13px; font-weight: 500;
  padding: 9px 16px; border-radius: 9px; border: 1px solid transparent;
  cursor: pointer; transition: all .15s;
  display: inline-flex; align-items: center; gap: 6px;
}
.rf-btn:disabled { opacity: .6; cursor: not-allowed; }
.rf-btn-primary { background: var(--accent); color: #fff; }
.rf-btn-primary:hover:not(:disabled) { background: var(--accent-hover); }
.rf-btn-ghost   { background: transparent; color: var(--text-secondary); border-color: var(--border); }
.rf-btn-ghost:hover:not(:disabled) { background: var(--bg-hover); color: var(--text-primary); }
.rf-btn-danger  { background: rgba(255,94,94,.12); color: #ff5e5e; border-color: rgba(255,94,94,.22); }
.rf-btn-danger:hover:not(:disabled) { background: rgba(255,94,94,.2); }

.rf-2fa-enroll { display: flex; flex-direction: column; gap: 16px; }
.rf-steps { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 24px; }
.rf-steps li h4 { font-size: 13.5px; font-weight: 600; margin: 0 0 10px; color: var(--text-primary); }

.rf-qr {
  width: 180px; height: 180px; display: block;
  border: 1px solid var(--border); border-radius: 8px;
  padding: 8px; background: #fff;
}
.rf-manual { margin-top: 10px; }
.rf-manual summary { font-size: 12px; color: var(--text-secondary); cursor: pointer; }
.rf-secret {
  display: inline-block; margin-top: 6px;
  padding: 6px 10px;
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-primary);
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 12px; letter-spacing: .04em;
}

.rf-input-code, .rf-input-text {
  width: 100%; max-width: 280px;
  padding: 10px 14px;
  font-size: 14px;
  color: var(--text-primary);
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  letter-spacing: .15em;
}
.rf-input-text { letter-spacing: normal; }
.rf-input-code::placeholder, .rf-input-text::placeholder { color: var(--text-muted); }
.rf-input-code:focus, .rf-input-text:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(96,93,255,.18);
}
.rf-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }

.rf-pwd-form { display: flex; flex-direction: column; gap: 14px; }
.rf-field { display: flex; flex-direction: column; gap: 6px; }
.rf-field > span { font-size: 12.5px; font-weight: 500; color: var(--text-secondary); }
.rf-field .rf-input-text { max-width: 360px; }

.rf-recovery {
  margin-top: 20px; padding: 16px;
  background: rgba(245,184,41,.10);
  border: 1px solid rgba(245,184,41,.24);
  border-radius: 10px;
}
.rf-recovery h4 { margin: 0 0 8px; font-size: 14px; color: var(--warning); }
.rf-codes {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;
  margin: 12px 0;
}
.rf-codes code {
  padding: 6px 10px;
  background: var(--bg-input); border: 1px solid rgba(245,184,41,.24);
  border-radius: 6px;
  color: var(--text-primary);
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 12.5px; text-align: center;
}

.rf-disable-form { display: flex; flex-direction: column; gap: 8px; max-width: 320px; }
</style>
