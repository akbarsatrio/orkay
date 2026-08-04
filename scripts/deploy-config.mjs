// Generator konfigurasi deploy production per-instance.
//
// Menghasilkan (di deploy/<nama>/):
//   - server.env, brain.env, mcp.env   -> file .env production tiap komponen
//   - ecosystem.<nama>.cjs             -> config PM2 (server [+ brain kalau full])
//   - nginx-<nama>.conf                -> reverse proxy nginx (butuh --domain)
//
// PM2 menjalankan server mode production (Express serve client/dist), jadi
// build React (`npm run build`) tetap perlu dijalankan sekali sebelum start.
//
// Pemakaian:
//   node scripts/deploy-config.mjs <nama> --domain=orkay.contoh.com
//   node scripts/deploy-config.mjs budi --domain=budi.contoh.com
//   node scripts/deploy-config.mjs --all --domain-suffix=contoh.com

import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ROOT, DEPLOY_OUT_DIR, SERVER_DIR, BRAIN_DIR, MCP_DIR } from './lib/paths.mjs'
import { loadInstance, listInstances, portsForInstance } from './lib/config.mjs'
import { serverEnv, brainEnv, mcpEnv, toEnvFile } from './lib/env.mjs'
import { parseArgs } from './lib/prompt.mjs'

const args = parseArgs(process.argv.slice(2))

function log(msg = '') {
  process.stdout.write(msg + '\n')
}

function targets() {
  if (args.all) return listInstances()
  const name = args._[0]
  if (!name) {
    log('Pemakaian: node scripts/deploy-config.mjs <nama> --domain=... | --all --domain-suffix=...')
    process.exit(1)
  }
  return [loadInstance(name)]
}

function domainFor(cfg) {
  if (args.domain) return args.domain
  if (args['domain-suffix']) return `${cfg.name}.${args['domain-suffix']}`
  return `${cfg.name}.CHANGE-ME.com`
}

function ecosystemContent(cfg, ports) {
  const outDir = join(DEPLOY_OUT_DIR, cfg.name)
  const apps = [
    {
      name: `orkay-${cfg.name}`,
      cwd: SERVER_DIR,
      script: 'index.js',
      env_file: join(outDir, 'server.env'),
      port: ports.server,
    },
  ]
  if (cfg.mode === 'full') {
    apps.push({
      name: `orkay-${cfg.name}-brain`,
      cwd: BRAIN_DIR,
      script: 'src/index.js',
      env_file: join(outDir, 'brain.env'),
      port: ports.brain,
    })
  }

  const appObjs = apps
    .map(
      (a) => `    {
      name: '${a.name}',
      cwd: '${a.cwd}',
      script: '${a.script}',
      instances: 1,
      exec_mode: 'fork',
      // Nilai sensitif diambil dari file env di bawah:
      env_file: '${a.env_file}',
      max_memory_restart: '256M',
      autorestart: true,
    }`
    )
    .join(',\n')

  return `// PM2 config untuk instance Orkay "${cfg.name}" (slot ${cfg.slot}, mode ${cfg.mode}).
// Generate ulang: node scripts/deploy-config.mjs ${cfg.name}
// Pakai: pm2 start ${join(outDir, `ecosystem.${cfg.name}.cjs`)}
module.exports = {
  apps: [
${appObjs},
  ],
}
`
}

function nginxContent(cfg, ports) {
  const domain = domainFor(cfg)
  return `# Nginx reverse proxy untuk instance Orkay "${cfg.name}".
# Salin ke /etc/nginx/sites-available/orkay-${cfg.name} lalu symlink ke sites-enabled.
# Setelah aktif: sudo nginx -t && sudo systemctl reload nginx
# HTTPS: sudo certbot --nginx -d ${domain}
server {
    listen 80;
    server_name ${domain};

    client_max_body_size 5m;

    # Express (juga serve React build) untuk instance ini.
    location / {
        proxy_pass http://127.0.0.1:${ports.server};
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
${
  cfg.mode === 'full'
    ? `
    # Webhook WhatsApp -> Brain (opsional; buka hanya kalau perlu akses publik).
    location /wa/ {
        proxy_pass http://127.0.0.1:${ports.brain}/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
`
    : ''
}}
`
}

function writeFor(cfg) {
  const ports = portsForInstance(cfg)
  const outDir = join(DEPLOY_OUT_DIR, cfg.name)
  mkdirSync(outDir, { recursive: true })

  // .env production tiap komponen
  writeFileSync(join(outDir, 'server.env'), toEnvFile(serverEnv(cfg, { prod: true })))
  if (cfg.mode === 'full') {
    writeFileSync(join(outDir, 'brain.env'), toEnvFile(brainEnv(cfg)))
    writeFileSync(join(outDir, 'mcp.env'), toEnvFile(mcpEnv(cfg)))
  }

  // PM2 + nginx
  writeFileSync(join(outDir, `ecosystem.${cfg.name}.cjs`), ecosystemContent(cfg, ports))
  writeFileSync(join(outDir, `nginx-${cfg.name}.conf`), nginxContent(cfg, ports))

  log(`[deploy] instance "${cfg.name}" -> ${outDir}`)
  log(`         server.env${cfg.mode === 'full' ? ', brain.env, mcp.env' : ''}`)
  log(`         ecosystem.${cfg.name}.cjs, nginx-${cfg.name}.conf  (domain: ${domainFor(cfg)})`)
}

const list = targets()
mkdirSync(DEPLOY_OUT_DIR, { recursive: true })
for (const cfg of list) writeFor(cfg)

log('')
log('Selesai. Langkah deploy tipikal (per instance):')
log('  1. npm run build                       # build React (sekali, dipakai semua instance)')
log('  2. pm2 start deploy/<nama>/ecosystem.<nama>.cjs')
log('  3. pm2 save && pm2 startup')
log('  4. salin deploy/<nama>/nginx-<nama>.conf ke /etc/nginx/sites-available/ lalu aktifkan')
