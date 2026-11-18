import { query, queryOne } from './db.js'

// Lengkapi field opsional transaksi agar named params tidak error.
// Dipakai oleh routes/transactions.js & routes/recurring.js.
export function normalizeTx(t) {
  return {
    id: t.id,
    type: t.type,
    date: t.date,
    amount: t.amount,
    categoryId: t.categoryId ?? null,
    accountId: t.accountId ?? null,
    incomeSourceId: t.incomeSourceId ?? null,
    fromAccountId: t.fromAccountId ?? null,
    toAccountId: t.toAccountId ?? null,
    fee: t.fee ?? 0,
    feeCategoryId: t.feeCategoryId ?? null,
    recurringId: t.recurringId ?? null,
    installmentId: t.installmentId ?? null,
    statementPeriod: t.statementPeriod ?? null,
    note: t.note ?? null,
    ...normalizeLocation(t),
  }
}

const trimOrNull = (v, max) => {
  if (v == null) return null
  const s = String(v).trim().slice(0, max)
  return s || null
}

// Lokasi opsional: lat & lng harus lengkap dan valid, kalau tidak semua kolom lokasi dikosongkan.
// Transfer tidak punya tempat, jadi lokasinya selalu kosong.
// placeRadius: meter bulat 5–500 kalau diatur manual; di luar itu NULL (pakai default client).
export function normalizeLocation(t) {
  const lat = t.lat == null || t.lat === '' ? NaN : Number(t.lat)
  const lng = t.lng == null || t.lng === '' ? NaN : Number(t.lng)
  const valid = t.type !== 'transfer' && Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  if (!valid) return { lat: null, lng: null, placeName: null, placeAddress: null, placeId: null, placeRadius: null }
  const radius = t.placeRadius == null || t.placeRadius === '' ? NaN : Number(t.placeRadius)
  return {
    lat,
    lng,
    placeName: trimOrNull(t.placeName, 255),
    placeAddress: trimOrNull(t.placeAddress, 500),
    placeId: trimOrNull(t.placeId, 80),
    placeRadius: Number.isInteger(radius) && radius >= 5 && radius <= 500 ? radius : null,
  }
}

// Pastikan ada satu baris settings default (id=1) supaya app punya payDay/theme.
// TIDAK mengisi data dummy apa pun — database mulai kosong dan diisi sendiri lewat UI.
export async function ensureSettings() {
  const row = await queryOne('SELECT id FROM settings WHERE id = 1')
  if (!row) {
    await query(
      'INSERT INTO settings (id, payDay, theme, currency) VALUES (1, :payDay, :theme, :currency)',
      { payDay: 28, theme: 'light', currency: 'IDR' }
    )
  }
}
