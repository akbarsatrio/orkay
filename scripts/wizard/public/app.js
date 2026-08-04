// Wizard installer Orkay — logika UI (vanilla JS, tanpa build).

const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => Array.from(document.querySelectorAll(sel))

const state = {
  step: 0,
  mode: 'web',
  dbProvider: 'host',
  dockerAvailable: false,
  result: null,
}

// ---------- navigasi step ----------
function goStep(n) {
  state.step = n
  $$('.panel').forEach((p) => p.classList.toggle('hidden', Number(p.dataset.panel) !== n))
  $$('.step').forEach((s) => {
    const i = Number(s.dataset.step)
    s.classList.toggle('active', i === n)
    s.classList.toggle('done', i < n)
  })
}

function showView(name) {
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name))
  $('#view-wizard').classList.toggle('hidden', name !== 'wizard')
  $('#view-manage').classList.toggle('hidden', name !== 'manage')
  if (name === 'manage') loadInstances()
}

$$('.tab').forEach((t) => t.addEventListener('click', () => showView(t.dataset.view)))
$$('[data-back]').forEach((b) => b.addEventListener('click', () => goStep(Number(b.dataset.back))))

// ---------- Step 0: preflight ----------
async function runPreflight() {
  const box = $('#preflight')
  box.innerHTML = '<div class="check loading">Memeriksa sistem…</div>'
  $('#preflight-help').classList.add('hidden')
  const pf = await fetch('/api/preflight').then((r) => r.json())
  state.dockerAvailable = pf.docker.running

  const checks = []
  checks.push({
    ok: pf.node.ok,
    label: pf.node.ok
      ? `Node.js terpasang (${pf.node.version})`
      : `Node.js versi ${pf.node.version} terlalu lama (butuh 18+)`,
  })
  checks.push({
    ok: true,
    warn: !pf.deps.installed,
    label: pf.deps.installed
      ? 'Dependency aplikasi sudah terpasang'
      : 'Dependency belum terpasang — akan dipasang otomatis saat instalasi',
  })
  checks.push({
    ok: true,
    warn: !pf.docker.running,
    label: pf.docker.running
      ? 'Docker aktif (opsi database otomatis tersedia)'
      : pf.docker.installed
        ? 'Docker terpasang tapi belum berjalan (nyalakan jika ingin DB otomatis)'
        : 'Docker tidak terpasang (opsional — hanya untuk DB otomatis)',
  })

  box.innerHTML = checks
    .map((c) => `<div class="check ${c.ok ? (c.warn ? 'warn' : 'ok') : 'fail'}">${c.label}</div>`)
    .join('')

  const nodeOk = pf.node.ok
  $('#to-step-1').disabled = !nodeOk
  if (!nodeOk) {
    $('#preflight-help').classList.remove('hidden')
    $('#preflight-help').innerHTML = `
      <b>Node.js perlu diperbarui.</b>
      <ul>
        <li>Unduh versi terbaru di <a href="https://nodejs.org" target="_blank">nodejs.org</a> (pilih LTS).</li>
        <li>Pasang, lalu klik "Periksa ulang".</li>
      </ul>`
  }
}

$('#btn-recheck').addEventListener('click', runPreflight)
$('#to-step-1').addEventListener('click', () => goStep(1))

// ---------- Step 1: mode ----------
$$('.mode-card').forEach((c) =>
  c.addEventListener('click', () => {
    $$('.mode-card').forEach((x) => x.classList.remove('selected'))
    c.classList.add('selected')
    state.mode = c.dataset.mode
  })
)
$('#to-step-2').addEventListener('click', async () => {
  // isi saran nama/PIN
  const s = await fetch('/api/suggest').then((r) => r.json())
  if (!$('#in-name').value) $('#in-name').value = s.name
  if (!$('#in-pin').value) $('#in-pin').value = s.pin
  goStep(2)
})

// ---------- Step 2: akun ----------
$('#btn-regen-pin').addEventListener('click', () => {
  $('#in-pin').value = String(Math.floor(100000 + Math.random() * 900000))
})
$('#to-step-3').addEventListener('click', () => {
  const name = $('#in-name').value.trim()
  const pin = $('#in-pin').value.trim()
  if (!name) return alert('Isi nama aplikasi dulu.')
  if (!pin || pin.length < 4) return alert('PIN minimal 4 digit.')
  // toggle AI form
  $('#ai-form').classList.toggle('hidden', state.mode !== 'full')
  // badge docker
  const dockerCard = $('#db-docker-card')
  const badge = $('#docker-badge')
  if (state.dockerAvailable) {
    dockerCard.disabled = false
    badge.textContent = '✅ Docker siap'
    badge.style.color = 'var(--green)'
  } else {
    dockerCard.disabled = true
    badge.textContent = '⚠️ Docker tidak aktif'
    badge.style.color = 'var(--amber)'
  }
  goStep(3)
})

// ---------- Step 3: database ----------
$$('.db-card').forEach((c) =>
  c.addEventListener('click', () => {
    if (c.disabled) return
    $$('.db-card').forEach((x) => x.classList.remove('selected'))
    c.classList.add('selected')
    state.dbProvider = c.dataset.db
    $('#db-host-form').classList.toggle('hidden', state.dbProvider !== 'host')
    $('#db-docker-form').classList.toggle('hidden', state.dbProvider !== 'docker')
  })
)

$('#btn-test-mysql').addEventListener('click', async () => {
  const el = $('#mysql-test-result')
  el.textContent = 'Mengetes…'
  el.className = 'test-result'
  const r = await fetch('/api/test-mysql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host: $('#db-host').value,
      port: $('#db-port').value,
      user: $('#db-admin-user').value,
      password: $('#db-admin-pass').value,
    }),
  }).then((r) => r.json())
  el.textContent = r.message
  el.className = 'test-result ' + (r.ok ? 'ok' : 'fail')
})

// ---------- Step 4: install (SSE) ----------
$('#to-step-4').addEventListener('click', startInstall)

function collectPayload() {
  return {
    name: $('#in-name').value.trim(),
    pin: $('#in-pin').value.trim(),
    mode: state.mode,
    dbProvider: state.dbProvider,
    dbHost: $('#db-host').value,
    dbPort: $('#db-port').value,
    dbAdminUser: $('#db-admin-user').value,
    dbAdminPass: $('#db-admin-pass').value,
    llmApiKey: $('#ai-key').value,
    llmBaseUrl: $('#ai-url').value,
    llmModel: $('#ai-model').value,
  }
}

async function startInstall() {
  goStep(4)
  const logEl = $('#install-log')
  const bar = $('#progress-bar')
  logEl.textContent = ''
  bar.style.width = '5%'
  let pct = 5

  const resp = await fetch('/api/install', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(collectPayload()),
  })

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const events = buf.split('\n\n')
    buf = events.pop()
    for (const ev of events) {
      const lines = ev.split('\n')
      const type = (lines.find((l) => l.startsWith('event:')) || 'event: message').slice(6).trim()
      const dataLine = lines.find((l) => l.startsWith('data:'))
      if (!dataLine) continue
      const data = JSON.parse(dataLine.slice(5).trim())
      if (type === 'log') {
        logEl.textContent += data + '\n'
        logEl.scrollTop = logEl.scrollHeight
        pct = Math.min(pct + 2, 92)
        bar.style.width = pct + '%'
      } else if (type === 'done') {
        bar.style.width = '100%'
        state.result = data
        setTimeout(() => showDone(data), 400)
      } else if (type === 'error') {
        logEl.textContent += '\n❌ ERROR: ' + data + '\n'
        bar.style.background = 'var(--red)'
        alert('Instalasi gagal:\n' + data + '\n\nCek log untuk detail.')
      }
    }
  }
}

function showDone(d) {
  goStep(5)
  $('#done-summary').innerHTML = `
    <div>Nama aplikasi: <b>${d.name}</b> (${d.mode})</div>
    <div>PIN masuk:</div>
    <div class="pin-big">${d.pin}</div>
    <div>Alamat aplikasi: <b>${d.url}</b></div>
    <div>Port: server ${d.ports.server} · web ${d.ports.vite}${d.mode === 'full' ? ' · brain ' + d.ports.brain : ''}</div>`
  $('#btn-open-app').onclick = async () => {
    // start instance kalau belum jalan, lalu buka
    await fetch('/api/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: d.name }),
    })
    setTimeout(() => window.open(d.url, '_blank'), 1200)
  }
}

$('#btn-add-another').addEventListener('click', () => {
  $('#in-name').value = ''
  $('#in-pin').value = ''
  goStep(1)
})
$('#btn-goto-manage').addEventListener('click', () => showView('manage'))
$('#btn-new-from-manage').addEventListener('click', () => {
  showView('wizard')
  goStep(1)
})
$('#btn-refresh').addEventListener('click', loadInstances)

// ---------- Manage ----------
async function loadInstances() {
  const list = $('#instance-list')
  list.innerHTML = '<p class="sub">Memuat…</p>'
  const { instances } = await fetch('/api/instances').then((r) => r.json())
  if (!instances.length) {
    list.innerHTML = '<p class="sub">Belum ada aplikasi terpasang.</p>'
    return
  }
  list.innerHTML = instances.map(instanceRow).join('')
  bindInstanceActions()
}

function instanceRow(i) {
  return `
    <div class="instance" data-name="${i.name}" data-provider="${i.dbProvider}">
      <div class="instance-info">
        <div class="instance-name"><span class="dot ${i.running ? 'on' : ''}"></span>${i.name}
          <span class="tag">${i.mode}</span>
          <span class="tag">DB: ${i.dbProvider}</span>
        </div>
        <div class="instance-meta">PIN ${i.pin} · web ${i.ports.vite} · server ${i.ports.server} · ${i.url}</div>
      </div>
      <div class="instance-actions">
        ${
          i.running
            ? `<button class="btn ghost small" data-act="open" data-url="${i.url}">Buka</button>
               <button class="btn ghost small" data-act="stop">Stop</button>`
            : `<button class="btn primary small" data-act="start">Jalankan</button>`
        }
        <button class="btn ghost small" data-act="export">Export</button>
        <button class="btn ghost small danger-text" data-act="delete">Hapus</button>
      </div>
    </div>`
}

function bindInstanceActions() {
  $$('.instance').forEach((row) => {
    const name = row.dataset.name
    row.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const act = btn.dataset.act
        if (act === 'open') return window.open(btn.dataset.url, '_blank')
        if (act === 'start') {
          btn.textContent = 'Menjalankan…'
          const r = await fetch('/api/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
          }).then((r) => r.json())
          if (r.url) window.open(r.url, '_blank')
          setTimeout(loadInstances, 800)
        }
        if (act === 'stop') {
          await fetch('/api/stop', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
          })
          loadInstances()
        }
        if (act === 'export') openExport(name)
        if (act === 'delete') openDelete(name, row.dataset.provider)
      })
    })
  })
}

// ---------- Export modal ----------
let exportName = null
function openExport(name) {
  exportName = name
  $('#export-domain').value = ''
  $('#export-output').classList.add('hidden')
  $('#export-modal').classList.remove('hidden')
}
$('#export-cancel').addEventListener('click', () => $('#export-modal').classList.add('hidden'))
$('#export-go').addEventListener('click', async () => {
  const out = $('#export-output')
  out.classList.remove('hidden')
  out.textContent = 'Generating…'
  const r = await fetch('/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: exportName, domain: $('#export-domain').value.trim() }),
  }).then((r) => r.json())
  out.textContent = r.ok ? `✅ Tersimpan di:\n${r.dir}\n\n${r.output || ''}` : `❌ ${r.error}`
})

// ---------- Delete modal ----------
let deleteName = null
let deleteProvider = 'host'

function refreshDeleteButton() {
  const typed = $('#del-confirm-name').value.trim()
  $('#delete-go').disabled = typed !== deleteName
}

function openDelete(name, provider) {
  deleteName = name
  deleteProvider = provider || 'host'
  $('#del-name-label').textContent = name
  $('#del-confirm-name').value = ''
  $('#del-drop-data').checked = false
  $('#del-admin-form').classList.add('hidden')
  $('#del-admin-pass').value = ''
  $('#delete-output').classList.add('hidden')
  $('#delete-output').textContent = ''
  $('#delete-go').disabled = true
  $('#delete-modal').classList.remove('hidden')
}

// Tampilkan form admin hanya kalau: drop data dicentang DAN provider = host.
$('#del-drop-data').addEventListener('change', (e) => {
  const showAdmin = e.target.checked && deleteProvider === 'host'
  $('#del-admin-form').classList.toggle('hidden', !showAdmin)
})
$('#del-confirm-name').addEventListener('input', refreshDeleteButton)
$('#delete-cancel').addEventListener('click', () => $('#delete-modal').classList.add('hidden'))

$('#delete-go').addEventListener('click', async () => {
  const out = $('#delete-output')
  const dropData = $('#del-drop-data').checked
  out.classList.remove('hidden')
  out.textContent = 'Menghapus…'
  $('#delete-go').disabled = true
  const r = await fetch('/api/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: deleteName,
      dropData,
      dbAdminUser: $('#del-admin-user').value,
      dbAdminPass: $('#del-admin-pass').value,
    }),
  }).then((r) => r.json())

  if (r.ok) {
    let msg = `✅ Aplikasi "${r.name}" dihapus.`
    if (r.stopped) msg += ' Proses dihentikan.'
    if (r.data) {
      msg +=
        r.data.type === 'docker'
          ? `\nData Docker dihapus (container: ${r.data.container}, volume: ${r.data.volume}).`
          : `\nDatabase "${r.data.database}" & user "${r.data.user}" dihapus.`
    } else {
      msg += '\nDatabase dibiarkan (data aman).'
    }
    out.textContent = msg
    setTimeout(() => {
      $('#delete-modal').classList.add('hidden')
      loadInstances()
    }, 1400)
  } else {
    out.textContent = `❌ ${r.message || r.error || 'Gagal menghapus.'}`
    refreshDeleteButton()
  }
})

// ---------- init ----------
runPreflight()
goStep(0)
