<template>
  <div class="rf-term-page">
    <section class="rf-term-hero rf-card">
      <div>
        <p class="rf-kicker">VPS Virtual Terminal</p>
        <h2>Terminal Diagnostik VPS</h2>
        <p>Jalankan ping, tracepath, cek route, dan WireGuard langsung dari VPS panel.</p>
      </div>
      <div class="rf-term-status">
        <span class="dot dot-success"></span>
        <span>Connected to backend VPS</span>
      </div>
    </section>

    <section class="rf-card rf-term-card">
      <div class="rf-term-toolbar">
        <button class="btn-secondary" @click="fillCommand('ip route show')">ip route</button>
        <button class="btn-secondary" @click="fillCommand('wg show')">wg show</button>
        <button class="btn-secondary" @click="fillCommand('ip neigh show')">ip neigh</button>
        <button class="btn-secondary" @click="fillCommand('tracepath 10.130.130.1')">tracepath</button>
        <button class="btn-secondary" @click="fillCommand('ping 10.130.130.1')">ping ONT</button>
        <button class="btn-ghost" @click="clearOutput">Clear</button>
      </div>

      <div ref="terminalBox" class="rf-terminal-output">
        <pre>{{ output }}</pre>
        <div v-if="running" class="rf-term-running">
          <span class="rf-spinner"></span>
          Executing command on VPS…
        </div>
      </div>

      <form class="rf-terminal-input" @submit.prevent="runCommand">
        <span class="rf-term-prompt">vps$</span>
        <input
          v-model="command"
          :disabled="running"
          autocomplete="off"
          spellcheck="false"
          placeholder="ping 10.130.130.1"
          @keydown.up.prevent="historyBack"
          @keydown.down.prevent="historyForward"
        />
        <button class="btn-primary" :disabled="running || !command.trim()">
          {{ running ? 'Running…' : 'Run' }}
        </button>
      </form>

      <div class="rf-term-help">
        <strong>Command tersedia:</strong>
        <code>ping IP</code>, <code>tracepath IP</code>, <code>ip route show</code>,
        <code>ip neigh show</code>, <code>wg show</code>, <code>wg peer IP</code>.
        Shell bebas seperti <code>rm</code>, <code>curl | bash</code>, <code>nano</code> tidak diizinkan demi keamanan panel.
      </div>
    </section>
  </div>
</template>

<script setup>
import { nextTick, ref } from 'vue'
import axios from 'axios'

const command = ref('ping 10.130.130.1')
const output = ref('RadFast VPS Terminal\nType command lalu Enter.\n\n')
const running = ref(false)
const terminalBox = ref(null)
const history = ref([])
const historyIndex = ref(-1)

function fillCommand(cmd) {
  command.value = cmd
}

function clearOutput() {
  output.value = 'RadFast VPS Terminal\n\n'
}

function append(text) {
  output.value += text
  nextTick(() => {
    if (terminalBox.value) terminalBox.value.scrollTop = terminalBox.value.scrollHeight
  })
}

function parseCommand(raw) {
  const parts = raw.trim().split(/\s+/)
  const bin = parts[0]
  if (bin === 'ping') return { command: 'ping', target: parts[1] || '' }
  if (bin === 'tracepath' || bin === 'traceroute') return { command: 'tracepath', target: parts[1] || '' }
  if (bin === 'wg' && parts[1] === 'show' && parts[2] === 'peer') return { command: 'wg-peer', target: parts[3] || '' }
  if (bin === 'wg' && parts[1] === 'peer') return { command: 'wg-peer', target: parts[2] || '' }
  if (bin === 'wg' && (!parts[1] || parts[1] === 'show')) return { command: 'wg', target: '' }
  if (bin === 'ip' && parts[1] === 'route') return { command: 'route', target: '' }
  if (bin === 'ip' && parts[1] === 'neigh') return { command: 'ip-neigh', target: '' }
  throw new Error('Command tidak diizinkan. Pakai: ping IP, tracepath IP, ip route show, ip neigh show, wg show, wg peer IP.')
}

async function runCommand() {
  const raw = command.value.trim()
  if (!raw || running.value) return
  running.value = true
  history.value.unshift(raw)
  historyIndex.value = -1
  append(`vps$ ${raw}\n`)

  try {
    const payload = parseCommand(raw)
    const res = await axios.post('/api/vpn/terminal', payload)
    append(`${res.data.output || '(no output)'}\n\n`)
  } catch (e) {
    append(`${e.response?.data?.message || e.message || 'Command gagal.'}\n\n`)
  } finally {
    running.value = false
    command.value = ''
  }
}

function historyBack() {
  if (!history.value.length) return
  historyIndex.value = Math.min(historyIndex.value + 1, history.value.length - 1)
  command.value = history.value[historyIndex.value]
}

function historyForward() {
  if (historyIndex.value <= 0) {
    historyIndex.value = -1
    command.value = ''
    return
  }
  historyIndex.value -= 1
  command.value = history.value[historyIndex.value]
}
</script>

<style scoped>
.rf-term-page { display: grid; gap: 18px; }
.rf-term-hero {
  display: flex; align-items: center; justify-content: space-between; gap: 18px;
  padding: 22px 24px;
}
.rf-kicker { font-size: 12px; text-transform: uppercase; letter-spacing: .12em; color: var(--text-muted); margin: 0 0 6px; }
.rf-term-hero h2 { margin: 0; color: var(--text-primary); font-size: 24px; font-weight: 800; }
.rf-term-hero p { margin: 6px 0 0; color: var(--text-muted); }
.rf-term-status { display: inline-flex; align-items: center; gap: 8px; color: var(--text-secondary); font-size: 13px; }
.rf-term-card { overflow: hidden; }
.rf-term-toolbar {
  display: flex; flex-wrap: wrap; gap: 8px; padding: 14px;
  border-bottom: 1px solid var(--border);
  background: rgba(255,255,255,.02);
}
.rf-terminal-output {
  height: min(58vh, 620px);
  overflow: auto;
  padding: 18px;
  background: #050816;
  border-bottom: 1px solid var(--border);
}
.rf-terminal-output pre {
  margin: 0;
  color: #d7e4ff;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 13px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}
.rf-term-running { display: flex; align-items: center; gap: 8px; margin-top: 10px; color: var(--info); font-size: 13px; }
.rf-terminal-input {
  display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px;
  padding: 14px;
  background: rgba(255,255,255,.03);
}
.rf-term-prompt { color: var(--success); font-family: ui-monospace, monospace; font-weight: 800; }
.rf-terminal-input input {
  width: 100%; border: 1px solid var(--border); border-radius: 10px;
  background: var(--bg-base); color: var(--text-primary); padding: 11px 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.rf-terminal-input input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(96,93,255,.18); }
.rf-term-help {
  padding: 12px 14px; color: var(--text-muted); font-size: 12px;
  border-top: 1px solid var(--border);
}
.rf-term-help code {
  color: var(--info); background: rgba(74,163,255,.12); border: 1px solid rgba(74,163,255,.18);
  padding: 2px 6px; border-radius: 6px;
}
@media (max-width: 720px) {
  .rf-term-hero { flex-direction: column; align-items: flex-start; }
  .rf-terminal-input { grid-template-columns: auto 1fr; }
  .rf-terminal-input button { grid-column: 1 / -1; }
}
</style>
