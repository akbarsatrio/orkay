import { useEffect, useMemo, useState } from 'react'
import { Search, LocateFixed, MapPin, History, X, Loader2 } from 'lucide-react'
import { Button, fieldClass, cx } from '../ui/index.jsx'
import { searchPlaces, nearbyPlaces, OSM_ATTRIBUTION, OSM_COPYRIGHT_URL } from '../../lib/osm.js'
import { distanceM } from '../../lib/places.js'

// Lokasi dari tempat tersimpan (hasil groupPlaces) dalam bentuk nilai field; radius manual tempatnya ikut.
const fromSaved = (p) => ({ lat: p.lat, lng: p.lng, placeName: p.name, placeAddress: p.address, placeId: p.placeId, placeRadius: p.placeRadius })

export function PlaceRow({ icon: Icon = MapPin, name, address, onSelect }) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="w-full flex items-start gap-3 min-h-11 py-2 text-left rounded-md hover:bg-surface-2/60 active:bg-surface-2"
      >
        <Icon size={16} className="text-muted shrink-0 mt-0.5" aria-hidden="true" />
        <span className="min-w-0">
          <span className="block text-sm text-fg truncate">{name}</span>
          {address && <span className="block text-[13px] text-muted truncate">{address}</span>}
        </span>
      </button>
    </li>
  )
}

export function OsmAttribution() {
  return (
    <p className="text-[12px] text-muted">
      Data tempat{' '}
      <a href={OSM_COPYRIGHT_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-fg">
        {OSM_ATTRIBUTION}
      </a>
    </p>
  )
}

// Daftar saran tempat di sekitar satu titik: tempat yang pernah dipakai (titik di dalam radiusnya) dulu, lalu tempat OSM terdekat.
export function NearbySuggestions({ point, savedPlaces = [], onSelect }) {
  const [osm, setOsm] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const ctrl = new AbortController()
    setOsm(null)
    setFailed(false)
    nearbyPlaces(point.lat, point.lng, ctrl.signal)
      .then(setOsm)
      .catch((e) => { if (e.name !== 'AbortError') { setOsm([]); setFailed(true) } })
    return () => ctrl.abort()
  }, [point.lat, point.lng])

  const saved = useMemo(
    () => savedPlaces.filter((p) => p.name && distanceM(p, point) <= p.radius).slice(0, 3),
    [savedPlaces, point]
  )
  const savedIds = new Set(saved.map((p) => p.placeId).filter(Boolean))
  const osmRows = (osm || []).filter((p) => !savedIds.has(p.placeId))

  return (
    <div className="space-y-1">
      <p className="text-[13px] font-medium text-muted">Tempat di dekat titik ini</p>
      <ul>
        {saved.map((p) => (
          <PlaceRow key={p.key} icon={History} name={p.name} address={p.address} onSelect={() => onSelect(fromSaved(p))} />
        ))}
        {osmRows.map((p) => (
          <PlaceRow key={p.placeId || p.placeName} name={p.placeName} address={p.placeAddress} onSelect={() => onSelect(p)} />
        ))}
      </ul>
      {osm === null && <p className="text-[13px] text-muted flex items-center gap-2 py-1"><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Mencari tempat terdekat…</p>}
      {osm !== null && saved.length === 0 && osmRows.length === 0 && (
        <p className="text-[13px] text-muted py-1">
          {failed ? 'Gagal memuat tempat terdekat. Cek koneksi internet.' : 'Tidak ada tempat bernama di dekat titik ini. Ketik nama tempatnya sendiri.'}
        </p>
      )}
      {osmRows.length > 0 && <OsmAttribution />}
    </div>
  )
}

/**
 * Lokasi transaksi (opsional): lokasi saat ini (GPS), cari tempat (OSM), atau tempat yang pernah dipakai.
 * value: { lat, lng, placeName, placeAddress, placeId, placeRadius } | null. onChange(value | null).
 * savedPlaces: hasil groupPlaces() dari transaksi yang sudah ada. bias: { lat, lng } untuk mengutamakan hasil terdekat.
 */
export default function LocationField({ value, onChange, savedPlaces = [], bias, label = 'Lokasi (opsional)' }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const [gps, setGps] = useState(null) // { lat, lng, accuracy } titik GPS terakhir, untuk saran tempat terdekat

  const term = q.trim()

  useEffect(() => {
    if (value || term.length < 3) { setResults(null); setSearching(false); return }
    const ctrl = new AbortController()
    setSearching(true)
    const id = setTimeout(() => {
      searchPlaces(term, bias, ctrl.signal)
        .then((r) => { setResults(r); setError('') })
        .catch((e) => { if (e.name !== 'AbortError') { setResults([]); setError('Pencarian gagal. Cek koneksi internet.') } })
        .finally(() => { if (!ctrl.signal.aborted) setSearching(false) })
    }, 350)
    return () => { clearTimeout(id); ctrl.abort() }
  }, [term, value, bias?.lat, bias?.lng])

  const savedMatches = useMemo(() => {
    if (!term) return []
    const needle = term.toLowerCase()
    return savedPlaces.filter((p) => p.name && p.name.toLowerCase().includes(needle)).slice(0, 4)
  }, [savedPlaces, term])

  const pick = (loc) => {
    onChange(loc)
    setQ('')
    setResults(null)
    setError('')
  }

  const clear = () => {
    onChange(null)
    setGps(null)
    setError('')
  }

  const locate = () => {
    if (!navigator.geolocation) { setError('Browser ini tidak bisa membaca lokasi.'); return }
    setLocating(true)
    setError('')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setGps({ ...point, accuracy: Math.round(pos.coords.accuracy) })
        pick({ ...point, placeName: '', placeAddress: '', placeId: null, placeRadius: null })
      },
      (err) => {
        setLocating(false)
        setError(err.code === 1
          ? 'Izin lokasi ditolak. Izinkan akses lokasi untuk situs ini di pengaturan browser.'
          : 'Lokasi tidak bisa dibaca. Coba lagi, atau cari tempatnya.')
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
    )
  }

  // Saran tempat terdekat hanya untuk titik GPS yang belum dipasangkan ke tempat bernama.
  const showNearby = value && gps && !value.placeId && value.lat === gps.lat && value.lng === gps.lng

  return (
    <div className="space-y-2">
      {label && <span className="block text-[13px] font-medium text-muted">{label}</span>}

      {value ? (
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <MapPin size={16} className="text-fg shrink-0 mt-2.5 touch:mt-3.5" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <input
                value={value.placeName || ''}
                onChange={(e) => onChange({ ...value, placeName: e.target.value })}
                placeholder="Nama tempat, mis. Warung Bu Ani"
                aria-label="Nama tempat"
                className={cx(fieldClass, 'w-full h-9 touch:h-11 px-3 text-base sm:text-sm')}
              />
              <p className="text-[13px] text-muted mt-1 truncate">
                {value.placeAddress
                  || (showNearby ? `Lokasi saat ini, akurasi ±${gps.accuracy} m` : `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`)}
              </p>
            </div>
            <Button size="icon" variant="ghost" onClick={clear} aria-label="Hapus lokasi" title="Hapus lokasi">
              <X size={16} aria-hidden="true" />
            </Button>
          </div>
          {showNearby && (
            <NearbySuggestions
              point={gps}
              savedPlaces={savedPlaces}
              onSelect={(loc) => onChange({ ...loc, placeName: loc.placeName || value.placeName })}
            />
          )}
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <div className="relative flex-1 min-w-0">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari tempat"
                aria-label="Cari tempat"
                className={cx(fieldClass, 'w-full h-9 touch:h-11 pl-9 pr-3 text-base sm:text-sm')}
              />
            </div>
            <Button variant="secondary" onClick={locate} disabled={locating}>
              {locating ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <LocateFixed size={15} aria-hidden="true" />}
              {locating ? 'Membaca…' : 'Lokasi saat ini'}
            </Button>
          </div>

          {(savedMatches.length > 0 || results !== null || searching) && (
            <div className="space-y-1">
              <ul>
                {savedMatches.map((p) => (
                  <PlaceRow key={p.key} icon={History} name={p.name} address={p.address} onSelect={() => pick(fromSaved(p))} />
                ))}
                {(results || []).map((p) => (
                  <PlaceRow key={p.placeId || `${p.placeName}${p.lat}`} name={p.placeName} address={p.placeAddress} onSelect={() => pick(p)} />
                ))}
              </ul>
              {searching && <p className="text-[13px] text-muted flex items-center gap-2 py-1"><Loader2 size={14} className="animate-spin" aria-hidden="true" /> Mencari…</p>}
              {!searching && results?.length === 0 && savedMatches.length === 0 && !error && (
                <p className="text-[13px] text-muted py-1">Tidak ada hasil. Coba nama lain, atau pakai lokasi saat ini.</p>
              )}
              {results?.length > 0 && <OsmAttribution />}
            </div>
          )}
          {term.length > 0 && term.length < 3 && savedMatches.length === 0 && (
            <p className="text-[13px] text-muted">Ketik minimal 3 huruf.</p>
          )}
        </>
      )}

      {error && <p className="text-[13px] text-negative" role="alert">{error}</p>}
    </div>
  )
}
