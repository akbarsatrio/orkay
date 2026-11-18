// Pengelompokan transaksi berlokasi menjadi "tempat".
// Aturan (keputusan owner): transaksi dengan placeId sama = satu tempat; transaksi tanpa placeId (titik GPS / pin)
// ikut tempat terdekat dalam radius 50 m. Dua placeId berbeda tidak pernah digabung (toko bersebelahan di mal tetap terpisah).

export const SAME_PLACE_RADIUS_M = 50

export const hasLocation = (t) => t.lat != null && t.lng != null

// Jarak dua titik di permukaan bumi (meter), rumus haversine.
export function distanceM(a, b) {
  const R = 6371000
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

function mostFrequent(values) {
  const counts = new Map()
  for (const v of values) if (v) counts.set(v, (counts.get(v) || 0) + 1)
  let best = ''
  let n = 0
  for (const [v, c] of counts) if (c > n) { best = v; n = c }
  return best
}

/**
 * txs: transaksi (boleh campur; yang tanpa lokasi dilewati).
 * Hasil: [{ key, lat, lng, name, address, placeId, total, count, txs, lastDate, categoryTotals }] urut total terbesar.
 */
export function groupPlaces(txs) {
  const located = txs.filter(hasLocation)
  const groups = []
  const byPlaceId = new Map()

  // 1) Hasil pencarian: kelompokkan per placeId; titik tempat = titik transaksi pertama.
  for (const t of located) {
    if (!t.placeId) continue
    let g = byPlaceId.get(t.placeId)
    if (!g) {
      g = { key: `p:${t.placeId}`, placeId: t.placeId, lat: t.lat, lng: t.lng, txs: [] }
      byPlaceId.set(t.placeId, g)
      groups.push(g)
    }
    g.txs.push(t)
  }

  // 2) Titik tanpa placeId: gabung ke tempat terdekat <= 50 m, kalau tidak ada jadi tempat baru.
  for (const t of located) {
    if (t.placeId) continue
    let best = null
    let bestD = Infinity
    for (const g of groups) {
      const d = distanceM(g, t)
      if (d <= SAME_PLACE_RADIUS_M && d < bestD) { best = g; bestD = d }
    }
    if (best) best.txs.push(t)
    else groups.push({ key: `g:${t.id}`, placeId: null, lat: t.lat, lng: t.lng, txs: [t] })
  }

  return groups
    .map((g) => {
      const categoryTotals = {}
      let total = 0
      let lastDate = ''
      for (const t of g.txs) {
        total += t.amount
        if (t.categoryId) categoryTotals[t.categoryId] = (categoryTotals[t.categoryId] || 0) + t.amount
        if (t.date > lastDate) lastDate = t.date
      }
      return {
        ...g,
        name: mostFrequent(g.txs.map((t) => t.placeName)),
        address: mostFrequent(g.txs.map((t) => t.placeAddress)),
        total,
        count: g.txs.length,
        lastDate,
        categoryTotals,
        txs: [...g.txs].sort((a, b) => (a.date < b.date ? 1 : -1)),
      }
    })
    .sort((a, b) => b.total - a.total)
}

// Kategori dengan nominal terbesar di satu tempat.
export function topCategoryId(place) {
  let best = null
  let n = -1
  for (const [id, v] of Object.entries(place.categoryTotals)) if (v > n) { best = id; n = v }
  return best
}

// Lokasi milik satu transaksi dalam bentuk yang dipakai form & API.
export function locationOf(t) {
  if (!hasLocation(t)) return null
  return { lat: t.lat, lng: t.lng, placeName: t.placeName || '', placeAddress: t.placeAddress || '', placeId: t.placeId || null }
}

export const NO_LOCATION = { lat: null, lng: null, placeName: null, placeAddress: null, placeId: null }
