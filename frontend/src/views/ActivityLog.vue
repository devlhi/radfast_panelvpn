<template>
  <div class="activity-page">
    <div class="activity-header">
      <div>
        <h2 class="activity-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
          System & Activity Log
        </h2>
        <p class="activity-sub">Catatan semua aktivitas sistem, instance, auth, dan error backend ({{ currentFile }}).</p>
      </div>
      <div class="activity-actions">
        <select v-model="currentFile" @change="loadEvents" class="input">
          <option v-for="f in files" :key="f.name" :value="f.name">{{ f.name }} ({{ Math.round(f.sizeBytes / 1024) }} KB)</option>
        </select>
        <button class="btn btn-ghost" @click="loadEvents" :disabled="loading">Refresh</button>
      </div>
    </div>

    <div class="card">
      <div v-if="!events.length" class="card-empty">Belum ada aktivitas.</div>
      <table v-else class="rf-table">
        <thead>
          <tr>
            <th style="width:180px">Waktu</th>
            <th style="width:200px">Event Type</th>
            <th>Detail / Actor</th>
            <th style="width:130px">IP</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(e, i) in pagedEvents" :key="i">
            <td class="mono small">{{ formatTs(e.ts) }}</td>
            <td>
              <span class="tag" :class="typeClass(e.type)">{{ e.type }}</span>
            </td>
            <td class="small">
              <div v-if="e.actor" style="font-weight: 500; margin-bottom: 4px;">👤 {{ e.actor }}</div>
              <div v-if="e.msg" class="text-danger">{{ e.msg }}</div>
              <div v-if="e.name">Instance: <b>{{ e.name }}</b></div>
              <div class="mono text-muted" style="font-size: 11px">{{ e.path }} {{ e.method ? `(${e.method})` : '' }}</div>
              <details v-if="hasExtra(e)">
                <summary style="cursor: pointer; opacity: 0.7;">Raw Data</summary>
                <pre class="codebox" style="margin-top: 4px; padding: 4px; background: rgba(0,0,0,0.2);">{{ extraJSON(e) }}</pre>
              </details>
            </td>
            <td class="mono small">{{ e.ip || '—' }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="events.length > pageSize" class="rf-pagination">
        <button class="rf-page-btn" :disabled="page <= 1" @click="page = 1">«</button>
        <button class="rf-page-btn" :disabled="page <= 1" @click="page--">‹</button>
        <span class="rf-page-info">{{ events.length }} events · Hal {{ page }} / {{ Math.ceil(events.length / pageSize) }}</span>
        <button class="rf-page-btn" :disabled="page >= Math.ceil(events.length / pageSize)" @click="page++">›</button>
        <button class="rf-page-btn" :disabled="page >= Math.ceil(events.length / pageSize)" @click="page = Math.ceil(events.length / pageSize)">»</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const files = ref([])
const currentFile = ref('')
const events = ref([])
const loading = ref(false)

const page = ref(1)
const pageSize = ref(50)

const pagedEvents = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return events.value.slice(start, start + pageSize.value)
})

async function loadFiles() {
  try {
    const res = await axios.get('/api/security/audit-files')
    files.value = res.data.files || []
    if (files.value.length && !currentFile.value) {
      currentFile.value = files.value[0].name
      await loadEvents()
    }
  } catch (e) {
    console.error('Gagal load daftar log', e)
  }
}

async function loadEvents() {
  if (!currentFile.value) return
  loading.value = true
  try {
    const res = await axios.get(`/api/security/audit-file/${currentFile.value}?tail=1000`)
    events.value = res.data.events || []
    page.value = 1
  } catch (e) {
    console.error('Gagal load events', e)
  } finally {
    loading.value = false
  }
}

function typeClass(type) {
  if (!type) return 'tag-muted'
  if (type.includes('error') || type.includes('exception') || type.includes('rejection') || type.includes('fail')) return 'tag-danger'
  if (type.includes('create') || type.includes('start') || type.includes('success')) return 'tag-success'
  if (type.includes('stop') || type.includes('delete')) return 'tag-warn'
  return 'tag-muted'
}

function formatTs(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

function hasExtra(e) {
  const omit = ['ts', 'type', 'ip', 'ua', 'path', 'method', 'actor', 'msg', 'name']
  return Object.keys(e).some(k => !omit.includes(k))
}

function extraJSON(e) {
  const omit = ['ts', 'type', 'ip', 'ua', 'path', 'method', 'actor', 'msg', 'name']
  const out = {}
  for (const [k, v] of Object.entries(e)) {
    if (!omit.includes(k)) out[k] = v
  }
  return JSON.stringify(out, null, 2)
}

onMounted(loadFiles)
</script>

<style scoped>
.activity-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.activity-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.activity-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 4px 0;
  font-size: 1.25rem;
  font-weight: 600;
}
.activity-sub {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}
.activity-actions {
  display: flex;
  gap: 12px;
}
.text-danger {
  color: #ff5b5b;
}
.text-muted {
  color: var(--text-muted);
}
</style>
