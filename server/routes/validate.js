import { queryOne } from '../db.js'

// Validasi ringan tanpa dependency (tidak pakai zod/joi).

// Cek format tanggal YYYY-MM-DD + pastikan tanggal valid (bukan 2024-13-40).
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
export function isValidDate(v) {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return false
  const [y, m, d] = v.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  )
}

// amount harus integer >= 0 (tolak NaN/negatif/float). Terima string angka bulat.
export function isNonNegInt(v) {
  const n = Number(v)
  return Number.isInteger(n) && n >= 0
}

// amount harus integer > 0 (dipakai transaksi yang wajib bernilai).
export function isPosInt(v) {
  const n = Number(v)
  return Number.isInteger(n) && n > 0
}

// Cek eksistensi id di sebuah tabel. `table` di-whitelist di caller (bukan dari user).
export async function exists(table, id) {
  if (!id) return false
  const row = await queryOne(`SELECT id FROM \`${table}\` WHERE id = :id`, { id })
  return !!row
}
