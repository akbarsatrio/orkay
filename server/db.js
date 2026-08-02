import mysql from 'mysql2/promise'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { config } from './config.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCHEMA_PATH = join(__dirname, 'schema.sql')

// Pool koneksi MySQL. namedPlaceholders biar bisa pakai :param.
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  charset: 'utf8mb4',
})

export default pool

// ---- Query helpers ----
export async function query(sql, params = {}) {
  const [rows] = await pool.execute(sql, params)
  return rows
}

export async function queryOne(sql, params = {}) {
  const rows = await query(sql, params)
  return rows[0] || null
}

// Jalankan beberapa operasi dalam satu transaksi.
// callback menerima objek { run } untuk eksekusi bertransaksi.
export async function withTransaction(callback) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const run = (sql, params = {}) => conn.execute(sql, params)
    const result = await callback({ run, conn })
    await conn.commit()
    return result
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

// Jalankan schema.sql (dipisah per statement).
export async function initDb() {
  const schema = readFileSync(SCHEMA_PATH, 'utf-8')
  const statements = schema
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  for (const stmt of statements) {
    await pool.query(stmt)
  }
  await migrateSchema()
}

// Tambahkan kolom baru ke tabel yang mungkin sudah ada dari versi lama.
// Aman & idempotent: cek information_schema dulu sebelum ALTER.
async function migrateSchema() {
  const additions = [
    ['accounts', 'kind', "VARCHAR(20) NOT NULL DEFAULT 'cash'"],
    ['accounts', 'creditLimit', 'BIGINT NOT NULL DEFAULT 0'],
    ['accounts', 'closingDay', 'INT NOT NULL DEFAULT 1'],
    ['accounts', 'dueDay', 'INT NOT NULL DEFAULT 1'],
    ['accounts', 'dueMonthOffset', 'INT NOT NULL DEFAULT 1'],
    ['accounts', 'billingModel', "VARCHAR(20) NOT NULL DEFAULT 'statement'"],
    ['transactions', 'installmentId', 'VARCHAR(40)'],
    ['transactions', 'statementPeriod', 'VARCHAR(7)'],
  ]
  for (const [table, column, definition] of additions) {
    const rows = await query(
      `SELECT COUNT(*) AS n FROM information_schema.columns
       WHERE table_schema = DATABASE() AND table_name = :table AND column_name = :column`,
      { table, column }
    )
    if (rows[0].n === 0) {
      await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`)
      console.log(`[db] migrasi: tambah kolom ${table}.${column}`)
    }
  }
}

// ---- Helper (de)serialize recurring ----
// generatedPeriods disimpan sebagai kolom JSON. mysql2 mengembalikannya
// sudah dalam bentuk array; saat menulis kita kirim string JSON.
export function parseRecurring(row) {
  if (!row) return row
  let periods = row.generatedPeriods
  if (typeof periods === 'string') {
    try {
      periods = JSON.parse(periods)
    } catch {
      periods = []
    }
  }
  return {
    ...row,
    active: !!row.active,
    generatedPeriods: Array.isArray(periods) ? periods : [],
  }
}

export function serializeRecurring(rec) {
  return {
    ...rec,
    active: rec.active ? 1 : 0,
    generatedPeriods: JSON.stringify(rec.generatedPeriods || []),
  }
}
