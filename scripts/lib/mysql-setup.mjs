import { createRequire } from 'node:module'
import { SERVER_DIR } from './paths.mjs'

// Pinjam mysql2 dari server/node_modules supaya root repo tak perlu dep tambahan.
const require = createRequire(SERVER_DIR + '/package.json')
let mysql
try {
  mysql = require('mysql2/promise')
} catch {
  mysql = null
}

export function hasMysqlDriver() {
  return !!mysql
}

// Buat database + user + grant untuk sebuah instance. Idempotent.
// adminCreds = { host, port, user, password } (biasanya root MySQL).
// Tidak menyimpan kredensial admin di mana pun.
export async function setupDatabase(cfg, adminCreds) {
  if (!mysql) {
    throw new Error(
      'Driver mysql2 belum terpasang. Jalankan "npm run install:all" dulu, lalu ulangi.'
    )
  }

  const conn = await mysql.createConnection({
    host: adminCreds.host || cfg.db.host || 'localhost',
    port: Number(adminCreds.port || cfg.db.port || 3306),
    user: adminCreds.user || 'root',
    password: adminCreds.password || '',
    multipleStatements: true,
  })

  try {
    const dbName = cfg.db.name
    const dbUser = cfg.db.user
    const dbPass = cfg.db.password

    // Backtick untuk nama DB; nama user/pass via escape string driver.
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    )

    // Buat user (localhost). Kalau sudah ada, set password-nya tetap sama config.
    await conn.query(
      `CREATE USER IF NOT EXISTS ?@'localhost' IDENTIFIED BY ?`,
      [dbUser, dbPass]
    )
    // Pastikan password sinkron dengan config (aman kalau user sudah ada).
    await conn.query(`ALTER USER ?@'localhost' IDENTIFIED BY ?`, [dbUser, dbPass])

    await conn.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO ?@'localhost'`, [dbUser])
    await conn.query('FLUSH PRIVILEGES')

    return { database: dbName, user: dbUser }
  } finally {
    await conn.end()
  }
}

// Hapus database + user milik instance (opsi host). PERMANEN.
// adminCreds = { host, port, user, password } (biasanya root MySQL).
export async function dropDatabase(cfg, adminCreds) {
  if (!mysql) {
    throw new Error('Driver mysql2 belum terpasang.')
  }
  const conn = await mysql.createConnection({
    host: adminCreds.host || cfg.db.host || 'localhost',
    port: Number(adminCreds.port || cfg.db.port || 3306),
    user: adminCreds.user || 'root',
    password: adminCreds.password || '',
    multipleStatements: true,
  })
  try {
    await conn.query(`DROP DATABASE IF EXISTS \`${cfg.db.name}\``)
    await conn.query(`DROP USER IF EXISTS ?@'localhost'`, [cfg.db.user])
    await conn.query('FLUSH PRIVILEGES')
    return { database: cfg.db.name, user: cfg.db.user }
  } finally {
    await conn.end()
  }
}

// Cek koneksi cepat pakai kredensial instance sendiri (verifikasi setup sukses).
export async function verifyInstanceDb(cfg) {
  if (!mysql) return false
  try {
    const conn = await mysql.createConnection({
      host: cfg.db.host,
      port: Number(cfg.db.port),
      user: cfg.db.user,
      password: cfg.db.password,
      database: cfg.db.name,
    })
    await conn.query('SELECT 1')
    await conn.end()
    return true
  } catch {
    return false
  }
}
