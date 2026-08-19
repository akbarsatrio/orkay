import { useEffect, useMemo, useState } from 'react'
import { Modal, Button, Input, Select, Segmented, Toggle } from '../ui/index.jsx'
import { useData } from '../../context/DataContext.jsx'
import { formatNumber, parseNumber, formatRupiah, toISODate } from '../../lib/format.js'
import { computeFee, computeTax, computeSnapshotSeries } from '../../lib/investment.js'

const emptyForm = () => ({
  accountId: '',
  date: toISODate(new Date()),
  action: 'contribute',       // 'contribute' | 'withdraw'
  contribution: 0,
  withdrawal: 0,
  marketValue: 0,
  note: '',
  feeEnabled: false,
  feeMode: 'fix',             // 'fix' | 'percent'
  feeValue: 0,
  taxEnabled: false,
  taxMode: 'fix',
  taxValue: 0,
  taxBasis: 'gross',          // 'gross' | 'after_fee'
})

export default function SnapshotForm({ open, onClose, accountId, editing }) {
  const { accounts, investmentSnapshots, addInvestmentSnapshot, updateInvestmentSnapshot } = useData()
  const investAccounts = useMemo(() => accounts.filter((a) => a.kind === 'investment'), [accounts])

  const [form, setForm] = useState(emptyForm())
  const [contribStr, setContribStr] = useState('')
  const [withdrawStr, setWithdrawStr] = useState('')
  const [marketStr, setMarketStr] = useState('')
  const [feeStr, setFeeStr] = useState('')
  const [taxStr, setTaxStr] = useState('')
  // true kalau user sudah mengoreksi nilai portfolio manual (jangan ditimpa auto-baseline)
  const [marketTouched, setMarketTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    if (editing) {
      const action = editing.withdrawal > 0 ? 'withdraw' : 'contribute'
      setForm({
        ...emptyForm(),
        accountId: editing.accountId,
        date: editing.date,
        action,
        contribution: editing.contribution || 0,
        withdrawal: editing.withdrawal || 0,
        marketValue: editing.marketValue || 0,
        note: editing.note || '',
        feeEnabled: (editing.fee || 0) > 0,
        feeMode: 'fix',
        feeValue: editing.fee || 0,
        taxEnabled: (editing.tax || 0) > 0,
        taxMode: 'fix',
        taxValue: editing.tax || 0,
        taxBasis: 'gross',
      })
      setContribStr(editing.contribution ? formatNumber(editing.contribution) : '')
      setWithdrawStr(editing.withdrawal ? formatNumber(editing.withdrawal) : '')
      setMarketStr(editing.marketValue ? formatNumber(editing.marketValue) : '')
      setFeeStr(editing.fee ? formatNumber(editing.fee) : '')
      setTaxStr(editing.tax ? formatNumber(editing.tax) : '')
      setMarketTouched(true) // nilai tersimpan dianggap sudah dikoreksi user
    } else {
      const f = emptyForm()
      f.accountId = accountId || investAccounts[0]?.id || ''
      setForm(f)
      setContribStr(''); setWithdrawStr(''); setMarketStr(''); setFeeStr(''); setTaxStr('')
      setMarketTouched(false) // form baru: nilai akan auto-terisi dari baseline
    }
  }, [open, editing, accountId, investAccounts])

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))
  const isWithdraw = form.action === 'withdraw'

  // Nilai periode sebelumnya (buat preview return) — snapshot terakhir akun ini sebelum tanggal form.
  const prevMarketValue = useMemo(() => {
    if (!form.accountId) return null
    const prior = investmentSnapshots
      .filter((s) => s.accountId === form.accountId && (!editing || s.id !== editing.id))
      .filter((s) => s.date <= form.date)
      .sort((a, b) => (a.date === b.date ? String(a.id).localeCompare(String(b.id)) : a.date.localeCompare(b.date)))
    return prior.length ? Number(prior[prior.length - 1].marketValue) || 0 : null
  }, [form.accountId, form.date, investmentSnapshots, editing])

  // Preview fee/tax/return real-time
  const preview = useMemo(() => {
    const withdrawalGross = isWithdraw ? parseNumber(withdrawStr) : 0
    const contribution = isWithdraw ? 0 : parseNumber(contribStr)
    const marketValue = parseNumber(marketStr)
    const fee = isWithdraw
      ? computeFee({ enabled: form.feeEnabled, mode: form.feeMode, value: parseNumber(feeStr) }, withdrawalGross)
      : 0
    const tax = isWithdraw
      ? computeTax({ enabled: form.taxEnabled, mode: form.taxMode, value: parseNumber(taxStr), basis: form.taxBasis }, withdrawalGross, fee)
      : 0
    const netCashflow = contribution - withdrawalGross
    const returnGross = prevMarketValue === null ? 0 : marketValue - (prevMarketValue + netCashflow)
    const returnNet = returnGross - fee - tax
    const receivedNet = withdrawalGross > 0 ? withdrawalGross - fee - tax : 0
    return { withdrawalGross, contribution, marketValue, fee, tax, netCashflow, returnGross, returnNet, receivedNet }
  }, [isWithdraw, withdrawStr, contribStr, marketStr, feeStr, taxStr, form.feeEnabled, form.feeMode, form.taxEnabled, form.taxMode, form.taxBasis, prevMarketValue])

  // Baseline nilai portfolio = nilai_lalu + setoran − tarikan (asumsi pasar tidak bergerak).
  // Kalau user tidak mengoreksi, return periode = 0 dan nilai turun saat ditarik (sesuai realita).
  const baselineMarket = useMemo(() => {
    const contribution = isWithdraw ? 0 : parseNumber(contribStr)
    const withdrawalGross = isWithdraw ? parseNumber(withdrawStr) : 0
    return Math.max(0, (prevMarketValue ?? 0) + contribution - withdrawalGross)
  }, [isWithdraw, contribStr, withdrawStr, prevMarketValue])

  // Auto-isi field nilai portfolio dengan baseline, selama user belum mengoreksinya manual.
  useEffect(() => {
    if (!open || marketTouched) return
    setMarketStr(baselineMarket ? formatNumber(baselineMarket) : '')
    set({ marketValue: baselineMarket })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, marketTouched, baselineMarket])

  const isMarketEstimate = !marketTouched && parseNumber(marketStr) === baselineMarket

  const canSave =
    !!form.accountId && !!form.date && parseNumber(marketStr) >= 0 &&
    (isWithdraw ? parseNumber(withdrawStr) > 0 : parseNumber(contribStr) > 0 || parseNumber(marketStr) > 0)

  const numHandler = (setter, key) => (e) => {
    const v = parseNumber(e.target.value)
    setter(v ? formatNumber(v) : '')
    set({ [key]: v })
  }

  // Field nilai portfolio: mengetik = koreksi manual (matikan auto-baseline).
  const handleMarket = (e) => {
    const v = parseNumber(e.target.value)
    setMarketTouched(true)
    setMarketStr(v ? formatNumber(v) : '')
    set({ marketValue: v })
  }

  // Kembalikan field nilai ke estimasi baseline.
  const useEstimate = () => {
    setMarketTouched(false)
    setMarketStr(baselineMarket ? formatNumber(baselineMarket) : '')
    set({ marketValue: baselineMarket })
  }

  const handleSave = () => {
    if (!canSave) return
    const withdrawalGross = isWithdraw ? parseNumber(withdrawStr) : 0
    const payload = {
      accountId: form.accountId,
      date: form.date,
      contribution: isWithdraw ? 0 : parseNumber(contribStr),
      withdrawal: withdrawalGross,
      marketValue: parseNumber(marketStr),
      note: form.note.trim() || null,
      // kirim config fee/tax mentah, server yang hitung final
      feeInput: isWithdraw
        ? { enabled: form.feeEnabled, mode: form.feeMode, value: parseNumber(feeStr) }
        : { enabled: false, mode: 'fix', value: 0 },
      taxInput: isWithdraw
        ? { enabled: form.taxEnabled, mode: form.taxMode, value: parseNumber(taxStr), basis: form.taxBasis }
        : { enabled: false, mode: 'fix', value: 0, basis: 'gross' },
    }
    if (editing) updateInvestmentSnapshot(editing.id, payload)
    else addInvestmentSnapshot(payload)
    onClose()
  }

  const returnColor = (v) => (v > 0 ? 'text-positive' : v < 0 ? 'text-negative' : 'text-muted')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Catatan Investasi' : 'Catat Periode Investasi'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={handleSave} disabled={!canSave}>Simpan</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Rekening" value={form.accountId} onChange={(e) => set({ accountId: e.target.value })}>
            {investAccounts.length === 0 && <option value="">— belum ada —</option>}
            {investAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <Input type="date" label="Tanggal" value={form.date} onChange={(e) => set({ date: e.target.value })} />
        </div>

        <Segmented
          fill
          options={[
            { value: 'contribute', label: 'Setor' },
            { value: 'withdraw', label: 'Tarik' },
          ]}
          value={form.action}
          onChange={(v) => set({ action: v })}
        />

        {isWithdraw ? (
          <RupiahField label="Tarikan (yang keluar dari portfolio)" value={withdrawStr} onChange={numHandler(setWithdrawStr, 'withdrawal')} />
        ) : (
          <RupiahField label="Setoran (uang masuk ke portfolio)" value={contribStr} onChange={numHandler(setContribStr, 'contribution')} />
        )}

        {isWithdraw && (
          <div className="rounded-lg border border-border bg-surface-2/40 p-3 space-y-3">
            {/* FEE */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-fg">Ada biaya admin (fee)?</span>
              <Toggle checked={form.feeEnabled} onChange={(v) => set({ feeEnabled: v })} />
            </div>
            {form.feeEnabled && (
              <div className="grid grid-cols-2 gap-2 items-end">
                <Segmented
                  fill
                  options={[{ value: 'fix', label: 'Rp' }, { value: 'percent', label: '%' }]}
                  value={form.feeMode}
                  onChange={(v) => set({ feeMode: v })}
                />
                <Input
                  inputMode="numeric"
                  label={form.feeMode === 'percent' ? 'Persen fee' : 'Nominal fee'}
                  value={feeStr}
                  onChange={numHandler(setFeeStr, 'feeValue')}
                  placeholder={form.feeMode === 'percent' ? '2' : '10.000'}
                />
              </div>
            )}

            {/* TAX */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-medium text-fg">Ada pajak (tax)?</span>
              <Toggle checked={form.taxEnabled} onChange={(v) => set({ taxEnabled: v })} />
            </div>
            {form.taxEnabled && (
              <>
                <div className="grid grid-cols-2 gap-2 items-end">
                  <Segmented
                    fill
                    options={[{ value: 'fix', label: 'Rp' }, { value: 'percent', label: '%' }]}
                    value={form.taxMode}
                    onChange={(v) => set({ taxMode: v })}
                  />
                  <Input
                    inputMode="numeric"
                    label={form.taxMode === 'percent' ? 'Persen tax' : 'Nominal tax'}
                    value={taxStr}
                    onChange={numHandler(setTaxStr, 'taxValue')}
                    placeholder={form.taxMode === 'percent' ? '1' : '5.000'}
                  />
                </div>
                {form.taxMode === 'percent' && (
                  <div>
                    <span className="block text-2xs font-medium text-muted mb-1.5">Basis pajak (beda bursa beda aturan)</span>
                    <Segmented
                      fill
                      options={[
                        { value: 'gross', label: 'Dari tarikan' },
                        { value: 'after_fee', label: 'Setelah fee' },
                      ]}
                      value={form.taxBasis}
                      onChange={(v) => set({ taxBasis: v })}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div>
          <RupiahField
            label="Nilai portfolio sekarang (dari bursa)"
            value={marketStr}
            onChange={handleMarket}
            hint="Terisi otomatis dari nilai lalu + setor − tarik. Ubah kalau nilai real di bursa beda — selisihnya jadi untung/rugi periode ini."
          />
          {isMarketEstimate && parseNumber(marketStr) > 0 ? (
            <p className="text-2xs text-warning/90 mt-1">≈ estimasi (belum dikoreksi). Cek nilai real di bursa & ubah bila perlu.</p>
          ) : marketTouched ? (
            <button type="button" onClick={useEstimate} className="text-2xs text-accent hover:underline mt-1">
              ↺ Pakai estimasi ({formatRupiah(baselineMarket)})
            </button>
          ) : null}
        </div>

        <Input label="Catatan (opsional)" value={form.note} onChange={(e) => set({ note: e.target.value })} placeholder="mis. beli saham BBRI, DCA bulanan" />

        {/* Preview kalkulasi */}
        <div className="rounded-lg border border-border bg-surface-2/40 p-3 space-y-1.5 text-xs">
          <p className="text-2xs font-semibold uppercase tracking-wide text-muted mb-1">Perhitungan Orkay</p>
          {prevMarketValue === null ? (
            <Row label="Nilai periode lalu" value="— (baru mulai)" />
          ) : (
            <Row label="Nilai periode lalu" value={formatRupiah(prevMarketValue)} />
          )}
          <Row label={isWithdraw ? 'Tarikan (gross)' : 'Setoran'} value={formatRupiah(isWithdraw ? preview.withdrawalGross : preview.contribution)} />
          {isWithdraw && preview.fee > 0 && <Row label="Fee" value={'− ' + formatRupiah(preview.fee)} valueClass="text-negative" />}
          {isWithdraw && preview.tax > 0 && <Row label="Tax" value={'− ' + formatRupiah(preview.tax)} valueClass="text-negative" />}
          {isWithdraw && (preview.fee > 0 || preview.tax > 0) && (
            <Row label="Diterima bersih" value={formatRupiah(preview.receivedNet)} valueClass="font-medium" />
          )}
          <div className="border-t border-border my-1.5" />
          <Row label="Nilai portfolio sekarang" value={formatRupiah(preview.marketValue)} />
          <Row
            label="Untung/rugi periode ini"
            value={(preview.returnNet >= 0 ? '+ ' : '− ') + formatRupiah(Math.abs(preview.returnNet))}
            valueClass={`font-semibold ${returnColor(preview.returnNet)}`}
          />
          {prevMarketValue === null && (
            <p className="text-2xs text-muted pt-1">Periode pertama: untung/rugi selalu 0 (belum ada pembanding).</p>
          )}
        </div>
      </div>
    </Modal>
  )
}

function RupiahField({ label, value, onChange, hint }) {
  return (
    <div>
      <span className="block text-xs font-medium text-muted mb-1.5">{label}</span>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">Rp</span>
        <input
          inputMode="numeric"
          value={value}
          onChange={onChange}
          placeholder="0"
          className="w-full h-9 pl-9 pr-3 rounded-lg bg-surface border border-border text-base sm:text-sm text-fg tnum placeholder:text-muted/50 focus:border-accent outline-none"
        />
      </div>
      {hint && <span className="block text-2xs text-muted mt-1">{hint}</span>}
    </div>
  )
}

function Row({ label, value, valueClass = '' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={`tnum ${valueClass || 'text-fg'}`}>{value}</span>
    </div>
  )
}
