import { useEffect, useState } from 'react'
import {
  Plus, Pencil, Trash2, RefreshCw, CalendarDays, Tag, Coins, AlertTriangle, Check, Bomb,
} from 'lucide-react'
import { Card, CardHeader, CardBody, Button, Input, Badge, Empty, Modal } from '../components/ui/index.jsx'
import CategoryIcon from '../components/CategoryIcon.jsx'
import CategoryForm from '../components/settings/CategoryForm.jsx'
import { useData } from '../context/DataContext.jsx'
import { fetchHolidays } from '../lib/holidays.js'
import { getPaydayDate } from '../lib/payday.js'
import { formatDate, monthNamesID } from '../lib/format.js'

export default function Settings() {
  const {
    categories, incomeSources, settings,
    deleteCategory, addIncomeSource, updateIncomeSource, deleteIncomeSource,
    updateSettings, destroyData,
  } = useData()

  const [catForm, setCatForm] = useState({ open: false, editing: null })
  const [newSource, setNewSource] = useState('')
  const [holidays, setHolidays] = useState([])
  const [holidayYear, setHolidayYear] = useState(new Date().getFullYear())
  const [loadingHol, setLoadingHol] = useState(false)
  const [destroyOpen, setDestroyOpen] = useState(false)
  const [destroyConfirm, setDestroyConfirm] = useState('')

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
  const nextPay = getPaydayDate(now.getFullYear(), now.getMonth(), settings.payDay, holidaySet)

  const handleAddSource = () => {
    if (!newSource.trim()) return
    addIncomeSource({ name: newSource.trim(), color: '#0ea5e9' })
    setNewSource('')
  }

  return (
    <div className="space-y-6">
      {/* Payday config */}
      <Card>
        <CardHeader
          title="Tanggal Gajian"
          subtitle="Kalau jatuh di weekend/libur, gajian dianggap maju ke hari kerja terdekat sebelumnya."
        />
        <CardBody className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
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
            <div className="flex-1 rounded-lg bg-surface-2 border border-border px-4 py-3">
              <p className="text-2xs text-muted mb-0.5">Gajian bulan {monthNamesID[now.getMonth()]} jatuh pada</p>
              <p className="text-sm font-semibold text-fg flex items-center gap-2">
                <CalendarDays size={15} className="text-accent" />
                {formatDate(nextPay.effective, { withDay: true })}
                {nextPay.shifted && (
                  <Badge className="text-warning border-warning/30 bg-warning/10">
                    dimajukan ({nextPay.reason})
                  </Badge>
                )}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader
          title="Kategori"
          subtitle="Atur kategori pemasukan & pengeluaran sesuai kebutuhan kamu."
          action={
            <Button size="sm" onClick={() => setCatForm({ open: true, editing: null })}>
              <Plus size={15} /> Tambah
            </Button>
          }
        />
        <CardBody className="space-y-5">
          <div>
            <p className="text-2xs font-semibold uppercase tracking-wide text-muted mb-2 flex items-center gap-1.5">
              <Tag size={12} /> Pengeluaran
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {expenseCats.map((c) => (
                <CategoryRow key={c.id} cat={c} onEdit={() => setCatForm({ open: true, editing: c })} onDelete={() => deleteCategory(c.id)} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-2xs font-semibold uppercase tracking-wide text-muted mb-2 flex items-center gap-1.5">
              <Coins size={12} /> Pemasukan
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {incomeCats.map((c) => (
                <CategoryRow key={c.id} cat={c} onEdit={() => setCatForm({ open: true, editing: c })} onDelete={() => deleteCategory(c.id)} />
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Income sources */}
      <Card>
        <CardHeader title="Sumber Pemasukan" subtitle="Contoh: Gaji Kantor, Freelance, Bisnis sampingan." />
        <CardBody className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSource()}
                placeholder="Nama sumber pemasukan"
              />
            </div>
            <Button onClick={handleAddSource}><Plus size={16} /> Tambah</Button>
          </div>
          {incomeSources.length === 0 ? (
            <p className="text-xs text-muted">Belum ada sumber pemasukan.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {incomeSources.map((s) => (
                <div key={s.id} className="inline-flex items-center gap-2 pl-3 pr-1.5 h-8 rounded-full bg-surface-2 border border-border text-sm">
                  <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
                  {s.name}
                  <button onClick={() => deleteIncomeSource(s.id)} className="h-5 w-5 flex items-center justify-center rounded-full text-muted hover:text-negative hover:bg-negative/10">
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Holidays */}
      <Card>
        <CardHeader
          title="Hari Libur Nasional"
          subtitle="Otomatis diambil dari tanggalmerah.upset.dev untuk perhitungan gajian."
          action={
            <div className="flex items-center gap-2">
              <select
                value={holidayYear}
                onChange={(e) => setHolidayYear(Number(e.target.value))}
                className="h-8 px-2 rounded-lg bg-surface border border-border text-xs text-fg outline-none"
              >
                {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <Button size="icon" variant="secondary" onClick={() => setHolidayYear((y) => y)} title="Muat ulang">
                <RefreshCw size={14} className={loadingHol ? 'animate-spin' : ''} />
              </Button>
            </div>
          }
        />
        <CardBody>
          {loadingHol ? (
            <p className="text-xs text-muted py-4 text-center">Memuat data libur…</p>
          ) : holidays.length === 0 ? (
            <Empty icon={CalendarDays} title="Gagal memuat" description="Cek koneksi internet lalu muat ulang." />
          ) : (
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 max-h-72 overflow-y-auto pr-1">
              {holidays.map((h) => (
                <div key={h.date} className="flex items-center gap-2 py-1 text-sm border-b border-border/50 last:border-0">
                  <span className={`h-1.5 w-1.5 rounded-full ${h.type === 'holiday' ? 'bg-negative' : 'bg-warning'}`} />
                  <span className="text-muted text-xs tnum w-16">{formatDate(h.date, { short: true }).replace(` ${holidayYear}`, '')}</span>
                  <span className="text-fg truncate flex-1">{h.name}</span>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Danger zone */}
      <Card className="border-negative/30">
        <CardHeader title="Zona Berbahaya" subtitle="Tindakan di bawah ini tidak bisa dibatalkan. Lakukan dengan hati-hati." />
        <CardBody className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-negative/30 bg-negative/[0.04]">
            <div>
              <p className="text-sm font-medium text-fg">Destroy Data</p>
              <p className="text-2xs text-muted mt-0.5">
                Hapus semua transaksi & anggaran, saldo rekening jadi 0. Kategori, sumber pemasukan, rekening & pengaturan tetap aman.
              </p>
            </div>
            <Button variant="danger" className="shrink-0" onClick={() => { setDestroyConfirm(''); setDestroyOpen(true) }}>
              <Bomb size={16} /> Destroy Data
            </Button>
          </div>
        </CardBody>
      </Card>

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
          <div className="flex items-start gap-3 p-3 rounded-lg bg-negative/[0.06] border border-negative/25">
            <AlertTriangle size={18} className="text-negative shrink-0 mt-0.5" />
            <p className="text-xs text-fg leading-relaxed">
              Tindakan ini <b>tidak bisa dibatalkan</b>. Pastikan kamu benar-benar ingin mengosongkan data.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-2xs font-semibold uppercase tracking-wide text-negative mb-2">Akan dihapus</p>
              <ul className="space-y-1 text-xs text-muted">
                <li>• Semua transaksi</li>
                <li>• Semua anggaran</li>
                <li>• Saldo awal rekening → 0</li>
                <li>• Riwayat bayar tagihan rutin</li>
              </ul>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-2xs font-semibold uppercase tracking-wide text-positive mb-2">Tetap aman</p>
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

      <CategoryForm open={catForm.open} editing={catForm.editing} onClose={() => setCatForm({ open: false, editing: null })} />
    </div>
  )
}

function CategoryRow({ cat, onEdit, onDelete }) {
  return (
    <div className="group flex items-center gap-3 px-3 h-12 rounded-lg border border-border bg-surface hover:bg-surface-2 transition-colors">
      <CategoryIcon name={cat.icon} color={cat.color} size={16} />
      <span className="text-sm text-fg flex-1 truncate">{cat.name}</span>
      <button onClick={onEdit} className="h-9 w-9 lg:h-7 lg:w-7 flex items-center justify-center rounded-md text-muted hover:text-fg hover:bg-border/50 active:bg-border/50 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
        <Pencil size={15} className="lg:hidden" /><Pencil size={13} className="hidden lg:block" />
      </button>
      <button onClick={onDelete} className="h-9 w-9 lg:h-7 lg:w-7 flex items-center justify-center rounded-md text-muted hover:text-negative hover:bg-negative/10 active:bg-negative/10 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
        <Trash2 size={15} className="lg:hidden" /><Trash2 size={13} className="hidden lg:block" />
      </button>
    </div>
  )
}
