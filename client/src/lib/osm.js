// Pencarian tempat dari OpenStreetMap lewat Photon (komoot). Dipilih owner karena hasil Search Box API Mapbox
// tidak boleh disimpan permanen, sedangkan data OSM boleh disimpan dengan atribusi (ODbL).
// Atribusi wajib tampil di dekat hasil pencarian: OSM_ATTRIBUTION.

const BASE = 'https://photon.komoot.io'
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors'
export const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright'

// Fitur yang bukan "tempat belanja" disaring dari saran lokasi terdekat.
const NEARBY_EXCLUDE = ['highway', 'boundary', 'place', 'building', 'man_made', 'landuse', 'natural', 'waterway', 'railway', 'power', 'barrier']

function toPlace(f) {
  const p = f.properties || {}
  const [lng, lat] = f.geometry?.coordinates || []
  const street = p.street ? (p.housenumber ? `${p.street} ${p.housenumber}` : p.street) : ''
  const name = p.name || street
  const address = [name === street ? '' : street, p.district || p.locality, p.city || p.county]
    .filter(Boolean)
    .join(', ')
  return {
    lat,
    lng,
    placeName: name,
    placeAddress: address,
    placeId: p.osm_type && p.osm_id ? `osm:${p.osm_type}${p.osm_id}` : null,
  }
}

async function get(path, params, signal) {
  const qs = new URLSearchParams()
  for (const [k, v] of params) if (v != null && v !== '') qs.append(k, v)
  const res = await fetch(`${BASE}${path}?${qs}`, { signal })
  if (!res.ok) throw new Error('Pencarian tempat gagal')
  const json = await res.json()
  const seen = new Set()
  return (json.features || [])
    .map(toPlace)
    .filter((p) => p.placeName && Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .filter((p) => {
      const k = p.placeId || `${p.placeName}|${p.lat}|${p.lng}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
}

// bias: { lat, lng } supaya hasil terdekat diutamakan.
export function searchPlaces(q, bias, signal) {
  return get('/api', [
    ['q', q],
    ['limit', 8],
    ['lat', bias?.lat],
    ['lon', bias?.lng],
  ], signal)
}

// Tempat di sekitar satu titik (radius ~150 m).
export function nearbyPlaces(lat, lng, signal) {
  return get('/reverse', [
    ['lat', lat],
    ['lon', lng],
    ['limit', 8],
    ['radius', 0.15],
    ...NEARBY_EXCLUDE.map((k) => ['osm_tag', `!${k}`]),
  ], signal)
}
