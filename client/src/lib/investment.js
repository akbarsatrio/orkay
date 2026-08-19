// Kalkulasi investasi sisi client (mirror server/lib/investment.js).
// Dipakai untuk preview di form & metrik turunan di DataContext.
//
// Return = mark-to-market, BUKAN bunga.
//   net_cashflow  = contribution - withdrawal (withdrawal = GROSS keluar portfolio, Makna A)
//   return_gross  = marketValue - (prevMarketValue + net_cashflow)
//   return_bersih = return_gross - fee - tax

export function computeFee({ enabled, mode, value }, withdrawalGross) {
  if (!enabled) return 0
  const v = Number(value) || 0
  if (mode === 'percent') return Math.round((v / 100) * (Number(withdrawalGross) || 0))
  return Math.round(v)
}

export function computeTax({ enabled, mode, value, basis }, withdrawalGross, fee) {
  if (!enabled) return 0
  const v = Number(value) || 0
  if (mode !== 'percent') return Math.round(v)
  const gross = Number(withdrawalGross) || 0
  const base = basis === 'after_fee' ? gross - (Number(fee) || 0) : gross
  return Math.round((v / 100) * base)
}

// Hitung deret metrik kumulatif dari snapshot (urut tanggal ASC).
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

  return rows.map((s) => {
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
      netCashflow, returnGross, returnNet, receivedNet,
      totalContribution, totalWithdrawal, totalFee, totalTax, cumulativeReturn,
    }
  })
}

export function summarizeInvestment(snapshots) {
  const series = computeSnapshotSeries(snapshots)
  if (series.length === 0) {
    return {
      marketValue: 0, totalContribution: 0, totalWithdrawal: 0,
      totalFee: 0, totalTax: 0, cumulativeReturn: 0, netInvested: 0, returnPct: 0, count: 0,
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
    count: series.length,
  }
}
