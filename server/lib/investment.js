// Kalkulasi rekening investasi (mark-to-market, BUKAN bunga).
//
// Konsep (hasil validasi konsep di session-ses_fe75):
//  - Tiap periode user mencatat: setoran, tarikan (gross), fee, tax, dan nilai portfolio saat itu.
//  - Return periode = selisih nilai pasar setelah dikoreksi aliran dana (net cashflow).
//  - Withdraw = setoran negatif. Fee & tax = pos biaya terpisah (tidak mengurangi net cashflow,
//    tapi mengurangi return bersih), karena tarikan pakai GROSS (Makna A).
//
//    net_cashflow  = contribution - withdrawal            (withdrawal = GROSS keluar portfolio)
//    return_gross  = marketValue - (prevMarketValue + net_cashflow)
//    return_bersih = return_gross - fee - tax
//
// Baris pertama (tidak ada prev) return-nya 0 — baru mulai, wajar.

// Hitung fee dari input. mode: 'fix' | 'percent'. base = tarikan gross.
export function computeFee({ enabled, mode, value }, withdrawalGross) {
  if (!enabled) return 0
  const v = Number(value) || 0
  if (mode === 'percent') return Math.round((v / 100) * (Number(withdrawalGross) || 0))
  return Math.round(v)
}

// Hitung tax. mode: 'fix' | 'percent'. basis: 'gross' | 'after_fee' (hanya relevan saat percent).
export function computeTax({ enabled, mode, value, basis }, withdrawalGross, fee) {
  if (!enabled) return 0
  const v = Number(value) || 0
  if (mode !== 'percent') return Math.round(v)
  const gross = Number(withdrawalGross) || 0
  const base = basis === 'after_fee' ? gross - (Number(fee) || 0) : gross
  return Math.round((v / 100) * base)
}

// Diberikan array snapshot (urut tanggal ASC), hitung metrik kumulatif tiap baris.
// Mengembalikan array baru dengan field turunan menempel di tiap snapshot.
export function computeSnapshotSeries(snapshotsAsc) {
  const rows = [...snapshotsAsc].sort((a, b) =>
    a.date === b.date ? String(a.id).localeCompare(String(b.id)) : a.date.localeCompare(b.date)
  )

  let prevMarketValue = null
  let totalContribution = 0
  let totalWithdrawal = 0
  let totalFee = 0
  let totalTax = 0
  let cumulativeReturn = 0

  const result = rows.map((s) => {
    const contribution = Number(s.contribution) || 0
    const withdrawal = Number(s.withdrawal) || 0
    const fee = Number(s.fee) || 0
    const tax = Number(s.tax) || 0
    const marketValue = Number(s.marketValue) || 0

    const netCashflow = contribution - withdrawal
    const returnGross = prevMarketValue === null ? 0 : marketValue - (prevMarketValue + netCashflow)
    const returnNet = returnGross - fee - tax
    const receivedNet = withdrawal > 0 ? withdrawal - fee - tax : 0

    totalContribution += contribution
    totalWithdrawal += withdrawal
    totalFee += fee
    totalTax += tax
    cumulativeReturn += returnNet
    prevMarketValue = marketValue

    return {
      ...s,
      netCashflow,
      returnGross,
      returnNet,
      receivedNet,
      totalContribution,
      totalWithdrawal,
      totalFee,
      totalTax,
      cumulativeReturn,
    }
  })

  return result
}

// Ringkasan 1 akun investasi dari seluruh snapshot-nya.
export function summarizeInvestment(snapshots) {
  const series = computeSnapshotSeries(snapshots)
  if (series.length === 0) {
    return {
      marketValue: 0,
      totalContribution: 0,
      totalWithdrawal: 0,
      totalFee: 0,
      totalTax: 0,
      cumulativeReturn: 0,
      // modal bersih yang masih "nyangkut" di portfolio = setor - tarik
      netInvested: 0,
      // total return relatif terhadap modal bersih
      returnPct: 0,
    }
  }
  const last = series[series.length - 1]
  const netInvested = last.totalContribution - last.totalWithdrawal
  const returnPct = netInvested > 0 ? (last.cumulativeReturn / netInvested) * 100 : 0
  return {
    marketValue: Number(last.marketValue) || 0,
    totalContribution: last.totalContribution,
    totalWithdrawal: last.totalWithdrawal,
    totalFee: last.totalFee,
    totalTax: last.totalTax,
    cumulativeReturn: last.cumulativeReturn,
    netInvested,
    returnPct,
  }
}
