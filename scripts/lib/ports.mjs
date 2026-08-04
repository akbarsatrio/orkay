// Alokasi port deterministik per "slot" instance biar gak tabrakan.
//
//   slot | server | vite | brain | mysql (docker)
//   -----+--------+------+-------+---------------
//    0   |  3001  | 5173 | 4000  | 3307
//    1   |  3101  | 5273 | 4100  | 3308
//    2   |  3201  | 5373 | 4200  | 3309
//   ...
//
// Tiap slot geser 100 (server & brain) / 100 (vite) / 1 (mysql). Muat sampai
// puluhan instance tanpa bentrok dengan rentang port umum lain. Port mysql
// hanya dipakai saat DB memakai Docker (opsi B); kalau MySQL host biasa (opsi A)
// port ini diabaikan.

const BASE = {
  server: 3001,
  vite: 5173,
  brain: 4000,
  mysql: 3307,
}
const STEP = 100

export function portsForSlot(slot) {
  const s = Number(slot) || 0
  return {
    server: BASE.server + s * STEP,
    vite: BASE.vite + s * STEP,
    brain: BASE.brain + s * STEP,
    mysql: BASE.mysql + s,
  }
}

// Cari slot bebas pertama berdasarkan slot yang sudah dipakai instance lain.
export function firstFreeSlot(usedSlots) {
  const used = new Set(usedSlots.map((n) => Number(n)))
  let s = 0
  while (used.has(s)) s++
  return s
}
