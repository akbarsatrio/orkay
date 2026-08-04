// CLI manajemen instance Orkay.
//
//   node scripts/instance.mjs list
//   node scripts/instance.mjs new [nama] [--mode=full] [--yes] ...
//   node scripts/instance.mjs start [nama]
//   node scripts/instance.mjs info <nama>
//   node scripts/instance.mjs delete <nama> [--drop-data] [--yes]

import { spawnSync } from 'node:child_process'
import { ROOT } from './lib/paths.mjs'
import {
  listInstances,
  loadInstance,
  portsForInstance,
  instanceExists,
  deleteInstance,
} from './lib/config.mjs'
import { ask, confirm, closePrompt, parseArgs } from './lib/prompt.mjs'

const argv = process.argv.slice(2)
const sub = argv[0]
const rest = argv.slice(1)
const args = parseArgs(rest)

function log(msg = '') {
  process.stdout.write(msg + '\n')
}

function cmdList() {
  const instances = listInstances()
  if (instances.length === 0) {
    log('Belum ada instance. Buat dengan: npm run instance:new')
    return
  }
  log('NAMA           SLOT  MODE  PIN      SERVER  VITE   BRAIN  DATABASE')
  log('----           ----  ----  ---      ------  ----   -----  --------')
  for (const cfg of instances) {
    const p = portsForInstance(cfg)
    const row = [
      cfg.name.padEnd(14),
      String(cfg.slot).padEnd(4),
      (cfg.mode || 'web').padEnd(4),
      String(cfg.pin).padEnd(8),
      String(p.server).padEnd(6),
      String(p.vite).padEnd(6),
      (cfg.mode === 'full' ? String(p.brain) : '-').padEnd(6),
      cfg.db.name,
    ].join(' ')
    log(row)
  }
}

// Mask field rahasia pada salinan config (deep-clone) kecuali --show-secrets.
function maskSecrets(cfg) {
  const c = JSON.parse(JSON.stringify(cfg))
  if (c.pin != null) c.pin = '***'
  if (c.authSecret != null) c.authSecret = '***'
  if (c.db && c.db.password != null) c.db.password = '***'
  if (c.ai) {
    for (const k of ['openwaApiKey', 'llmApiKey', 'waWebhookSecret']) {
      if (c.ai[k] != null) c.ai[k] = '***'
    }
  }
  return c
}

function cmdInfo(name) {
  if (!name) {
    log('Pemakaian: npm run instance -- info <nama> [--show-secrets]')
    process.exit(1)
  }
  const cfg = loadInstance(name)
  const p = portsForInstance(cfg)
  const showSecrets = !!args['show-secrets']
  const out = showSecrets ? cfg : maskSecrets(cfg)
  log(JSON.stringify({ ...out, ports: p }, null, 2))
}

function cmdNew() {
  // Teruskan semua argumen ke bootstrap.
  const res = spawnSync('node', ['scripts/bootstrap.mjs', ...rest], {
    cwd: ROOT,
    stdio: 'inherit',
  })
  process.exit(res.status || 0)
}

function cmdStart() {
  const passthrough = args._[0] ? [`--instance=${args._[0]}`] : []
  const res = spawnSync('node', ['scripts/run-instance.mjs', ...passthrough], {
    cwd: ROOT,
    stdio: 'inherit',
  })
  process.exit(res.status || 0)
}

async function cmdDelete() {
  const name = args._[0]
  if (!name) {
    log('Pemakaian: npm run instance -- delete <nama> [--drop-data] [--yes]')
    process.exit(1)
  }
  if (!instanceExists(name)) {
    log(`Instance "${name}" tidak ditemukan.`)
    process.exit(1)
  }
  const cfg = loadInstance(name)
  const dropData = !!args['drop-data']
  const auto = !!args.yes || !!args.y

  log(`\nAkan menghapus instance "${name}" (mode ${cfg.mode}, DB ${cfg.dbProvider || 'host'}).`)
  log(dropData
    ? '  ⚠  --drop-data: database & seluruh datanya akan DIHAPUS PERMANEN.'
    : '  Database dibiarkan (data aman). Tambah --drop-data untuk menghapus data juga.')

  if (!auto) {
    const typed = await ask(`Ketik ulang nama "${name}" untuk konfirmasi`, '')
    if (typed !== name) {
      log('Nama tidak cocok. Dibatalkan.')
      closePrompt()
      process.exit(1)
    }
    if (dropData) {
      const yes = await confirm('Yakin hapus database & datanya (permanen)?', false)
      if (!yes) {
        log('Dibatalkan.')
        closePrompt()
        process.exit(1)
      }
    }
  }

  // Stop proses instance kalau kebetulan sedang jalan (best-effort).
  spawnSync('pkill', ['-f', `run-instance.mjs --instance=${name}`], { stdio: 'ignore' })

  if (dropData) {
    try {
      if ((cfg.dbProvider || 'host') === 'docker') {
        const { removeContainer } = await import('./lib/docker-setup.mjs')
        const r = removeContainer(cfg, { withVolume: true })
        log(`[docker] container dihapus: ${r.container}, volume: ${r.volume}`)
      } else {
        const { dropDatabase } = await import('./lib/mysql-setup.mjs')
        const adminUser = args['db-admin-user'] || (auto ? 'root' : await ask('MySQL admin user', 'root'))
        const adminPass =
          args['db-admin-pass'] != null ? args['db-admin-pass'] : auto ? '' : await ask('MySQL admin password', '')
        await dropDatabase(cfg, { host: cfg.db.host, port: cfg.db.port, user: adminUser, password: adminPass })
        log(`[db] database "${cfg.db.name}" & user "${cfg.db.user}" dihapus.`)
      }
    } catch (err) {
      log(`⚠ Gagal menghapus data: ${err.message}`)
      log('  Config TIDAK dihapus supaya kamu bisa coba lagi.')
      closePrompt()
      process.exit(1)
    }
  }

  deleteInstance(name)
  log(`✅ Instance "${name}" dihapus.`)
  closePrompt()
  process.exit(0)
}

switch (sub) {
  case 'list':
  case 'ls':
    cmdList()
    break
  case 'new':
  case 'create':
    cmdNew()
    break
  case 'start':
  case 'run':
    cmdStart()
    break
  case 'info':
    cmdInfo(args._[0])
    break
  case 'delete':
  case 'rm':
    cmdDelete()
    break
  default:
    log('Perintah instance Orkay:')
    log('  list                       tampilkan semua instance + port')
    log('  new [nama] [opsi]           buat instance baru (bootstrap)')
    log('  start [nama]               jalankan instance (dev)')
    log('  info <nama>                tampilkan detail config instance')
    log('  delete <nama> [--drop-data] [--yes]  hapus instance')
    if (sub) process.exit(1)
}
