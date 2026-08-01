// Resolusi nama -> entity (akun / kategori / income source).
// AI/user mengetik nama bebas ("gopay", "makan", "jago") -> cari ID yang cocok.
// Strategi cocok bertingkat: exact -> startsWith -> substring -> token overlap.
// Kalau ambigu (banyak kandidat setara), lempar AmbiguousError agar caller
// bisa minta klarifikasi.

export class ResolveError extends Error {
  constructor(message, candidates = []) {
    super(message)
    this.name = 'ResolveError'
    this.candidates = candidates
  }
}

function norm(s) {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ')
}

// Skor kecocokan: makin kecil makin bagus (0 = exact). null = tidak cocok.
function matchScore(query, name) {
  const q = norm(query)
  const n = norm(name)
  if (!q) return null
  if (n === q) return 0
  if (n.startsWith(q)) return 1
  if (n.includes(q)) return 2
  if (q.includes(n)) return 3
  // token overlap (mis. "kartu kredit" vs "kredit permata")
  const qt = new Set(q.split(' '))
  const nt = n.split(' ')
  const overlap = nt.filter((t) => qt.has(t)).length
  if (overlap > 0) return 4 + (nt.length - overlap) * 0.1
  return null
}

// Generic resolver. items: array objek dengan .id & .name.
// label: buat pesan error ("akun"/"kategori").
export function resolveOne(query, items, label = 'item', extraFilter = null) {
  const pool = extraFilter ? items.filter(extraFilter) : items
  const scored = pool
    .map((it) => ({ it, score: matchScore(query, it.name) }))
    .filter((x) => x.score !== null)
    .sort((a, b) => a.score - b.score)

  if (scored.length === 0) {
    const names = pool.map((p) => p.name).join(', ')
    throw new ResolveError(
      `Tidak menemukan ${label} "${query}". Pilihan yang ada: ${names || '(kosong)'}.`,
      pool
    )
  }

  const best = scored[0]
  // ambigu kalau ada kandidat lain dengan skor sama & <= 2 (cocok kuat berganda)
  const tie = scored.filter((s) => s.score === best.score)
  if (tie.length > 1 && best.score <= 2) {
    const names = tie.map((s) => s.it.name).join(', ')
    throw new ResolveError(
      `"${query}" ambigu untuk ${label} — cocok ke beberapa: ${names}. Sebutkan lebih spesifik.`,
      tie.map((s) => s.it)
    )
  }
  return best.it
}

export function resolveAccount(query, accounts, { paylaterOnly, cashOnly } = {}) {
  let filter = null
  if (paylaterOnly) filter = (a) => a.kind === 'paylater'
  if (cashOnly) filter = (a) => a.kind !== 'paylater'
  return resolveOne(query, accounts, 'akun', filter)
}

// type opsional: 'expense' | 'income' untuk mempersempit.
export function resolveCategory(query, categories, type) {
  const filter = type ? (c) => c.type === type : null
  return resolveOne(query, categories, 'kategori', filter)
}

export function resolveIncomeSource(query, incomeSources) {
  return resolveOne(query, incomeSources, 'sumber pemasukan')
}

// Cari cicilan by nama (untuk pay_installment).
export function resolveInstallment(query, installments) {
  const active = installments.filter((i) => i.active && i.paidCount < i.tenor)
  return resolveOne(query, active, 'cicilan')
}
