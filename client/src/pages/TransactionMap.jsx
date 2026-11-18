import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { MapPinned, ChevronLeft, X, Plus, Link2, Search, Loader2, SlidersHorizontal, Pencil } from 'lucide-react'
import { Button, Checkbox, Segmented, Select, fieldClass, cx } from '../components/ui/index.jsx'
import BalanceToggle from '../components/layout/BalanceToggle.jsx'
import MonthPicker from '../components/ui/MonthPicker.jsx'
import CategoryIcon from '../components/CategoryIcon.jsx'
import MapCanvas from '../components/map/MapCanvas.jsx'
import { NearbySuggestions } from '../components/transactions/LocationField.jsx'
import TransactionForm from '../components/transactions/TransactionForm.jsx'
import { useIsMobile } from '../components/ui/SwipeRow.jsx'
import { useData } from '../context/DataContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { useBalanceVisibility } from '../context/BalanceVisibilityContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import { api } from '../lib/api.js'
import { formatDate, formatRupiah, maskRupiah, monthNamesID } from '../lib/format.js'
import { DEFAULT_PLACE_RADIUS_M, PLACE_RADIUS_OPTIONS, groupPlaces, hasLocation, topCategoryId } from '../lib/places.js'

let tokenCache = null
function useMapboxToken() {
  const [state, setState] = useState(() => (tokenCache != null ? { status: 'ready', token: tokenCache } : { status: 'loading' }))
  useEffect(() => {
    if (tokenCache != null) return
    let alive = true
    api.get('/config')
      .then((c) => { tokenCache = c.mapboxToken || ''; if (alive) setState({ status: 'ready', token: tokenCache }) })
      .catch(() => { if (alive) setState({ status: 'error' }) })
    return () => { alive = false }
  }, [])
  return state
}

const TYPE_OPTIONS = [
  { value: 'expense', label: 'Pengeluaran' },
  { value: 'income', label: 'Pemasukan' },
]
const MODE_OPTIONS = [
  { value: 'points', label: 'Titik' },
  { value: 'clusters', label: 'Cluster' },
  { value: 'heat', label: 'Heatmap' },
]
const PERIOD_OPTIONS = [
  { value: 'month', label: 'Bulanan' },
  { value: 'all', label: 'Semua' },
]
const WEIGHT_OPTIONS = [
  { value: 'amount', label: 'Nominal' },
  { value: 'count', label: 'Frekuensi' },
]

export default function TransactionMap() {
  const { transactions, categories, accounts, categoryMap, accountMap, updateTransaction, deleteTransaction } = useData()
  const { theme } = useTheme()
  const { hidden } = useBalanceVisibility()
  const confirm = useConfirm()
  const mobile = useIsMobile()
  const tokenState = useMapboxToken()
  const now = new Date()

  const [period, setPeriod] = useState('month')
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() })
  const [type, setType] = useState('expense')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [mode, setMode] = useState('clusters')
  const [heatWeight, setHeatWeight] = useState('amount')
  const [selectedKey, setSelectedKey] = useState(null)
  const [picked, setPicked] = useState(null) // { lat, lng, placeName, placeAddress, placeId, placeRadius }
  const [attaching, setAttaching] = useState(false)
  const [focus, setFocus] = useState(null)
  const [hover, setHover] = useState(null) // { kind: 'tx', id, at } | { kind: 'places', keys, at }
  const [mapError, setMapError] = useState(null)
  const [form, setForm] = useState({ open: false, editing: null, defaults: null })
  const [filterOpen, setFilterOpen] = useState(false) // HP: panel atas melebar menampilkan semua filter
  const [insets, setInsets] = useState({ top: 0, right: 0, bottom: 0, left: 0 })
  const shellRef = useRef(null)
  const topRef = useRef(null)
  const sideRef = useRef(null)
  const sheetRef = useRef(null)
  const bodyRefs = useRef([])

  // Area peta yang tertutup panel mengambang: dipakai peta (titik tengah & fitBounds) dan posisi kontrol Mapbox.
  useLayoutEffect(() => {
    const shell = shellRef.current
    if (!shell) return undefined
    const measure = () => {
      const s = shell.getBoundingClientRect()
      const top = topRef.current?.getBoundingClientRect()
      const side = sideRef.current?.offsetParent ? sideRef.current.getBoundingClientRect() : null
      const sheet = sheetRef.current?.offsetParent ? sheetRef.current.getBoundingClientRect() : null
      setInsets({
        top: top ? Math.round(top.bottom - s.top) : 0,
        right: side ? Math.round(s.right - side.left) : 0,
        bottom: sheet ? Math.round(s.bottom - sheet.top) : 0,
        left: 0,
      })
    }
    const ro = new ResizeObserver(measure)
    for (const el of [shell, topRef.current, sideRef.current, sheetRef.current]) if (el) ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [mobile])

  const monthPrefix = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`
  const matching = useMemo(() => transactions.filter((t) =>
    t.type === type
    && (period === 'all' || t.date.startsWith(monthPrefix))
    && (!categoryId || t.categoryId === categoryId)
    && (!accountId || t.accountId === accountId)
  ), [transactions, type, period, monthPrefix, categoryId, accountId])
  const located = useMemo(() => matching.filter(hasLocation), [matching])
  const places = useMemo(
    () => groupPlaces(located).map((p) => ({ ...p, color: categoryMap[topCategoryId(p)]?.color || '#71717a' })),
    [located, categoryMap]
  )
  // Mode Titik: satu titik per transaksi di koordinat aslinya; warna = kategorinya, key = tempatnya (ketuk = rincian tempat).
  const txPoints = useMemo(
    () => places.flatMap((p) => p.txs.map((t) => ({ ...t, placeKey: p.key, color: categoryMap[t.categoryId]?.color || '#71717a' }))),
    [places, categoryMap]
  )
  // Semua tempat yang pernah dipakai (tanpa filter), untuk saran nama titik.
  const allPlaces = useMemo(() => groupPlaces(transactions), [transactions])
  const total = located.reduce((s, t) => s + t.amount, 0)
  const selected = places.find((p) => p.key === selectedKey) || null
  const fitKey = `${type}|${period}|${monthPrefix}|${categoryId}|${accountId}`
  // Ganti mode/filter menyembunyikan layer tanpa event mouseleave, jadi tooltip dibersihkan di sini.
  useEffect(() => { setHover(null) }, [mode, fitKey])

  // Tempat terpilih hilang → ikuti transaksinya ke tempat barunya (radius diubah bisa memecah/menggabung tempat);
  // kalau transaksinya tidak ada lagi di filter, kembali ke daftar.
  const selectedTx = useRef(null)
  useEffect(() => { if (selected) selectedTx.current = selected.txs[0]?.id }, [selected])
  useEffect(() => {
    if (!selectedKey || selected) return
    const hit = places.find((p) => p.txs.some((t) => t.id === selectedTx.current))
    setSelectedKey(hit ? hit.key : null)
  }, [selectedKey, selected, places])
  // Radius yang sedang diubah di rincian tempat, supaya lingkaran di peta langsung ikut.
  const [draftRadius, setDraftRadius] = useState(null)

  // Setelah titik dipakai untuk transaksi (baru atau lama), pilih tempatnya dan lepas pin.
  useEffect(() => {
    if (!picked) return
    const hit = places.find((p) => p.txs.some((t) => t.lat === picked.lat && t.lng === picked.lng))
    if (hit) { setPicked(null); setAttaching(false); setSelectedKey(hit.key) }
  }, [places, picked])

  // Isi panel rincian digulung ke atas tiap ganti tempat/titik.
  const revealPanel = () => {
    requestAnimationFrame(() => bodyRefs.current.forEach((el) => el && (el.scrollTop = 0)))
  }
  const selectPlace = (key, fly = false) => {
    setPicked(null)
    setAttaching(false)
    setSelectedKey(key)
    const p = places.find((x) => x.key === key)
    if (fly && p) setFocus({ lat: p.lat, lng: p.lng })
    revealPanel()
  }
  const pickPoint = (pt) => {
    setSelectedKey(null)
    setAttaching(false)
    setPicked({ lat: pt.lat, lng: pt.lng, placeName: '', placeAddress: '', placeId: null, placeRadius: null })
    revealPanel()
  }

  const askDelete = (t) => confirm({
    title: 'Hapus transaksi',
    message: <>Hapus <b>{t.note || categoryMap[t.categoryId]?.name || 'Transaksi'}</b> sebesar {formatRupiah(t.amount)} ({formatDate(t.date)})?</>,
    detail: 'Saldo rekening dihitung ulang tanpa transaksi ini. Tindakan ini tidak bisa dibatalkan.',
    onConfirm: () => deleteTransaction(t.id),
  })

  const newAt = (loc) => setForm({ open: true, editing: null, defaults: { type, ...loc } })
  // Lokasi tujuan "Pasang ke transaksi lama": titik yang dipilih, atau tempat yang sedang dibuka.
  const placeLoc = (p) => ({ lat: p.lat, lng: p.lng, placeName: p.name, placeAddress: p.address, placeId: p.placeId, placeRadius: p.placeRadius })
  const target = picked || (selected && placeLoc(selected))
  const attachTo = async (txs) => {
    await Promise.all(txs.map((t) => updateTransaction(t.id, { ...target })))
    if (!picked) setAttaching(false) // tempat yang sudah ada: kembali ke rinciannya (transaksi baru langsung terlihat)
  }
  // Tutup satu langkah: daftar pasang → titik/tempat, titik/tempat → peta.
  const closePanel = () => {
    if (attaching) setAttaching(false)
    else if (picked) setPicked(null)
    else setSelectedKey(null)
  }
  // Lokasi untuk peta mini rincian di HP, termasuk radius yang sedang diubah.
  const panelLoc = picked
    ? { lat: picked.lat, lng: picked.lng, radius: picked.placeRadius || DEFAULT_PLACE_RADIUS_M, color: null }
    : selected && { lat: selected.lat, lng: selected.lng, radius: draftRadius || selected.radius, color: selected.color }
  // Ubah tempat = ganti placeName & placeRadius di semua transaksi tempat itu (semua periode, bukan hanya yang lolos filter).
  const updatePlace = async (place, { name, radius }) => {
    const full = allPlaces.find((g) => g.txs.some((t) => t.id === place.txs[0].id)) || place
    await Promise.all(full.txs.map((t) => updateTransaction(t.id, { placeName: name.trim(), placeRadius: radius })))
  }

  const catOptions = categories.filter((c) => c.type === type)
  const accOptions = accounts.filter((a) => a.kind !== 'investment' && (type === 'expense' || a.kind !== 'paylater'))
  const periodLabel = period === 'all' ? 'semua waktu' : `${monthNamesID[cursor.m]} ${cursor.y}`
  const money = (v) => maskRupiah(v, hidden)

  let panel
  if (attaching && target) {
    panel = (
      <AttachList
        candidates={matching.filter((t) => !hasLocation(t))}
        categoryMap={categoryMap}
        accountMap={accountMap}
        money={money}
        periodAll={period === 'all'}
        backLabel={picked ? 'Kembali ke titik dipilih' : 'Kembali ke rincian tempat'}
        onBack={() => setAttaching(false)}
        onAttach={attachTo}
      />
    )
  } else if (picked) {
    panel = (
      <PickedPanel
        picked={picked}
        savedPlaces={allPlaces}
        onChange={setPicked}
        onClose={() => setPicked(null)}
        onCreate={() => newAt(picked)}
        onAttach={() => setAttaching(true)}
      />
    )
  } else if (selected) {
    panel = (
      <PlaceDetail
        key={selected.key}
        place={selected}
        type={type}
        categoryMap={categoryMap}
        accountMap={accountMap}
        money={money}
        onClose={() => setSelectedKey(null)}
        onSave={(patch) => updatePlace(selected, patch)}
        onDraftRadius={setDraftRadius}
        onCreate={() => newAt(placeLoc(selected))}
        onAttach={() => setAttaching(true)}
        onEdit={(t) => setForm({ open: true, editing: t, defaults: null })}
      />
    )
  } else {
    panel = null
  }

  let mapArea
  if (tokenState.status === 'loading') {
    mapArea = <MapMessage icon={Loader2} spin title="Memuat peta…" />
  } else if (tokenState.status === 'error') {
    mapArea = <MapMessage title="Gagal memuat pengaturan peta" description="Cek koneksi ke server lalu muat ulang halaman." />
  } else if (!tokenState.token) {
    mapArea = <MapMessage title="Token Mapbox belum diatur" description="Isi MAPBOX_TOKEN di server/.env lalu jalankan ulang server." />
  } else if (mapError) {
    mapArea = (
      <MapMessage
        title={mapError === 'token' ? 'Token Mapbox ditolak' : 'Peta tidak bisa ditampilkan'}
        description={mapError === 'token' ? 'Cek MAPBOX_TOKEN di server/.env dan batasan URL token di akun Mapbox.' : 'Browser ini tidak mendukung WebGL.'}
      />
    )
  } else {
    mapArea = (
      <MapCanvas
        token={tokenState.token}
        theme={theme}
        places={places}
        located={txPoints}
        radiusAt={picked
          ? { ...picked, radius: picked.placeRadius || DEFAULT_PLACE_RADIUS_M }
          : selected && { ...selected, radius: draftRadius || selected.radius }}
        mode={mode}
        heatWeight={heatWeight}
        hidden={hidden}
        selectedKey={selectedKey}
        picked={picked}
        fitKey={fitKey}
        focus={focus}
        keepVisible={picked || selected}
        onSelectPlace={(key) => selectPlace(key)}
        onPick={pickPoint}
        onError={setMapError}
        onHover={setHover}
        insets={insets}
        className="h-full w-full"
      />
    )
  }

  const filterCount = [period === 'all', type !== 'expense', !!categoryId, !!accountId].filter(Boolean).length
  const summaryLabel = `Total ${type === 'expense' ? 'pengeluaran' : 'pemasukan'} berlokasi, ${periodLabel}`
  const filterButton = (
    <Button
      size="sm"
      variant="secondary"
      className="relative shrink-0"
      onClick={() => setFilterOpen((o) => !o)}
      aria-expanded={filterOpen}
      aria-controls="map-filters"
    >
      <SlidersHorizontal size={15} aria-hidden="true" /> Filter
      {filterCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 rounded-full bg-accent text-accent-fg text-xs font-bold flex items-center justify-center">
          {filterCount}
        </span>
      )}
    </Button>
  )

  // Ringkasan: total berlokasi + cakupan data, supaya peta tidak terlihat lengkap padahal belum.
  const emptyNote = places.length === 0 && (
    <p className="text-[13px] text-muted mt-2">
      Belum ada transaksi berlokasi di filter ini. Tambah lokasi lewat form transaksi, atau ketuk peta untuk memilih titik.
    </p>
  )
  const summary = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] text-muted pt-1 min-w-0">{summaryLabel}</p>
        <div className="-mr-2 -mt-1 shrink-0"><BalanceToggle /></div>
      </div>
      <p className="text-2xl font-bold text-fg tnum leading-tight">{money(total)}</p>
      <p className="text-[13px] text-muted tnum mt-1">
        <span className="text-fg font-medium">{located.length}</span> dari {matching.length} transaksi punya lokasi
      </p>
      {emptyNote}
    </>
  )

  const filters = (
    <div id="map-filters" className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Segmented options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        {mobile && period === 'month' && <MonthPicker cursor={cursor} onChange={setCursor} />}
      </div>
      <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-wrap lg:items-center">
        <Segmented
          className="col-span-2 flex [&>button]:flex-1 lg:inline-flex lg:[&>button]:flex-none"
          options={TYPE_OPTIONS}
          value={type}
          onChange={(v) => { setType(v); setCategoryId(''); setAccountId('') }}
        />
        <Select aria-label="Kategori" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="lg:w-44">
          <option value="">Semua kategori</option>
          {catOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select aria-label="Rekening" value={accountId} onChange={(e) => setAccountId(e.target.value)} className="lg:w-44">
          <option value="">Semua rekening</option>
          {accOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
      </div>
      {mode === 'heat' && (
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-muted">Panas berdasarkan</span>
          <Segmented options={WEIGHT_OPTIONS} value={heatWeight} onChange={setHeatWeight} />
        </div>
      )}
    </div>
  )

  // HP: rincian layar penuh. Fokus pindah ke dialog saat dibuka (sekali, bukan tiap render, supaya modal form tidak
  // kehilangan fokus); body halaman dikunci, yang bergulir hanya isi dialog.
  const sheetOpen = mobile && !!panel
  const sheetDialogRef = useRef(null)
  useEffect(() => {
    if (!sheetOpen) return undefined
    sheetDialogRef.current?.focus()
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [sheetOpen])

  return (
    // Peta memenuhi area konten (dari sidebar sampai tepi kanan, setinggi layar); semua kontrol berupa panel mengambang.
    <div
      ref={shellRef}
      onKeyDown={(e) => { if (e.key === 'Escape' && filterOpen) setFilterOpen(false) }}
      className={cx(
        'relative h-full w-full overflow-hidden bg-surface-2',
        // HP: kontrol (kiri bawah) & logo + atribusi (kanan bawah) diangkat ke atas panel bawah.
        '[&_.mapboxgl-ctrl-bottom-right]:bottom-[var(--inset-bottom)] [&_.mapboxgl-ctrl-bottom-left]:bottom-[var(--inset-bottom)]'
      )}
      style={{ '--inset-bottom': `${insets.bottom}px` }}
    >
      <div className="absolute inset-0">{mapArea}</div>
      {hover && (
        <MapTooltip
          hover={hover}
          txPoints={txPoints}
          places={places}
          categoryMap={categoryMap}
          accountMap={accountMap}
          money={money}
          bounds={{ width: shellRef.current?.clientWidth || 0, right: insets.right }}
        />
      )}

      {/* Desktop: panel atas satu baris (judul, bulan, Filter, mode). Filter lain dilipat di balik tombol Filter. */}
      {!mobile && (
        <div ref={topRef} className={cx(FLOAT, 'absolute z-10 left-4 top-4 max-w-[calc(100%-22rem-3rem)] p-3 px-4')}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
            <h1 className="text-lg font-bold text-fg leading-tight min-w-0 truncate">Peta Transaksi</h1>
            {period === 'month'
              ? <MonthPicker cursor={cursor} onChange={setCursor} />
              : <p className="text-sm font-semibold text-fg px-2">Semua waktu</p>}
            {filterButton}
            <Segmented options={MODE_OPTIONS} value={mode} onChange={setMode} />
          </div>
          {filterOpen && <div className="mt-3 pt-3 border-t border-border">{filters}</div>}
        </div>
      )}

      {/* Desktop: kolom kanan = ringkasan ringkas, lalu panel rincian hanya saat tempat/titik dipilih. */}
      {!mobile && (
        // Berhenti 3rem di atas tepi bawah: pojok kanan bawah dipakai logo & atribusi Mapbox (wajib terlihat).
        <div ref={sideRef} className="absolute z-10 right-4 top-4 bottom-12 w-[22rem] flex flex-col gap-3 pointer-events-none">
          <section aria-label="Ringkasan peta" className={cx(FLOAT, 'shrink-0 px-5 py-4 pointer-events-auto')}>
            {summary}
          </section>
          {panel && (
            <aside
              aria-label="Rincian"
              ref={(el) => { bodyRefs.current[0] = el }}
              className={cx(FLOAT, 'min-h-0 overflow-y-auto px-5 pb-5 pointer-events-auto')}
            >
              {panel}
            </aside>
          )}
        </div>
      )}

      {/* HP: satu panel menempel di tepi bawah, menerus ke belakang bottom nav: ringkasan, Filter, mode.
          Padding bawah = tinggi bottom nav + tonjolan tombol tambah, supaya isinya tidak tertutup. */}
      {mobile && (
        <section
          ref={sheetRef}
          aria-label="Ringkasan peta"
          className="absolute z-10 inset-x-0 bottom-0 bg-bg border-t border-border rounded-t-xl px-4 pt-3 pb-[calc(5.25rem+env(safe-area-inset-bottom))]"
        >
          <h1 className="sr-only">Peta Transaksi</h1>
          {filterOpen && <div className="max-h-[45dvh] overflow-y-auto pb-3 mb-3 border-b border-border">{filters}</div>}
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-muted truncate">{summaryLabel}</p>
              <p className="text-fg tnum leading-tight truncate">
                <span className="text-xl font-bold">{money(total)}</span>
                <span className="text-[13px] text-muted"> · {located.length}/{matching.length} berlokasi</span>
              </p>
            </div>
            <BalanceToggle />
            {filterButton}
          </div>
          <Segmented options={MODE_OPTIONS} value={mode} onChange={setMode} fill className="w-full mt-3" />
          {emptyNote}
        </section>
      )}

      {/* HP: rincian tempat/titik layar penuh (di atas bottom nav, di bawah modal form) dengan peta mini lokasinya. */}
      {mobile && panel && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Rincian lokasi"
          tabIndex={-1}
          ref={sheetDialogRef}
          onKeyDown={(e) => { if (e.key === 'Escape') closePanel() }}
          className="fixed inset-0 z-[45] h-[100dvh] flex flex-col overflow-hidden bg-bg pt-[env(safe-area-inset-top)] outline-none"
        >
          {panelLoc && tokenState.token && (
            <div className="shrink-0"><MiniMap token={tokenState.token} theme={theme} {...panelLoc} /></div>
          )}
          {/* Padding bawah di pembungkus dalam, bukan di area gulir: bilah "Pasang lokasi" (sticky) menempel tepat di
              tepi bawah layar, tanpa celah yang memperlihatkan baris di belakangnya. */}
          <div ref={(el) => { bodyRefs.current[1] = el }} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4">
            <div className="pb-[calc(1.5rem+env(safe-area-inset-bottom))]">{panel}</div>
          </div>
        </div>
      )}

      <TransactionForm
        open={form.open}
        editing={form.editing}
        defaults={form.defaults}
        onClose={() => setForm((f) => ({ ...f, open: false }))}
        onDelete={() => { const t = form.editing; setForm((f) => ({ ...f, open: false })); askDelete(t) }}
      />
    </div>
  )
}

// Panel mengambang di atas peta. Bayangan = elevasi di atas peta (bukan dekorasi); radius xl membedakan panel dari
// tombol & isian (rounded-md).
const FLOAT = 'rounded-xl bg-bg border border-border shadow-pop'

// Tooltip titik (desktop, hover). Satu transaksi: rinciannya. Tempat/cluster: 3 transaksi terbesar, "+N lainnya", total.
// Melayang di atas titik (di bawahnya kalau titik dekat tepi atas), tidak menangkap kursor.
const TIP_W = 256
function MapTooltip({ hover, txPoints, places, categoryMap, accountMap, money, bounds }) {
  // Ringkasan beberapa transaksi: 3 terbesar, "+N lainnya", total.
  const summaryOf = (title, list) => {
    const txs = [...list].sort((a, b) => b.amount - a.amount)
    const total = txs.reduce((s, t) => s + t.amount, 0)
    return (
      <>
        <p className="text-sm font-semibold text-fg truncate">{title}</p>
        <ul className="mt-2 space-y-1.5">
          {txs.slice(0, 3).map((t) => {
            const cat = categoryMap[t.categoryId]
            return (
              <li key={t.id} className="flex items-center gap-2 text-[13px]">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: cat?.color || '#71717a' }} aria-hidden="true" />
                <span className="flex-1 min-w-0 truncate text-fg">{t.note || cat?.name || 'Transaksi'}</span>
                <span className="tnum text-fg whitespace-nowrap">{money(t.amount)}</span>
              </li>
            )
          })}
        </ul>
        {txs.length > 3 && <p className="text-[13px] text-muted mt-1.5">+{txs.length - 3} lainnya</p>}
        <div className="flex items-baseline justify-between gap-3 mt-2 pt-2 border-t border-border">
          <span className="text-[13px] text-muted">Total {txs.length} transaksi</span>
          <span className="text-sm font-bold text-fg tnum whitespace-nowrap">{money(total)}</span>
        </div>
      </>
    )
  }

  let body
  if (hover.kind === 'tx') {
    const t = txPoints.find((x) => x.id === hover.id)
    if (!t) return null
    // Transaksi di koordinat yang persis sama bertumpuk jadi satu titik: tampilkan semuanya, bukan hanya yang paling atas.
    const same = txPoints.filter((x) => x.lat === t.lat && x.lng === t.lng)
    if (same.length > 1) {
      body = summaryOf(places.find((p) => p.key === t.placeKey)?.name || t.placeName || 'Titik tanpa nama', same)
    } else {
      const cat = categoryMap[t.categoryId]
      body = (
        <>
          <div className="flex items-center gap-2.5">
            <CategoryIcon name={cat?.icon} color={cat?.color} size={13} />
            <p className="flex-1 min-w-0 text-sm font-medium text-fg truncate">{t.note || cat?.name || 'Transaksi'}</p>
          </div>
          <p className="text-lg font-bold text-fg tnum mt-2 leading-tight">{money(t.amount)}</p>
          <p className="text-[13px] text-muted mt-0.5 truncate">
            {formatDate(t.date, { short: true })} · {cat?.name || 'Tanpa kategori'}{accountMap[t.accountId] ? ` · ${accountMap[t.accountId].name}` : ''}
          </p>
          {t.placeName && (
            <p className="text-[13px] text-muted mt-1 flex items-center gap-1.5 truncate">
              <MapPinned size={12} className="shrink-0" aria-hidden="true" /> {t.placeName}
            </p>
          )}
        </>
      )
    }
  } else {
    const group = places.filter((p) => hover.keys.includes(p.key))
    const txs = group.flatMap((p) => p.txs)
    if (!txs.length) return null
    body = summaryOf(group.length === 1 ? group[0].name || 'Titik tanpa nama' : `${group.length} tempat`, txs)
  }

  // Jaga tooltip tetap di area peta yang terlihat (tidak masuk ke bawah panel kanan).
  const maxX = Math.max(TIP_W / 2 + 8, bounds.width - bounds.right - TIP_W / 2 - 8)
  const x = Math.min(Math.max(hover.at.x, TIP_W / 2 + 8), maxX)
  const below = hover.at.y < 220
  return (
    <div
      role="tooltip"
      className="absolute z-20 pointer-events-none rounded-lg bg-bg border border-border shadow-pop p-3"
      style={{
        width: TIP_W,
        left: x,
        top: hover.at.y,
        transform: below ? 'translate(-50%, 18px)' : 'translate(-50%, calc(-100% - 18px))',
      }}
    >
      {body}
    </div>
  )
}

function MapMessage({ icon = MapPinned, spin, title, description }) {
  const Icon = icon
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
      <Icon size={22} className={cx('text-muted mb-3', spin && 'animate-spin')} aria-hidden="true" />
      <p className="text-sm font-semibold text-fg">{title}</p>
      {description && <p className="text-[13px] text-muted mt-1 max-w-xs">{description}</p>}
    </div>
  )
}

function PanelHeader({ title, onBack, backLabel, onClose, action, children }) {
  return (
    <div className="pt-4 mb-3">
      <div className="flex items-start gap-1">
        {onBack && (
          <Button size="icon" variant="ghost" onClick={onBack} aria-label={backLabel} className="-ml-2.5 shrink-0">
            <ChevronLeft size={18} aria-hidden="true" />
          </Button>
        )}
        <div className="min-w-0 flex-1 pt-1.5">
          <h2 className="text-[17px] font-semibold text-fg leading-snug">{title}</h2>
          {children}
        </div>
        {action}
        {onClose && (
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Tutup" className="-mr-2 shrink-0">
            <X size={16} aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  )
}

function Stat({ label, children }) {
  return (
    <div className="min-w-0">
      <p className="text-[13px] text-muted">{label}</p>
      <p className="text-[15px] font-semibold text-fg tnum mt-0.5 truncate">{children}</p>
    </div>
  )
}

// Dua aksi untuk satu lokasi: transaksi baru, atau pasang ke transaksi lama. Lebar penuh & sama tinggi supaya terbaca
// sebagai pasangan pilihan (primer di atas), bukan dua tombol berbeda ukuran yang membungkus.
function LocationActions({ onCreate, onAttach }) {
  return (
    <div className="grid gap-2">
      <Button onClick={onCreate} className="w-full h-11 touch:h-12">
        <Plus size={16} aria-hidden="true" /> Buat transaksi baru di sini
      </Button>
      <Button variant="secondary" onClick={onAttach} className="w-full h-11 touch:h-12">
        <Link2 size={16} aria-hidden="true" /> Pasang ke transaksi lama
      </Button>
    </div>
  )
}

// Lingkaran di peta = batas titik GPS yang ikut tempat ini (lib/places.js).
function RadiusNote({ radius }) {
  return <p className="text-[13px] text-muted mt-1">Transaksi dari titik GPS dalam lingkaran {radius} m ikut tempat ini.</p>
}

function PlaceDetail({ place, type, categoryMap, accountMap, money, onClose, onSave, onDraftRadius, onCreate, onAttach, onEdit }) {
  const top = categoryMap[topCategoryId(place)]
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(place.name)
  const [radius, setRadius] = useState(place.radius)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  // Pratinjau lingkaran di peta hanya selama mode ubah.
  useEffect(() => { onDraftRadius(editing ? radius : null) }, [editing, radius, onDraftRadius])
  useEffect(() => () => onDraftRadius(null), [onDraftRadius])

  const startEdit = () => { setName(place.name); setRadius(place.radius); setErr(''); setEditing(true) }
  const save = async () => {
    setSaving(true)
    setErr('')
    try { await onSave({ name, radius }); setEditing(false) } catch (e) { setErr(e.message || 'Gagal menyimpan tempat') } finally { setSaving(false) }
  }

  return (
    <section aria-label={`Rincian ${place.name || 'titik'}`}>
      {editing ? (
        <div className="pt-4 mb-3 space-y-3">
          <label className="block">
            <span className="block text-[13px] font-medium text-muted mb-1.5">Nama tempat</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { e.stopPropagation(); setEditing(false) } }}
              placeholder="mis. Warung Bu Ani"
              className={cx(fieldClass, 'w-full h-9 touch:h-11 px-3 text-base sm:text-sm')}
            />
          </label>
          <div role="group" aria-label="Radius tempat">
            <span className="block text-[13px] font-medium text-muted mb-1.5">Radius tempat</span>
            <Segmented fill options={RADIUS_CHOICES} value={radius} onChange={setRadius} />
            <RadiusNote radius={radius} />
          </div>
          <p className="text-[13px] text-muted">Berlaku untuk {place.count > 1 ? 'semua transaksi' : 'transaksi'} di tempat ini.</p>
          {err && <p className="text-[13px] text-negative" role="alert">{err}</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan'}</Button>
            <Button size="sm" variant="secondary" onClick={() => setEditing(false)} disabled={saving}>Batal</Button>
          </div>
        </div>
      ) : (
        <PanelHeader
          title={place.name || 'Titik tanpa nama'}
          onClose={onClose}
          action={(
            <Button size="icon" variant="ghost" onClick={startEdit} aria-label="Ubah tempat" title="Ubah nama & radius tempat" className="shrink-0">
              <Pencil size={15} aria-hidden="true" />
            </Button>
          )}
        >
          <p className="text-[13px] text-muted">{place.address || `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`}</p>
          <RadiusNote radius={place.radius} />
        </PanelHeader>
      )}

      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <Stat label={type === 'expense' ? 'Total keluar' : 'Total masuk'}>{money(place.total)}</Stat>
        <Stat label="Kunjungan">{place.count}x</Stat>
        <Stat label="Rata-rata / kunjungan">{money(place.total / place.count)}</Stat>
        <Stat label="Terakhir">{formatDate(place.lastDate, { short: true })}</Stat>
      </div>

      {top && (
        <div className="flex items-center gap-3 mt-4">
          <CategoryIcon name={top.icon} color={top.color} size={14} />
          <p className="text-[13px] text-muted">Kategori terbanyak: <span className="text-fg font-medium">{top.name}</span></p>
        </div>
      )}

      <div className="mt-5"><LocationActions onCreate={onCreate} onAttach={onAttach} /></div>

      <h3 className="text-[13px] font-semibold text-muted mt-6 mb-1">Transaksi</h3>
      <ul className="divide-y divide-border">
        {place.txs.map((t) => (
          <li key={t.id}>
            <TxButton t={t} categoryMap={categoryMap} accountMap={accountMap} money={money} onClick={() => onEdit(t)} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function TxInfo({ t, categoryMap, accountMap, money }) {
  const cat = categoryMap[t.categoryId]
  return (
    <span className="flex-1 min-w-0 flex items-center gap-3 min-h-14 py-2">
      <CategoryIcon name={cat?.icon} color={cat?.color} size={14} />
      <span className="flex-1 min-w-0">
        <span className="block text-sm text-fg truncate">{t.note || cat?.name || 'Transaksi'}</span>
        <span className="block text-[13px] text-muted truncate">
          {formatDate(t.date, { short: true })} · {cat?.name || 'Tanpa kategori'}{accountMap[t.accountId] ? ` · ${accountMap[t.accountId].name}` : ''}
        </span>
      </span>
      <span className="text-sm font-medium text-fg tnum whitespace-nowrap">{money(t.amount)}</span>
    </span>
  )
}

function TxButton({ t, categoryMap, accountMap, money, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex text-left hover:bg-surface-2/60 active:bg-surface-2 lg:-mx-2 lg:px-2 lg:w-[calc(100%+1rem)] lg:rounded-md"
    >
      <TxInfo t={t} categoryMap={categoryMap} accountMap={accountMap} money={money} />
    </button>
  )
}

// Pilihan radius manual (lib/places.js), dipakai di "Titik dipilih" dan ubah tempat.
const RADIUS_CHOICES = PLACE_RADIUS_OPTIONS.map((m) => ({ value: m, label: `${m} m` }))

function PickedPanel({ picked, savedPlaces, onChange, onClose, onCreate, onAttach }) {
  const radius = picked.placeRadius || DEFAULT_PLACE_RADIUS_M
  return (
    <section aria-label="Titik dipilih">
      <PanelHeader title="Titik dipilih" onClose={onClose}>
        <p className="text-[13px] text-muted tnum">{picked.lat.toFixed(5)}, {picked.lng.toFixed(5)}</p>
        <RadiusNote radius={radius} />
      </PanelHeader>
      <div className="space-y-4">
        <label className="block">
          <span className="block text-[13px] font-medium text-muted mb-1.5">Nama tempat</span>
          <input
            value={picked.placeName}
            onChange={(e) => onChange({ ...picked, placeName: e.target.value })}
            placeholder="mis. Warung Bu Ani"
            className={cx(fieldClass, 'w-full h-9 touch:h-11 px-3 text-base sm:text-sm')}
          />
          {picked.placeAddress && <span className="block text-[13px] text-muted mt-1">{picked.placeAddress}</span>}
        </label>
        <div role="group" aria-label="Radius tempat">
          <span className="block text-[13px] font-medium text-muted mb-1.5">Radius tempat</span>
          <Segmented fill options={RADIUS_CHOICES} value={radius} onChange={(m) => onChange({ ...picked, placeRadius: m })} />
        </div>
        {!picked.placeId && (
          <NearbySuggestions
            point={picked}
            savedPlaces={savedPlaces}
            onSelect={(loc) => onChange({ ...loc, placeRadius: loc.placeRadius || picked.placeRadius })}
          />
        )}
        <div className="pt-1"><LocationActions onCreate={onCreate} onAttach={onAttach} /></div>
      </div>
    </section>
  )
}

// Kata kunci nominal: "25000", "25.000", "Rp25.000" cocok dengan nominal yang memuat angka itu;
// "25rb", "25k", "1,5jt" cocok persis dengan 25.000 / 1.500.000. Bukan angka → null (cari teks saja).
function amountMatcher(q) {
  const m = q.replace(/\s/g, '').toLowerCase().match(/^(?:rp)?(\d[\d.,]*)(rb|ribu|k|jt|juta)?$/)
  if (!m) return null
  const [, num, unit] = m
  if (!unit) {
    const digits = num.replace(/[.,]/g, '')
    return (amount) => String(Math.round(amount)).includes(digits)
  }
  const value = Math.round(parseFloat(num.replace(',', '.')) * (unit === 'jt' || unit === 'juta' ? 1e6 : 1e3))
  return (amount) => Math.round(amount) === value
}

function AttachList({ candidates, categoryMap, accountMap, money, periodAll, backLabel, onBack, onAttach }) {
  const [q, setQ] = useState('')
  const [chosen, setChosen] = useState(() => new Set())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const needle = q.trim().toLowerCase()
  const byAmount = needle ? amountMatcher(needle) : null
  const rows = (needle
    ? candidates.filter((t) => byAmount?.(t.amount)
      || `${t.note || ''} ${categoryMap[t.categoryId]?.name || ''}`.toLowerCase().includes(needle))
    : candidates
  ).slice(0, 50)
  // Pilihan tetap tersimpan saat kata kunci berganti; yang dipasang = semua yang dicentang, terlihat atau tidak.
  const picked = candidates.filter((t) => chosen.has(t.id))
  const pickedTotal = picked.reduce((s, t) => s + t.amount, 0)
  const allRowsChosen = rows.length > 0 && rows.every((t) => chosen.has(t.id))

  const toggle = (id) => setChosen((s) => {
    const next = new Set(s)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
  const toggleRows = () => setChosen((s) => {
    const next = new Set(s)
    for (const t of rows) {
      if (allRowsChosen) next.delete(t.id)
      else next.add(t.id)
    }
    return next
  })
  const attach = async () => {
    setBusy(true)
    setErr('')
    try { await onAttach(picked); setChosen(new Set()) } catch (e) { setErr(e.message || 'Gagal menyimpan lokasi') } finally { setBusy(false) }
  }

  return (
    <section aria-label="Pasang ke transaksi lama">
      <PanelHeader title="Pasang ke transaksi lama" onBack={onBack} backLabel={backLabel}>
        <p className="text-[13px] text-muted">Transaksi tanpa lokasi sesuai filter. Pilih satu atau lebih, lalu pasang lokasi ini.</p>
      </PanelHeader>
      <div className="relative mb-2">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" aria-hidden="true" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari catatan, kategori, nominal"
          aria-label="Cari transaksi berdasarkan catatan, kategori, atau nominal"
          className={cx(fieldClass, 'w-full h-9 touch:h-11 pl-9 pr-3 text-base sm:text-sm')}
        />
      </div>
      {rows.length === 0 ? (
        <p className="text-[13px] text-muted py-3">
          {candidates.length === 0
            ? `Semua transaksi di filter ini sudah punya lokasi.${periodAll ? '' : ' Ganti periode ke Semua untuk melihat transaksi bulan lain.'}`
            : `Tidak ada transaksi tanpa lokasi yang cocok dengan "${q.trim()}". Coba nominal tanpa titik atau kata lain.`}
        </p>
      ) : (
        <>
          <label className="flex items-center gap-3 min-h-11 text-[13px] text-muted cursor-pointer">
            <Checkbox
              checked={allRowsChosen}
              indeterminate={rows.some((t) => chosen.has(t.id))}
              onChange={toggleRows}
            />
            Pilih semua yang tampil ({rows.length})
          </label>
          <ul className="divide-y divide-border border-t border-border">
            {rows.map((t) => (
              <li key={t.id}>
                <label className="flex items-center gap-3 cursor-pointer hover:bg-surface-2/60 lg:-mx-2 lg:px-2 lg:rounded-md">
                  <Checkbox checked={chosen.has(t.id)} onChange={() => toggle(t.id)} />
                  <TxInfo t={t} categoryMap={categoryMap} accountMap={accountMap} money={money} />
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
      {candidates.length > rows.length && !needle && (
        <p className="text-[13px] text-muted pt-2">Menampilkan 50 terbaru. Cari untuk menemukan yang lain.</p>
      )}
      {/* Aksi menempel di bawah daftar yang digulir, supaya jumlah terpilih selalu terlihat. */}
      {picked.length > 0 && (
        <div className="sticky bottom-0 -mx-4 lg:-mx-5 mt-3 px-4 lg:px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-bg border-t border-border">
          {err && <p className="text-[13px] text-negative mb-2" role="alert">{err}</p>}
          <div className="flex items-center gap-2">
            <p className="flex-1 min-w-0 text-[13px] text-muted tnum truncate">
              <span className="text-fg font-medium">{picked.length}</span> dipilih · {money(pickedTotal)}
            </p>
            <Button size="sm" variant="ghost" onClick={() => setChosen(new Set())} disabled={busy}>Batal</Button>
            <Button size="sm" onClick={attach} disabled={busy}>
              <Link2 size={15} aria-hidden="true" /> {busy ? 'Memasang…' : 'Pasang lokasi'}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

// Peta mini statis (Mapbox Static Images) untuk rincian layar penuh di HP: pin + lingkaran radius tempat.
// Gaya peta sama dengan peta utama (light/dark ikut tema); "auto" membingkai lingkaran, jadi ganti radius = zoom ikut berubah
// (keputusan owner).
function MiniMap({ token, theme, lat, lng, radius, color }) {
  const [failed, setFailed] = useState(false)
  const hex = /^#[0-9a-f]{6}$/i.test(color || '') ? color.slice(1).toLowerCase() : '71717a'
  const dLat = radius / 111320
  const dLng = radius / (111320 * Math.cos((lat * Math.PI) / 180))
  const ring = Array.from({ length: 33 }, (_, i) => {
    const a = (i / 32) * 2 * Math.PI
    return [+(lng + dLng * Math.cos(a)).toFixed(6), +(lat + dLat * Math.sin(a)).toFixed(6)]
  })
  const circle = {
    type: 'Feature',
    properties: { stroke: `#${hex}`, 'stroke-width': 2, fill: `#${hex}`, 'fill-opacity': 0.15 },
    geometry: { type: 'Polygon', coordinates: [ring] },
  }
  const style = theme === 'dark' ? 'dark-v11' : 'light-v11'
  const overlay = `geojson(${encodeURIComponent(JSON.stringify(circle))}),pin-l+${hex}(${lng},${lat})`
  const src = `https://api.mapbox.com/styles/v1/mapbox/${style}/static/${overlay}/auto/640x280@2x?padding=48&access_token=${token}`
  if (failed) return null
  return (
    <img
      src={src}
      alt={`Peta mini lokasi, lingkaran radius ${radius} m`}
      onError={() => setFailed(true)}
      className="block w-full aspect-[640/280] bg-surface-2 border-b border-border"
    />
  )
}
