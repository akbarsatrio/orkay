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

  await migrateConstraints()
}

// Cek apakah suatu constraint (FK / UNIQUE) sudah ada di tabel. Idempotent guard.
async function constraintExists(table, constraintName) {
  const rows = await query(
    `SELECT COUNT(*) AS n FROM information_schema.TABLE_CONSTRAINTS
     WHERE table_schema = DATABASE() AND table_name = :table AND constraint_name = :name`,
    { table, name: constraintName }
  )
  return rows[0].n > 0
}

// Tambah UNIQUE(budgets.categoryId) + FOREIGN KEY untuk DB EXISTING.
// Semua idempotent: cek dulu sebelum ADD. Sebelum ADD FK, bersihkan orphan
// supaya ADD CONSTRAINT tidak gagal. Tiap ADD dibungkus try/catch supaya
// satu kegagalan tidak menggagalkan startup (log + lanjut).
async function migrateConstraints() {
  // 1) UNIQUE budgets.categoryId — dedup dulu (sisakan satu id terkecil per kategori).
  if (!(await constraintExists('budgets', 'uq_budget_cat'))) {
    try {
      await pool.query(`
        DELETE b FROM budgets b
        JOIN (
          SELECT categoryId, MIN(id) AS keepId
          FROM budgets GROUP BY categoryId HAVING COUNT(*) > 1
        ) d ON b.categoryId = d.categoryId AND b.id <> d.keepId
      `)
      await pool.query('ALTER TABLE `budgets` ADD UNIQUE KEY uq_budget_cat (categoryId)')
      console.log('[db] migrasi: tambah UNIQUE budgets.categoryId')
    } catch (err) {
      console.error('[db] migrasi UNIQUE budgets.categoryId gagal:', err.message)
    }
  }

  // Definisi FK: [name, table, column, refTable, onDelete, orphanFix]
  // orphanFix: 'setnull' -> UPDATE set NULL untuk orphan (kolom nullable)
  //            'delete'  -> DELETE baris orphan (kolom NOT NULL, tak bisa SET NULL)
  const fks = [
    // transactions (semua nullable -> SET NULL)
    ['fk_tx_category',     'transactions', 'categoryId',     'categories',     'SET NULL', 'setnull'],
    ['fk_tx_account',      'transactions', 'accountId',      'accounts',       'SET NULL', 'setnull'],
    ['fk_tx_income',       'transactions', 'incomeSourceId', 'income_sources', 'SET NULL', 'setnull'],
    ['fk_tx_from_account', 'transactions', 'fromAccountId',  'accounts',       'SET NULL', 'setnull'],
    ['fk_tx_to_account',   'transactions', 'toAccountId',    'accounts',       'SET NULL', 'setnull'],
    ['fk_tx_fee_category', 'transactions', 'feeCategoryId',  'categories',     'SET NULL', 'setnull'],
    // referensi maju (target didefinisikan setelah transactions) -> hanya lewat migrasi
    ['fk_tx_recurring',    'transactions', 'recurringId',    'recurring',      'SET NULL', 'setnull'],
    ['fk_tx_installment',  'transactions', 'installmentId',  'installments',   'SET NULL', 'setnull'],
    // recurring (nullable -> SET NULL)
    ['fk_rec_category',    'recurring',    'categoryId',     'categories',     'SET NULL', 'setnull'],
    ['fk_rec_account',     'recurring',    'accountId',      'accounts',       'SET NULL', 'setnull'],
    // budgets (NOT NULL -> CASCADE, orphan tak bisa SET NULL -> DELETE)
    ['fk_budget_category', 'budgets',      'categoryId',     'categories',     'CASCADE',  'delete'],
    // installments (accountId NOT NULL -> RESTRICT + DELETE orphan; categoryId nullable -> SET NULL)
    ['fk_inst_account',    'installments', 'accountId',      'accounts',       'RESTRICT', 'delete'],
    ['fk_inst_category',   'installments', 'categoryId',     'categories',     'SET NULL', 'setnull'],
  ]

  for (const [name, table, column, refTable, onDelete, orphanFix] of fks) {
    if (await constraintExists(table, name)) continue
    try {
      // Bersihkan orphan: baris yang menunjuk id yang tidak ada di tabel tujuan.
      if (orphanFix === 'setnull') {
        await pool.query(
          `UPDATE \`${table}\` t LEFT JOIN \`${refTable}\` r ON t.\`${column}\` = r.id
           SET t.\`${column}\` = NULL
           WHERE t.\`${column}\` IS NOT NULL AND r.id IS NULL`
        )
      } else {
        await pool.query(
          `DELETE t FROM \`${table}\` t LEFT JOIN \`${refTable}\` r ON t.\`${column}\` = r.id
           WHERE t.\`${column}\` IS NOT NULL AND r.id IS NULL`
        )
      }
      await pool.query(
        `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${name}\`
         FOREIGN KEY (\`${column}\`) REFERENCES \`${refTable}\`(id) ON DELETE ${onDelete}`
      )
      console.log(`[db] migrasi: tambah FK ${name} (${table}.${column} -> ${refTable})`)
    } catch (err) {
      console.error(`[db] migrasi FK ${name} gagal:`, err.message)
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
