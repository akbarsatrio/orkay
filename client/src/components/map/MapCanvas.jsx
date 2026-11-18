import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

// Peta dasar monokrom (light/dark ikut tema) supaya warna kategori pada titik terbaca jelas.
const STYLE = { light: 'mapbox://styles/mapbox/light-v11', dark: 'mapbox://styles/mapbox/dark-v11' }
const INDONESIA = { center: [118, -2.5], zoom: 3.6 }

// Ramp heatmap sekuensial kuning → merah tua: konvensi umum "makin panas makin banyak".
// Sengaja tidak memakai oranye aksen (#C2410C / #F97316) supaya aksen tetap khusus Tambah Transaksi.
const HEAT_RAMP = [
  'interpolate', ['linear'], ['heatmap-density'],
  0, 'rgba(250, 204, 21, 0)',
  0.2, 'rgba(250, 204, 21, 0.55)',
  0.45, 'rgb(245, 158, 11)',
  0.7, 'rgb(220, 38, 38)',
  1, 'rgb(127, 29, 29)',
]

const MODE_LAYERS = {
  points: ['tx-points', 'tx-selected'],
  clusters: ['cluster-circles', 'cluster-labels', 'cluster-points', 'selected'],
  heat: ['heat', 'heat-points', 'selected'],
}
const ALL_LAYERS = ['heat', 'heat-points', 'tx-points', 'tx-selected', 'cluster-circles', 'cluster-labels', 'cluster-points', 'selected']
const CLICKABLE = ['tx-points', 'cluster-circles', 'cluster-points', 'heat-points']
const RADIUS_M = 50 // sama dengan SAME_PLACE_RADIUS_M di lib/places.js

// Lingkaran berjari-jari meter sebagai poligon (64 titik), untuk area 50 m tempat/titik yang dibuka.
function circleGeoJSON(center, meters) {
  if (!center) return { type: 'FeatureCollection', features: [] }
  const dLat = meters / 111320
  const dLng = meters / (111320 * Math.cos((center.lat * Math.PI) / 180))
  const ring = []
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI
    ring.push([center.lng + dLng * Math.cos(a), center.lat + dLat * Math.sin(a)])
  }
  return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} }] }
}

// "1,2 jt" sebagai ekspresi Mapbox untuk label cluster. Tanpa "Rp" supaya muat di lingkaran; konteks uang
// sudah jelas dari ringkasan & daftar tempat.
const compactRp = (v) => [
  'case',
  ['>=', v, 1e9], ['concat', ['number-format', ['/', v, 1e9], { locale: 'id-ID', 'max-fraction-digits': 1 }], ' M'],
  ['>=', v, 1e6], ['concat', ['number-format', ['/', v, 1e6], { locale: 'id-ID', 'max-fraction-digits': 1 }], ' jt'],
  ['>=', v, 1e3], ['concat', ['number-format', ['/', v, 1e3], { locale: 'id-ID', 'max-fraction-digits': 0 }], ' rb'],
  ['number-format', v, { locale: 'id-ID' }],
]

function tokenColor(name) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim()
  return v ? `rgb(${v.split(/\s+/).join(', ')})` : '#000'
}

function placesGeoJSON(places) {
  const max = Math.max(1, ...places.map((p) => p.total))
  return {
    type: 'FeatureCollection',
    features: places.map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      // r: luas lingkaran sebanding nominal (akar), 7–26 px.
      properties: { key: p.key, total: p.total, count: p.count, color: p.color, r: 7 + 19 * Math.sqrt(p.total / max) },
    })),
  }
}

// Satu fitur per transaksi di koordinat aslinya. key = tempatnya (ketuk titik = rincian tempat).
// r: luas lingkaran sebanding nominal (akar), 5–14 px; lebih kecil dari titik tempat karena bisa bertumpuk.
function txGeoJSON(txs) {
  const max = Math.max(1, ...txs.map((t) => t.amount))
  return {
    type: 'FeatureCollection',
    features: txs.map((t) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [t.lng, t.lat] },
      properties: { id: t.id, amount: t.amount, color: t.color, key: t.placeKey, r: 5 + 9 * Math.sqrt(t.amount / max) },
    })),
  }
}

function addLayers(map, { maxAmount, hidden }) {
  if (map.getSource('places')) return // style lama masih dipakai (setStyle bisa diff), layer sudah ada
  const fg = tokenColor('fg')
  const bg = tokenColor('bg')

  map.addSource('places', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addSource('clusters', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: true,
    clusterRadius: 50,
    clusterMaxZoom: 15,
    clusterProperties: { total: ['+', ['get', 'total']], visits: ['+', ['get', 'count']] },
  })
  map.addSource('txs', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addSource('radius', { type: 'geojson', data: circleGeoJSON(null) })

  // Area 50 m di bawah semua titik: isian tipis + garis putus-putus warna teks.
  map.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius', paint: { 'fill-color': fg, 'fill-opacity': 0.08 } })
  map.addLayer({ id: 'radius-line', type: 'line', source: 'radius', paint: { 'line-color': fg, 'line-width': 1.5, 'line-opacity': 0.6, 'line-dasharray': [2, 2] } })

  const placeCircle = {
    'circle-radius': ['get', 'r'],
    'circle-color': ['get', 'color'],
    'circle-opacity': 0.85,
    'circle-stroke-width': 2,
    'circle-stroke-color': bg,
  }

  map.addLayer({
    id: 'heat',
    type: 'heatmap',
    source: 'txs',
    maxzoom: 17,
    paint: {
      'heatmap-weight': ['interpolate', ['linear'], ['get', 'amount'], 0, 0, Math.max(1, maxAmount), 1],
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 15, 3],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 6, 15, 36],
      'heatmap-color': HEAT_RAMP,
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.9, 16.5, 0],
    },
  })
  // Di zoom dekat heatmap memudar dan titik tempat muncul supaya tetap bisa diketuk.
  map.addLayer({ id: 'heat-points', type: 'circle', source: 'places', minzoom: 14, paint: { ...placeCircle, 'circle-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 16, 0.85], 'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 16, 1] } })
  map.addLayer({ id: 'tx-points', type: 'circle', source: 'txs', paint: { ...placeCircle, 'circle-stroke-width': 1.5 } })
  map.addLayer({
    id: 'tx-selected',
    type: 'circle',
    source: 'txs',
    filter: ['==', ['get', 'key'], ''],
    paint: { 'circle-radius': ['+', ['get', 'r'], 4], 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-width': 2.5, 'circle-stroke-color': fg },
  })
  map.addLayer({
    id: 'cluster-circles',
    type: 'circle',
    source: 'clusters',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': fg,
      'circle-radius': ['step', ['get', 'point_count'], 22, 5, 25, 20, 30],
      'circle-stroke-width': 3,
      'circle-stroke-color': bg,
    },
  })
  map.addLayer({
    id: 'cluster-labels',
    type: 'symbol',
    source: 'clusters',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': hidden ? ['concat', ['to-string', ['get', 'visits']], ' trx'] : compactRp(['get', 'total']),
      'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
      'text-size': 12,
      'text-allow-overlap': true,
    },
    paint: { 'text-color': bg },
  })
  map.addLayer({ id: 'cluster-points', type: 'circle', source: 'clusters', filter: ['!', ['has', 'point_count']], paint: placeCircle })
  map.addLayer({
    id: 'selected',
    type: 'circle',
    source: 'places',
    filter: ['==', ['get', 'key'], ''],
    paint: {
      'circle-radius': ['+', ['get', 'r'], 5],
      'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-width': 3,
      'circle-stroke-color': fg,
    },
  })
}

/**
 * Peta Mapbox. places: hasil groupPlaces + color. located: transaksi berlokasi + color + placeKey (Titik & Heatmap).
 * mode: 'points' | 'clusters' | 'heat'. heatWeight: 'amount' | 'count'.
 * fitKey: berubah = peta menyesuaikan ke semua titik (dipakai saat filter berubah).
 * insets: area yang tertutup panel mengambang { top, right, bottom, left } dalam px.
 * keepVisible: { lat, lng } titik/tempat yang sedang dibuka; peta digeser kalau tertutup panel.
 * radiusAt: { lat, lng } pusat lingkaran 50 m (tempat/titik yang dibuka), atau null.
 * Callback: onSelectPlace(key), onPick({ lat, lng }) (ketuk peta / Enter di peta), onError(kind).
 */
export default function MapCanvas({
  token, theme, places, located, mode, heatWeight, hidden, selectedKey, picked, fitKey, focus, keepVisible, radiusAt,
  onSelectPlace, onPick, onError, onHover, insets, className,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const [styleReady, setStyleReady] = useState(0) // naik tiap style selesai dimuat (awal & ganti tema)
  const latest = useRef({})
  latest.current = { places, located, mode, heatWeight, hidden, selectedKey, insets, onSelectPlace, onPick, onError, onHover }

  // Buat peta sekali.
  useEffect(() => {
    let map
    try {
      mapboxgl.accessToken = token
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: STYLE[theme] || STYLE.light,
        center: INDONESIA.center,
        zoom: INDONESIA.zoom,
        language: 'id',
        cooperativeGestures: false,
      })
    } catch {
      latest.current.onError?.('webgl')
      return undefined
    }
    mapRef.current = map
    // Kontrol di kanan bawah; halaman menggesernya keluar dari bawah panel mengambang (CSS var --inset-*).
    // Tombol zoom hanya di desktop: di HP cubit dua jari sudah cukup dan ruang di antara panel sempit.
    if (window.matchMedia('(min-width: 1024px)').matches) map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right')
    map.addControl(new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, showUserHeading: false }), 'bottom-right')
    // Alternatif keyboard untuk memilih titik (tanpa tombol, keputusan owner): fokus ke peta, geser dengan tombol panah,
    // lalu Enter memilih tengah area peta yang terlihat (di luar panel mengambang).
    const canvas = map.getCanvas()
    canvas.setAttribute('aria-label', 'Peta transaksi. Geser dengan tombol panah, tekan Enter untuk memilih titik di tengah peta.')
    canvas.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return
      const i = { top: 0, right: 0, bottom: 0, left: 0, ...latest.current.insets }
      const c = map.getContainer()
      const p = map.unproject([(i.left + c.clientWidth - i.right) / 2, (i.top + c.clientHeight - i.bottom) / 2])
      latest.current.onPick({ lat: p.lat, lng: p.lng })
    })

    map.on('style.load', () => {
      const maxAmount = Math.max(1, ...latest.current.located.map((t) => t.amount))
      addLayers(map, { maxAmount, hidden: latest.current.hidden })
      setStyleReady((n) => n + 1)
    })
    map.on('error', (e) => {
      const status = e?.error?.status
      if (status === 401 || status === 403) latest.current.onError?.('token')
    })

    map.on('click', (e) => {
      const visible = CLICKABLE.filter((id) => map.getLayer(id) && map.getLayoutProperty(id, 'visibility') !== 'none')
      const [f] = visible.length ? map.queryRenderedFeatures(e.point, { layers: visible }) : []
      if (f?.properties?.cluster) {
        const center = f.geometry.coordinates
        const ease = (zoom) => map.easeTo({ center, zoom })
        const src = map.getSource('clusters')
        const r = src.getClusterExpansionZoom(f.properties.cluster_id, (err, zoom) => { if (!err) ease(zoom) })
        if (r && typeof r.then === 'function') r.then(ease).catch(() => {})
        return
      }
      if (f?.properties?.key) { latest.current.onSelectPlace(f.properties.key); return }
      latest.current.onPick({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    })
    for (const id of CLICKABLE) {
      map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', id, () => { map.getCanvas().style.cursor = '' })
    }

    // Tooltip saat kursor di atas titik (hanya perangkat dengan hover; di layar sentuh ketuk = rincian).
    // Dikirim ke halaman sebagai target + posisi titik di layar; isi tooltip dirender halaman.
    if (window.matchMedia('(hover: hover)').matches) {
      let last = null
      const leave = () => { last = null; latest.current.onHover?.(null) }
      const hover = (e) => {
        const f = e.features?.[0]
        if (!f) return
        const p = f.properties
        const id = p.cluster ? `c:${p.cluster_id}` : p.id ? `t:${p.id}` : `p:${p.key}`
        if (id === last) return
        last = id
        const pt = map.project(f.geometry.coordinates)
        const at = { x: pt.x, y: pt.y }
        if (p.cluster) {
          const done = (leaves) => { if (last === id) latest.current.onHover?.({ kind: 'places', keys: leaves.map((l) => l.properties.key), at }) }
          const r = map.getSource('clusters').getClusterLeaves(p.cluster_id, 1000, 0, (err, leaves) => { if (!err) done(leaves) })
          if (r && typeof r.then === 'function') r.then(done).catch(() => {})
        } else if (p.id) {
          latest.current.onHover?.({ kind: 'tx', id: p.id, at })
        } else {
          latest.current.onHover?.({ kind: 'places', keys: [p.key], at })
        }
      }
      for (const id of CLICKABLE) {
        map.on('mousemove', id, hover)
        map.on('mouseleave', id, leave)
      }
      map.on('movestart', leave) // posisi tooltip tidak ikut bergeser, jadi disembunyikan saat peta bergerak
    }

    return () => { map.remove(); mapRef.current = null }
    // Token & tema awal saja; ganti tema ditangani effect di bawah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Ganti tema = ganti style; layer dipasang ulang di handler style.load.
  const firstTheme = useRef(theme)
  useEffect(() => {
    if (theme === firstTheme.current) return
    firstTheme.current = theme
    // diff: false = muat ulang penuh, supaya layer dipasang ulang dengan warna token tema baru.
    mapRef.current?.setStyle(STYLE[theme] || STYLE.light, { diff: false })
  }, [theme])

  // Data titik.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady || !map.getSource('places')) return
    const data = placesGeoJSON(places)
    map.getSource('places').setData(data)
    map.getSource('clusters').setData(data)
    map.getSource('txs').setData(txGeoJSON(located))
    const maxAmount = Math.max(1, ...located.map((t) => t.amount))
    map.setPaintProperty('heat', 'heatmap-weight', heatWeight === 'amount'
      ? ['interpolate', ['linear'], ['get', 'amount'], 0, 0, maxAmount, 1]
      : 1)
  }, [places, located, heatWeight, styleReady])

  // Label cluster ikut tombol sembunyikan saldo.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady || !map.getLayer('cluster-labels')) return
    map.setLayoutProperty('cluster-labels', 'text-field', hidden ? ['concat', ['to-string', ['get', 'visits']], ' trx'] : compactRp(['get', 'total']))
  }, [hidden, styleReady])

  // Mode tampilan.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return
    const on = new Set(MODE_LAYERS[mode])
    for (const id of ALL_LAYERS) if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on.has(id) ? 'visible' : 'none')
  }, [mode, styleReady])

  // Sorotan tempat terpilih.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady || !map.getLayer('selected')) return
    map.setFilter('selected', ['==', ['get', 'key'], selectedKey || ''])
    map.setFilter('tx-selected', ['==', ['get', 'key'], selectedKey || ''])
  }, [selectedKey, styleReady])

  // Lingkaran 50 m di sekitar tempat/titik yang dibuka.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady || !map.getSource('radius')) return
    map.getSource('radius').setData(circleGeoJSON(radiusAt ? { lat: radiusAt.lat, lng: radiusAt.lng } : null, RADIUS_M))
  }, [radiusAt?.lat, radiusAt?.lng, styleReady])

  // Pin titik yang dipilih.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!picked) { markerRef.current?.remove(); markerRef.current = null; return }
    if (!markerRef.current) markerRef.current = new mapboxgl.Marker({ color: tokenColor('fg') })
    markerRef.current.setLngLat([picked.lng, picked.lat]).addTo(map)
  }, [picked])

  // Area peta yang tertutup panel mengambang (insets) diperhitungkan langsung di tiap gerakan kamera:
  // fitBounds memakai padding = insets + 48, easeTo memakai offset ke tengah area yang terlihat.
  const ins = () => ({ top: 0, right: 0, bottom: 0, left: 0, ...latest.current.insets })
  const visibleOffset = () => { const i = ins(); return [(i.left - i.right) / 2, (i.top - i.bottom) / 2] }

  // Sesuaikan tampilan ke semua titik saat filter berubah.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleReady) return
    const pts = latest.current.places
    if (!pts.length) return
    if (pts.length === 1) { map.easeTo({ center: [pts[0].lng, pts[0].lat], zoom: 15, offset: visibleOffset() }); return }
    const b = new mapboxgl.LngLatBounds()
    for (const p of pts) b.extend([p.lng, p.lat])
    const i = ins()
    map.fitBounds(b, {
      padding: { top: i.top + 48, right: i.right + 48, bottom: i.bottom + 48, left: i.left + 48 },
      maxZoom: 15,
      duration: 600,
    })
  }, [fitKey, styleReady > 0])

  // Terbang ke titik tertentu (tempat dipilih dari daftar).
  useEffect(() => {
    const map = mapRef.current
    if (!map || !focus) return
    map.easeTo({ center: [focus.lng, focus.lat], zoom: Math.max(map.getZoom(), 15), offset: visibleOffset() })
  }, [focus])

  // Titik/tempat yang sedang dibuka tetap terlihat: kalau panel yang membesar menutupinya, peta digeser seperlunya.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !keepVisible) return
    const i = ins()
    const c = map.getContainer()
    const p = map.project([keepVisible.lng, keepVisible.lat])
    const m = 40
    const inside = p.x >= i.left + m && p.x <= c.clientWidth - i.right - m && p.y >= i.top + m && p.y <= c.clientHeight - i.bottom - m
    if (!inside) map.easeTo({ center: [keepVisible.lng, keepVisible.lat], offset: visibleOffset() })
  }, [keepVisible?.lat, keepVisible?.lng, insets?.top, insets?.right, insets?.bottom])

  return <div ref={containerRef} className={className} role="region" aria-label="Peta transaksi" />
}
