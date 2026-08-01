import { load, save } from './storage.js'

const API = 'https://tanggalmerah.upset.dev/api/holidays?year='

// Ambil hari libur per tahun. Cache di localStorage biar gak fetch berulang.
// Return array: [{ date, day, name, type }]
export async function fetchHolidays(year) {
  const cacheKey = `holidays:${year}`
  const cached = load(cacheKey, null)
  if (cached && Array.isArray(cached.data)) {
    // cache 30 hari
    if (Date.now() - (cached.ts || 0) < 30 * 86400000) {
      return cached.data
    }
  }

  try {
    const res = await fetch(API + year)
    const json = await res.json()
    if (json && json.success && Array.isArray(json.data)) {
      save(cacheKey, { ts: Date.now(), data: json.data })
      return json.data
    }
  } catch {
    // offline / gagal — pakai cache lama kalau ada
    if (cached && Array.isArray(cached.data)) return cached.data
  }
  return []
}

// Gabung beberapa tahun jadi satu Set ISO date untuk perhitungan payday.
export async function buildHolidaySet(years) {
  const set = new Set()
  const all = []
  for (const y of years) {
    const list = await fetchHolidays(y)
    for (const h of list) {
      set.add(h.date)
      all.push(h)
    }
  }
  return { set, list: all }
}
