import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CreditCard } from 'lucide-react'
import { Modal, Button, Input, Select, Textarea, Segmented, Toggle } from '../ui/index.jsx'
import { useData } from '../../context/DataContext.jsx'
import { formatNumber, parseNumber, toISODate, formatRupiah } from '../../lib/format.js'

const empty = (type = 'expense') => ({
  type,
  amount: '',
  date: toISODate(new Date()),
  categoryId: '',
  accountId: '',
  incomeSourceId: '',
  fromAccountId: '',
  toAccountId: '',
  fee: 0,
  feeCategoryId: '',
  note: '',
  // cicilan
  installment: false,
  tenorMode: 'preset', // 'preset' | 'custom'
  tenor: 12,
  customTenor: '',
  monthlyMode: 'auto', // 'auto' (pokok/tenor + bunga) | 'manual' (input nominal/bln)
  interestMode: 'rp', // 'rp' | 'pct'
  interestPerMonth: 0, // nominal Rp
  interestPct: '', // string persen
  monthlyAmount: 0,
})

const TENORS = [1, 3, 6, 9, 12, 24]

export default function TransactionForm({ open, onClose, editing }) {
  const { categories, accounts, incomeSources, addTransaction, updateTransaction, addInstallment } = useData()
  const [form, setForm] = useState(empty())
  const [amountStr, setAmountStr] = useState('')
  const [feeStr, setFeeStr] = useState('')
  const [interestStr, setInterestStr] = useState('')
  const [monthlyStr, setMonthlyStr] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!open) return
    setErr(null)
    if (editing) {
      setForm({ ...empty(editing.type), ...editing })
      setAmountStr(formatNumber(editing.amount))
      setFeeStr(editing.fee ? formatNumber(editing.fee) : '')
    } else {
      setForm(empty())
      setAmountStr('')
      setFeeStr('')
    }
    setInterestStr('')
    setMonthlyStr('')
  }, [open, editing])

  const isIncome = form.type === 'income'
  const isTransfer = form.type === 'transfer'
  const availableCats = categories.filter((c) => c.type === form.type)
  const expenseCats = categories.filter((c) => c.type === 'expense')

  const selectedAccount = accounts.find((a) => a.id === form.accountId)
  const isPaylaterAccount = selectedAccount?.kind === 'paylater'
  const canInstallment = form.type === 'expense' && isPaylaterAccount && !editing
  const useInstallment = canInstallment && form.installment

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const handleAmount = (e) => {
    const val = parseNumber(e.target.value)
    setAmountStr(val ? formatNumber(val) : '')
    set({ amount: val })
  }
  const handleFee = (e) => {
    const val = parseNumber(e.target.value)
    setFeeStr(val ? formatNumber(val) : '')
    set({ fee: val })
  }
  const handleInterest = (e) => {
    const v = parseNumber(e.target.value)
    setInterestStr(v ? formatNumber(v) : '')
    set({ interestPerMonth: v })
  }
  const handleMonthly = (e) => {
    const v = parseNumber(e.target.value)
    setMonthlyStr(v ? formatNumber(v) : '')
    set({ monthlyAmount: v })
  }

  // Tenor efektif (preset atau custom)
  const effectiveTenor = useMemo(() => {
    if (form.tenorMode === 'custom') return Math.max(1, parseInt(form.customTenor, 10) || 0)
    return Math.max(1, Number(form.tenor) || 1)
  }, [form.tenorMode, form.customTenor, form.tenor])

  // Bunga per bulan dalam nominal Rp (hasil konversi kalau mode %)
  const interestRp = useMemo(() => {
    const principal = Number(form.amount) || 0
    if (form.interestMode === 'pct') {
      const pct = parseFloat(String(form.interestPct).replace(',', '.')) || 0
      return Math.round(principal * (pct / 100))
    }
    return Number(form.interestPerMonth) || 0
  }, [form.interestMode, form.interestPct, form.interestPerMonth, form.amount])

  // Hitung tagihan per bulan cicilan (preview)
  const computedMonthly = useMemo(() => {
    const principal = Number(form.amount) || 0
    if (form.monthlyMode === 'manual') return Number(form.monthlyAmount) || 0
    return Math.round(principal / effectiveTenor) + interestRp
  }, [form.amount, effectiveTenor, form.monthlyMode, form.monthlyAmount, interestRp])

  const canSave = isTransfer
    ? form.amount > 0 && form.fromAccountId && form.toAccountId && form.fromAccountId !== form.toAccountId && form.date
    : useInstallment
      ? form.amount > 0 && form.categoryId && form.accountId && form.date && effectiveTenor >= 1 && computedMonthly > 0
      : form.amount > 0 && form.categoryId && form.accountId && form.date

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    setErr(null)
    try {
      if (useInstallment) {
        await addInstallment({
          accountId: form.accountId,
          categoryId: form.categoryId,
          name: form.note.trim() || (availableCats.find((c) => c.id === form.categoryId)?.name || 'Cicilan'),
          purchaseDate: form.date,
          principalTotal: Number(form.amount),
          tenor: effectiveTenor,
          monthlyAmount: computedMonthly,
          interestPerMonth: form.monthlyMode === 'manual' ? 0 : interestRp,
        })
      } else if (isTransfer) {
        await addTransaction({
          type: 'transfer',
          amount: Number(form.amount),
          date: form.date,
          fromAccountId: form.fromAccountId,
          toAccountId: form.toAccountId,
          fee: Number(form.fee) || 0,
          feeCategoryId: (Number(form.fee) > 0 && form.feeCategoryId) ? form.feeCategoryId : null,
          note: form.note.trim(),
        })
      } else {
        const payload = {
          type: form.type,
          amount: Number(form.amount),
          date: form.date,
          categoryId: form.categoryId,
          accountId: form.accountId,
          note: form.note.trim(),
        }
        if (isIncome && form.incomeSourceId) payload.incomeSourceId = form.incomeSourceId
        if (editing) await updateTransaction(editing.id, payload)
        else await addTransaction(payload)
      }
      onClose()
    } catch (e) {
      setErr(e.message || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const notEnoughAccounts = accounts.length < 2

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Transaksi' : 'Tambah Transaksi'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Batal</Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? 'Menyimpan…' : editing ? 'Simpan Perubahan' : useInstallment ? 'Buat Cicilan' : 'Simpan'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented
          className="w-full [&>button]:flex-1 flex"
          options={[
            { value: 'expense', label: 'Pengeluaran' },
            { value: 'income', label: 'Pemasukan' },
            { value: 'transfer', label: 'Transfer' },
          ]}
          value={form.type}
          onChange={(v) => set({ type: v, categoryId: '', installment: false })}
        />

        <div>
          <span className="block text-xs font-medium text-muted mb-1.5">{useInstallment ? 'Harga barang (total)' : 'Nominal'}</span>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">Rp</span>
            <input
              inputMode="numeric"
              value={amountStr}
              onChange={handleAmount}
              placeholder="0"
              className="w-full h-11 pl-9 pr-3 rounded-lg bg-surface border border-border text-lg font-semibold text-fg tnum placeholder:text-muted/50 focus:border-accent outline-none"
            />
          </div>
        </div>

        {isTransfer ? (
          <>
            {notEnoughAccounts && (
              <p className="text-xs text-warning">Butuh minimal 2 rekening untuk transfer. Tambahkan rekening dulu.</p>
            )}
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <Select label="Dari" value={form.fromAccountId} onChange={(e) => set({ fromAccountId: e.target.value })}>
                <option value="">Rekening asal</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id} disabled={a.id === form.toAccountId}>{a.name}</option>
                ))}
              </Select>
              <div className="h-9 flex items-center justify-center text-muted">
                <ArrowRight size={16} />
              </div>
              <Select label="Ke" value={form.toAccountId} onChange={(e) => set({ toAccountId: e.target.value })}>
                <option value="">Rekening tujuan</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id} disabled={a.id === form.fromAccountId}>{a.name}</option>
                ))}
              </Select>
            </div>
            {form.fromAccountId && form.fromAccountId === form.toAccountId && (
              <p className="text-2xs text-negative">Rekening asal dan tujuan tidak boleh sama.</p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="block text-xs font-medium text-muted mb-1.5">Biaya admin (opsional)</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">Rp</span>
                  <input
                    inputMode="numeric"
                    value={feeStr}
                    onChange={handleFee}
                    placeholder="0"
                    className="w-full h-9 pl-9 pr-3 rounded-lg bg-surface border border-border text-sm text-fg tnum placeholder:text-muted/50 focus:border-accent outline-none"
                  />
                </div>
              </div>
              {Number(form.fee) > 0 && (
                <Select label="Kategori biaya" value={form.feeCategoryId} onChange={(e) => set({ feeCategoryId: e.target.value })}>
                  <option value="">— Tidak dicatat —</option>
                  {expenseCats.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Kategori" value={form.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
                <option value="">Pilih kategori</option>
                {availableCats.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
              <Select label="Rekening" value={form.accountId} onChange={(e) => set({ accountId: e.target.value, installment: false })}>
                <option value="">Pilih rekening</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}{a.kind === 'paylater' ? ' (pay later)' : ''}</option>
                ))}
              </Select>
            </div>

            {isIncome && (
              <Select label="Sumber Pemasukan (opsional)" value={form.incomeSourceId} onChange={(e) => set({ incomeSourceId: e.target.value })}>
                <option value="">— Tidak ditentukan —</option>
                {incomeSources.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            )}

            {canInstallment && (
              <div className="rounded-lg border border-border bg-surface-2/40 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-fg">
                    <CreditCard size={15} className="text-accent" /> Cicilan
                  </span>
                  <Toggle checked={form.installment} onChange={(v) => set({ installment: v })} />
                </div>

                {useInstallment && (
                  <>
                    <div>
                      <span className="block text-xs font-medium text-muted mb-1.5">Tenor</span>
                      <div className="flex flex-wrap gap-1.5">
                        {TENORS.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => set({ tenorMode: 'preset', tenor: t })}
                            className={`h-8 px-3 rounded-lg text-xs font-medium border transition-colors ${form.tenorMode === 'preset' && form.tenor === t ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted hover:text-fg'}`}
                          >
                            {t}x
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => set({ tenorMode: 'custom' })}
                          className={`h-8 px-3 rounded-lg text-xs font-medium border transition-colors ${form.tenorMode === 'custom' ? 'border-accent bg-accent/10 text-accent' : 'border-border text-muted hover:text-fg'}`}
                        >
                          Custom
                        </button>
                      </div>
                      {form.tenorMode === 'custom' && (
                        <div className="relative mt-2 max-w-[140px]">
                          <input
                            inputMode="numeric"
                            value={form.customTenor}
                            onChange={(e) => set({ customTenor: e.target.value.replace(/[^\d]/g, '') })}
                            placeholder="mis. 15"
                            className="w-full h-9 pl-3 pr-8 rounded-lg bg-surface border border-border text-sm text-fg tnum focus:border-accent outline-none"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">x</span>
                        </div>
                      )}
                    </div>

                    <Segmented
                      className="flex w-full [&>button]:flex-1"
                      options={[
                        { value: 'auto', label: 'Pokok + bunga' },
                        { value: 'manual', label: 'Input tagihan/bln' },
                      ]}
                      value={form.monthlyMode}
                      onChange={(v) => set({ monthlyMode: v })}
                    />

                    {form.monthlyMode === 'auto' ? (
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium text-muted">Bunga per bulan (opsional)</span>
                          <Segmented
                            options={[
                              { value: 'rp', label: 'Rp' },
                              { value: 'pct', label: '%' },
                            ]}
                            value={form.interestMode}
                            onChange={(v) => set({ interestMode: v })}
                          />
                        </div>
                        {form.interestMode === 'rp' ? (
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">Rp</span>
                            <input
                              inputMode="numeric"
                              value={interestStr}
                              onChange={handleInterest}
                              placeholder="0"
                              className="w-full h-9 pl-9 pr-3 rounded-lg bg-surface border border-border text-sm text-fg tnum focus:border-accent outline-none"
                            />
                          </div>
                        ) : (
                          <div>
                            <div className="relative">
                              <input
                                inputMode="decimal"
                                value={form.interestPct}
                                onChange={(e) => set({ interestPct: e.target.value.replace(/[^\d.,]/g, '') })}
                                placeholder="0"
                                className="w-full h-9 pl-3 pr-8 rounded-lg bg-surface border border-border text-sm text-fg tnum focus:border-accent outline-none"
                              />
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">%</span>
                            </div>
                            <p className="text-2xs text-muted mt-1">
                              {parseFloat(String(form.interestPct).replace(',', '.')) > 0
                                ? `${form.interestPct}% dari pokok = ${formatRupiah(interestRp)}/bln (flat)`
                                : 'Persen flat dari harga pokok, per bulan.'}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <span className="block text-xs font-medium text-muted mb-1.5">Tagihan per bulan</span>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">Rp</span>
                          <input
                            inputMode="numeric"
                            value={monthlyStr}
                            onChange={handleMonthly}
                            placeholder="0"
                            className="w-full h-9 pl-9 pr-3 rounded-lg bg-surface border border-border text-sm text-fg tnum focus:border-accent outline-none"
                          />
                        </div>
                      </div>
                    )}

                    <div className="rounded-lg bg-accent/[0.06] border border-accent/20 p-3 text-sm">
                      <div className="flex justify-between text-fg">
                        <span className="text-muted">Tagihan / bulan</span>
                        <span className="font-semibold tnum">{formatRupiah(computedMonthly)}</span>
                      </div>
                      <div className="flex justify-between text-2xs text-muted mt-1">
                        <span>Total {effectiveTenor}x</span>
                        <span className="tnum">{formatRupiah(computedMonthly * effectiveTenor)}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}

        <Input type="date" label={useInstallment ? 'Tanggal pembelian' : 'Tanggal'} value={form.date} onChange={(e) => set({ date: e.target.value })} />

        <Textarea label={useInstallment ? 'Nama barang / catatan' : 'Catatan (opsional)'} rows={2} value={form.note} onChange={(e) => set({ note: e.target.value })} placeholder={isTransfer ? 'mis. Top up GoPay' : useInstallment ? 'mis. iPhone 15' : 'mis. Makan siang di kantin'} />

        {err && <p className="text-xs text-negative">{err}</p>}
      </div>
    </Modal>
  )
}
