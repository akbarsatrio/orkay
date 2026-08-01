// Konfigurasi PM2 untuk menjalankan backend Orkay secara persisten.
// Pakai: pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'orkay',
      cwd: __dirname + '/server',
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      // Nilai sensitif (APP_PIN, AUTH_SECRET, DB_* MySQL) diambil dari server/.env
      max_memory_restart: '256M',
      autorestart: true,
    },
  ],
}
