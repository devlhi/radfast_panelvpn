<template>
  <div class="rf-settings">
    <header class="rf-page-head">
      <h1>Security Settings</h1>
      <p>Akun: <strong>{{ auth.username }}</strong></p>
    </header>

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
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()

const busy = ref(false)
const enrollment = ref(null)
const enrollCode = ref('')
const enrollError = ref('')
const recoveryCodes = ref([])
const showDisable = ref(false)
const disablePass = ref('')
const disableError = ref('')

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
.rf-page-head h1 { font-size: 22px; font-weight: 600; margin: 0 0 4px; color: var(--text-strong); }
.rf-page-head p { color: var(--text-muted); font-size: 13px; margin: 0; }

.rf-card {
  background: var(--surface, #fff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,.04);
}
.rf-card-head {
  display: flex; align-items: flex-start; justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border, #e5e7eb);
}
.rf-card-head h2 { font-size: 16px; font-weight: 600; margin: 0 0 4px; color: var(--text-strong); }
.rf-card-head p  { font-size: 12.5px; color: var(--text-muted); margin: 0; }
.rf-card-body { display: flex; flex-direction: column; gap: 12px; }

.rf-badge {
  font-size: 11px; font-weight: 600;
  padding: 4px 10px; border-radius: 99px;
  text-transform: uppercase; letter-spacing: .04em;
}
.rf-badge-on  { background: #d1fae5; color: #065f46; }
.rf-badge-off { background: #fee2e2; color: #991b1b; }

.rf-help { font-size: 13px; color: var(--text-muted); line-height: 1.5; }
.rf-err  { font-size: 12.5px; color: #b91c1c; margin-top: 8px; }

.rf-btn {
  font-size: 13px; font-weight: 500;
  padding: 9px 16px; border-radius: 9px; border: none;
  cursor: pointer; transition: background .15s, transform .1s;
  display: inline-flex; align-items: center; gap: 6px;
}
.rf-btn:disabled { opacity: .6; cursor: not-allowed; }
.rf-btn-primary { background: var(--accent, #605dff); color: #fff; }
.rf-btn-primary:hover:not(:disabled) { background: var(--accent-hover, #4c4ae6); }
.rf-btn-ghost   { background: transparent; color: var(--text-muted); border: 1px solid var(--border, #e5e7eb); }
.rf-btn-ghost:hover:not(:disabled) { background: var(--bg-base, #f9fafb); }
.rf-btn-danger  { background: #dc2626; color: #fff; }
.rf-btn-danger:hover:not(:disabled) { background: #b91c1c; }

.rf-2fa-enroll { display: flex; flex-direction: column; gap: 16px; }
.rf-steps { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 24px; }
.rf-steps li h4 { font-size: 13.5px; font-weight: 600; margin: 0 0 10px; color: var(--text-strong); }

.rf-qr {
  width: 180px; height: 180px; display: block;
  border: 1px solid var(--border, #e5e7eb); border-radius: 8px;
  padding: 8px; background: #fff;
}
.rf-manual { margin-top: 10px; }
.rf-manual summary { font-size: 12px; color: var(--text-muted); cursor: pointer; }
.rf-secret {
  display: inline-block; margin-top: 6px;
  padding: 6px 10px;
  background: var(--bg-base, #f9fafb);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 12px; letter-spacing: .04em;
}

.rf-input-code, .rf-input-text {
  width: 100%; max-width: 280px;
  padding: 10px 14px;
  font-size: 14px;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 8px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  letter-spacing: .15em;
}
.rf-input-text { letter-spacing: normal; }
.rf-input-code:focus, .rf-input-text:focus {
  outline: none;
  border-color: var(--accent, #605dff);
  box-shadow: 0 0 0 3px rgba(96,93,255,.12);
}
.rf-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }

.rf-recovery {
  margin-top: 20px; padding: 16px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 10px;
}
.rf-recovery h4 { margin: 0 0 8px; font-size: 14px; color: #92400e; }
.rf-codes {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;
  margin: 12px 0;
}
.rf-codes code {
  padding: 6px 10px;
  background: #fff; border: 1px solid #fde68a;
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 12.5px; text-align: center;
}

.rf-disable-form { display: flex; flex-direction: column; gap: 8px; max-width: 320px; }
</style>
