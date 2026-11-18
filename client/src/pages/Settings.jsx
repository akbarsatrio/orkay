import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Plus, Pencil, Trash2, RefreshCw, CalendarDays, CalendarClock, Tags, Coins, AlertTriangle, Bomb, Check, ChevronRight,
  MonitorSmartphone, SunMoon, Tag,
} from 'lucide-react'
import { Card, CardHeader, Button, Input, Badge, Empty, Modal, Toggle, cx } from '../components/ui/index.jsx'
import CategoryIcon from '../components/CategoryIcon.jsx'
import CategoryForm from '../components/settings/CategoryForm.jsx'
import SwipeRow, { editDeleteActions, useIsMobile } from '../components/ui/SwipeRow.jsx'
import { useData } from '../context/DataContext.jsx'
import { useUiVersion } from '../context/UiVersionContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { useConfirm } from '../context/ConfirmContext.jsx'
import { fetchHolidays } from '../lib/holidays.js'
import { getPaydayDate } from '../lib/payday.js'
import { formatDate, monthNamesID } from '../lib/format.js'
import { SETTINGS_SECTIONS, DEFAULT_SETTINGS_SECTION } from '../lib/settingsSections.js'

const UI_OPTIONS = [
  { value: 'new', label: 'Tampilan baru' },
  { value: 'legacy', label: 'Tampilan lama' },
]
const THEME_OPTIONS = [
  { value: 'system', label: 'Ikut sistem' },
  { value: 'light', label: 'Terang' },
  { value: 'dark', label: 'Gelap' },
]
const labelOf = (options, value) => options.find((o) => o.value === value)?.label

/**
 * Pengaturan bergaya menu pengaturan HP (keputusan owner):
 * - HP & tablet: /settings = daftar menu berkelompok (ikon, nama, nilai sekarang, ›); tiap menu membuka sub-layar
 *   /settings/:section dengan tombol kembali di Topbar.
 * - Desktop: menu di kiri, isi bagian terpilih di kanan (default: Versi tampilan).
 * Destroy Data tetap membuka dialog konfirmasi, bukan sub-layar.
 */
export default function Settings() {
  const {
    categories, incomeSources, settings,
    deleteCategory, addIncomeSource, deleteIncomeSource,
    updateSettings, destroyData,
  } = useData()
  const { ui, setUi } = useUiVersion()
  const { pref: themePref, setPref: setThemePref } = useTheme()
  const { section } = useParams()
  const navigate = useNavigate()
  const mobile = useIsMobile()

  const [catForm, setCatForm] = useState({ open: false, editing: null })
  const [newSource, setNewSource] = useState('')
  const [holidays, setHolidays] = useState([])
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear())
  const [loadingHol, setLoadingHol] = useState(false)
  const [destroyOpen, setDestroyOpen] = useState(false)
  const [destroyConfirm, setDestroyConfirm] = useState('')
  const confirm = useConfirm()

  // Alamat bagian yang tidak dikenal kembali ke menu.
  useEffect(() => {
    if (section && !SETTINGS_SECTIONS[section]) navigate('/settings', { replace: true })
  }, [section, navigate])

  const askDeleteCategory = (c) => confirm({
    title: 'Hapus kategori',
    message: <>Hapus kategori <b>{c.name}</b>?</>,
    detail: 'Transaksi dengan kategori ini tidak ikut terhapus, tapi jadi tanpa kategori.',
    onConfirm: () => deleteCategory(c.id),
  })

  const askDeleteSource = (s) => confirm({
    title: 'Hapus sumber pemasukan',
    message: <>Hapus sumber pemasukan <b>{s.name}</b>?</>,
    detail: 'Transaksi pemasukan dari sumber ini tidak ikut terhapus.',
    onConfirm: () => deleteIncomeSource(s.id),
  })

  const incomeCats = categories.filter((c) => c.type === 'income')
  const expenseCats = categories.filter((c) => c.type === 'expense')

  useEffect(() => {
    let alive = true
    setLoadingHol(true)
    fetchHolidays(holidayYear).then((list) => {
      if (alive) { setHolidays(list); setLoadingHol(false) }
    })
    return () => { alive = false }
  }, [holidayYear])

  const holidaySet = new Set(holidays.map((h) => h.date))
  const now = new Date()
  const nextPay = getPaydayDate(now.getFullYear(), now.getMonth(), settings.payDay, holidaySet, settings.payDayShift)

  const handleAddSource = () => {
    if (!newSource.trim()) return
    addIncomeSource({ name: newSource.trim(), color: '#0ea5e9' })
    setNewSource('')
  }

  const openDestroy = () => { setDestroyConfirm(''); setDestroyOpen(true) }

  const groups = [
    {
      title: 'Tampilan',
      items: [
        { key: 'tampilan', icon: MonitorSmartphone, label: 'Versi tampilan', value: labelOf(UI_OPTIONS, ui) },
        { key: 'tema', icon: SunMoon, label: 'Tema', value: labelOf(THEME_OPTIONS, themePref) },
      ],
    },
    {
      title: 'Keuangan',
      items: [
        { key: 'gajian', icon: CalendarClock, label: 'Tanggal gajian', value: `Tgl ${settings.payDay}` },
        { key: 'kategori', icon: Tags, label: 'Kategori', value: String(categories.length) },
        { key: 'sumber', icon: Coins, label: 'Sumber pemasukan', value: String(incomeSources.length) },
        { key: 'libur', icon: CalendarDays, label: 'Hari libur nasional', value: String(holidayYear) },
      ],
    },
  ]

  const content = {
    // Tampilan lama hanya punya rute /settings: pindah ke sana dulu supaya tidak mendarat di halaman kosong.
    tampilan: (
      <RadioList
        label="Versi tampilan"
        options={UI_OPTIONS}
        value={ui}
        onChange={(v) => { if (v === 'legacy') navigate('/settings', { replace: true }); setUi(v) }}
      />
    ),
    tema: <RadioList label="Tema" options={THEME_OPTIONS} value={themePref} onChange={setThemePref} />,
    gajian: (
      <div className="divide-y divide-border">
        <div className="pb-5 space-y-4">
          <div className="w-40">
            <Input
              type="number"
              min={1}
              max={31}
              label="Tanggal gajian tiap bulan"
              value={settings.payDay}
              onChange={(e) => updateSettings({ payDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })}
            />
          </div>
          <div>
            <p className="text-[13px] text-muted">Gajian bulan {monthNamesID[now.getMonth()]} jatuh pada</p>
            <p className="text-[15px] font-semibold text-fg flex flex-wrap items-center gap-2 mt-1">
              <CalendarDays size={16} className="text-muted" aria-hidden="true" />
              {formatDate(nextPay.effective, { withDay: true })}
              {nextPay.shifted && (
                <Badge className="text-warning border-warning/30 bg-warning/10">
                  dimajukan ({nextPay.reason})
                </Badge>
              )}
            </p>
          </div>
        </div>
        <label className="flex items-start justify-between gap-4 pt-5 cursor-pointer">
          <span>
            <span className="block text-[15px] font-medium text-fg">Majukan kalau jatuh di weekend/libur</span>
            <span className="block text-[13px] text-muted mt-0.5">
              Gajian dianggap cair di hari kerja terdekat sebelumnya. Matikan kalau gajian kamu tetap cair di tanggalnya.
            </span>
          </span>
          <Toggle checked={settings.payDayShift} onChange={(v) => updateSettings({ payDayShift: v })} />
        </label>
      </div>
    ),
    kategori: (
      <div className="space-y-6">
        <AddRow label="Tambah kategori" onClick={() => setCatForm({ open: true, editing: null })} />
        <div>
          <p className="text-[13px] font-semibold text-muted mb-1 flex items-center gap-1.5">
            <Tag size={12} aria-hidden="true" /> Pengeluaran
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            {expenseCats.map((c) => (
              <CategoryRow key={c.id} cat={c} onEdit={() => setCatForm({ open: true, editing: c })} onDelete={() => askDeleteCategory(c)} />
            ))}
          </div>
        </div>
        <div>
          <p className="text-[13px] font-semibold text-muted mb-1 flex items-center gap-1.5">
            <Coins size={12} aria-hidden="true" /> Pemasukan
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            {incomeCats.map((c) => (
              <CategoryRow key={c.id} cat={c} onEdit={() => setCatForm({ open: true, editing: c })} onDelete={() => askDeleteCategory(c)} />
            ))}
          </div>
        </div>
      </div>
    ),
    sumber: (
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              value={newSource}
              onChange={(e) => setNewSource(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
              placeholder="Nama sumber pemasukan"
              aria-label="Nama sumber pemasukan"
            />
          </div>
          <Button onClick={handleAddSource}><Plus size={16} /> Tambah</Button>
        </div>
        {incomeSources.length === 0 ? (
          <p className="text-[13px] text-muted">Belum ada sumber pemasukan.</p>
        ) : (
          <div className="divide-y divide-border">
            {incomeSources.map((s) => (
              <SwipeRow
                key={s.id}
                actions={[{ label: 'Hapus', ariaLabel: `Hapus ${s.name}`, icon: Trash2, onSelect: () => askDeleteSource(s), danger: true }]}
              >
                <div className="group flex items-center gap-3 min-h-12 text-[15px] text-fg">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} aria-hidden="true" />
                  <span className="flex-1 min-w-0 truncate">{s.name}</span>
                  <button
                    onClick={() => askDeleteSource(s)}
                    aria-label={`Hapus ${s.name}`}
                    title="Hapus"
                    className="hidden lg:flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-negative hover:bg-negative/10 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </SwipeRow>
            ))}
          </div>
        )}
      </div>
    ),
    libur: (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <label htmlFor="holiday-year" className="text-[13px] font-medium text-muted mr-1">Tahun</label>
          <select
            id="holiday-year"
            value={holidayYear}
            onChange={(e) => setHolidayYear(Number(e.target.value))}
            className="h-9 touch:h-11 px-3 rounded-md bg-surface-2 border border-border hover:border-muted/50 focus:bg-bg text-base sm:text-sm text-fg outline-none focus:border-fg transition-colors"
          >
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <Button size="icon" variant="secondary" onClick={() => setHolidayYear((y) => y)} title="Muat ulang" aria-label="Muat ulang">
            <RefreshCw size={14} className={loadingHol ? 'animate-spin' : ''} aria-hidden="true" />
          </Button>
        </div>
        {loadingHol ? (
          <p className="text-[13px] text-muted py-4">Memuat data libur…</p>
        ) : holidays.length === 0 ? (
          <Empty icon={CalendarDays} title="Gagal memuat" description="Cek koneksi internet lalu muat ulang." />
        ) : (
          <div className="divide-y divide-border">
            {holidays.map((h) => (
              <div key={h.date} className="flex items-center gap-3 min-h-11 text-[15px]">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${h.type === 'holiday' ? 'bg-negative' : 'bg-warning'}`} aria-hidden="true" />
                <span className="text-muted text-[13px] tnum w-14 shrink-0">{formatDate(h.date, { short: true }).replace(` ${holidayYear}`, '')}</span>
                <span className="text-fg truncate flex-1 min-w-0">{h.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    ),
  }

  const activeKey = SETTINGS_SECTIONS[section] ? section : null
  const menu = (
    <SettingsMenu
      groups={groups}
      activeKey={mobile ? null : activeKey || DEFAULT_SETTINGS_SECTION}
      showChevron={mobile}
      onDestroy={openDestroy}
    />
  )

  let page
  if (mobile) {
    // HP & tablet: menu atau satu sub-layar penuh.
    page = activeKey ? <div className="border-t border-rule pt-5">{content[activeKey]}</div> : menu
  } else {
    // Desktop: menu kiri, isi kanan.
    const key = activeKey || DEFAULT_SETTINGS_SECTION
    page = (
      <div className="grid grid-cols-[17rem_minmax(0,1fr)] gap-x-10 items-start">
        {menu}
        <Card aria-labelledby="settings-section-title">
          <CardHeader title={<span id="settings-section-title">{SETTINGS_SECTIONS[key].title}</span>} subtitle={SETTINGS_SECTIONS[key].subtitle} />
          <div className="pt-5">{content[key]}</div>
        </Card>
      </div>
    )
  }

  return (
    <div>
      {page}

      <Modal
        open={destroyOpen}
        onClose={() => setDestroyOpen(false)}
        title="Destroy Data"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDestroyOpen(false)}>Batal</Button>
            <Button
              variant="danger"
              disabled={destroyConfirm.trim().toUpperCase() !== 'HAPUS'}
              onClick={() => { destroyData(); setDestroyOpen(false) }}
            >
              <Bomb size={16} /> Hapus Sekarang
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-negative shrink-0 mt-0.5" />
            <p className="text-xs text-fg leading-relaxed">
              Tindakan ini <b>tidak bisa dibatalkan</b>. Pastikan kamu benar-benar ingin mengosongkan data.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[13px] font-medium text-negative mb-2">Akan dihapus</p>
              <ul className="space-y-1 text-xs text-muted">
                <li>• Semua transaksi</li>
                <li>• Semua anggaran</li>
                <li>• Saldo awal rekening → 0</li>
                <li>• Riwayat bayar tagihan rutin</li>
              </ul>
            </div>
            <div>
              <p className="text-[13px] font-medium text-positive mb-2">Tetap aman</p>
              <ul className="space-y-1 text-xs text-muted">
                <li>• Kategori</li>
                <li>• Sumber pemasukan</li>
                <li>• Daftar rekening</li>
                <li>• Pengaturan & payday</li>
              </ul>
            </div>
          </div>

          <div>
            <p className="text-xs text-muted mb-1.5">
              Ketik <b className="text-fg">HAPUS</b> untuk mengonfirmasi.
            </p>
            <Input
              value={destroyConfirm}
              onChange={(e) => setDestroyConfirm(e.target.value)}
              placeholder="HAPUS"
              autoFocus
            />
          </div>
        </div>
      </Modal>

      <CategoryForm
        open={catForm.open}
        editing={catForm.editing}
        onClose={() => setCatForm({ open: false, editing: null })}
        onDelete={() => { const c = catForm.editing; setCatForm({ open: false, editing: null }); askDeleteCategory(c) }}
      />
    </div>
  )
}

function MenuIcon({ icon: Icon, danger }) {
  return (
    <span
      className={cx(
        'inline-flex items-center justify-center rounded-lg shrink-0 h-[34px] w-[34px]',
        danger ? 'bg-negative/10 text-negative' : 'bg-surface-2 text-fg'
      )}
    >
      <Icon size={17} aria-hidden="true" />
    </span>
  )
}

// Daftar menu berkelompok. HP & tablet: baris penuh dengan nilai + chevron. Desktop: navigasi kiri dengan sorot
// bagian aktif (tanpa garis antarbaris supaya sorotan tidak terpotong).
function SettingsMenu({ groups, activeKey, showChevron, onDestroy }) {
  const rowBase = 'flex items-center gap-4 min-h-[60px] lg:min-h-12 lg:-mx-3 lg:px-3 lg:rounded-md text-left transition-colors'
  return (
    <nav aria-label="Menu pengaturan" className="space-y-6">
      {groups.map((g) => (
        <section key={g.title} className="border-t border-rule pt-4">
          <h2 className="text-[13px] font-semibold text-muted mb-1">{g.title}</h2>
          <div className="divide-y divide-border lg:divide-y-0 lg:space-y-0.5">
            {g.items.map((it) => {
              const active = it.key === activeKey
              return (
                <Link
                  key={it.key}
                  to={`/settings/${it.key}`}
                  aria-current={active ? 'page' : undefined}
                  className={cx(rowBase, active ? 'lg:bg-surface-2' : 'active:bg-surface-2/60 lg:hover:bg-surface-2/60')}
                >
                  <MenuIcon icon={it.icon} />
                  <span className={cx('flex-1 min-w-0 truncate text-[15px] text-fg', active && 'font-semibold')}>{it.label}</span>
                  <span className="text-sm text-muted tnum whitespace-nowrap">{it.value}</span>
                  {showChevron && <ChevronRight size={18} className="text-muted shrink-0 -mr-1" aria-hidden="true" />}
                </Link>
              )
            })}
          </div>
        </section>
      ))}

      <section className="border-t border-rule pt-4">
        <h2 className="text-[13px] font-semibold text-muted mb-1">Zona Berbahaya</h2>
        <button type="button" onClick={onDestroy} className={cx(rowBase, 'w-full active:bg-surface-2/60 lg:hover:bg-negative/10')}>
          <MenuIcon icon={Bomb} danger />
          <span className="flex-1 min-w-0 text-[15px] font-medium text-negative">Destroy Data</span>
        </button>
        <p className="text-[13px] text-muted mt-1">
          Hapus semua transaksi & anggaran, saldo rekening jadi 0. Kategori, sumber pemasukan, rekening & pengaturan tetap aman.
        </p>
      </section>
    </nav>
  )
}

// Pilihan tunggal bergaya pengaturan HP: baris berlabel dengan tanda centang pada pilihan aktif.
function RadioList({ label, options, value, onChange }) {
  return (
    <div role="radiogroup" aria-label={label} className="divide-y divide-border">
      {options.map((o) => {
        const checked = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(o.value)}
            className="w-full flex items-center justify-between gap-4 min-h-[56px] lg:min-h-12 text-left active:bg-surface-2/60"
          >
            <span className={cx('text-[15px] text-fg', checked && 'font-semibold')}>{o.label}</span>
            {checked && <Check size={18} className="text-fg shrink-0" aria-hidden="true" />}
          </button>
        )
      })}
    </div>
  )
}

function AddRow({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 min-h-[56px] lg:min-h-12 text-left border-b border-border active:bg-surface-2/60 lg:hover:bg-surface-2/60 lg:-mx-3 lg:px-3 lg:w-[calc(100%+1.5rem)] lg:rounded-md lg:border-b-0"
    >
      <span className="inline-flex items-center justify-center rounded-lg shrink-0 h-[34px] w-[34px] bg-fg text-bg">
        <Plus size={17} aria-hidden="true" />
      </span>
      <span className="text-[15px] font-medium text-fg">{label}</span>
    </button>
  )
}

// HP & tablet: ketuk = Ubah, geser = Ubah/Hapus. Desktop: tombol muncul saat kursor di atas baris.
function CategoryRow({ cat, onEdit, onDelete }) {
  return (
    <SwipeRow
      onTap={onEdit}
      actions={editDeleteActions(`kategori ${cat.name}`, onEdit, onDelete)}
      className="border-t border-border first:border-t-0 sm:[&:nth-child(2)]:border-t-0"
    >
      <div className="group flex items-center gap-3 min-h-12 lg:hover:bg-surface-2/50 transition-colors">
        <CategoryIcon name={cat.icon} color={cat.color} size={16} />
        <span className="text-[15px] text-fg flex-1 min-w-0 truncate">{cat.name}</span>
        <button onClick={onEdit} aria-label={`Ubah kategori ${cat.name}`} className="hidden lg:flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-fg hover:bg-border/50 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">
          <Pencil size={14} aria-hidden="true" />
        </button>
        <button onClick={onDelete} aria-label={`Hapus kategori ${cat.name}`} className="hidden lg:flex h-8 w-8 items-center justify-center rounded-md text-muted hover:text-negative hover:bg-negative/10 lg:opacity-0 lg:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity">
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
    </SwipeRow>
  )
}
