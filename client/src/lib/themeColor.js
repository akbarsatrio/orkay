// Warna status bar PWA mengikuti --bg yang sedang aktif (tema terang/gelap x tampilan baru/lama).
export function syncThemeColor() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  if (!bg) return
  const color = `rgb(${bg.split(/\s+/).join(', ')})`
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', color))
}
