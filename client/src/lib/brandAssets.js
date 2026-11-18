// Logo & ikon PWA per tampilan: tampilan baru = oranye bata, tampilan lama = indigo (asli).
// index.html memuat aset tampilan baru (default); fungsi ini menukar ke aset lama bila perangkat memilih tampilan lama.
// Catatan: ikon aplikasi yang sudah ter-install di layar utama tidak ikut berganti; ia memakai ikon saat install.
const ASSETS = {
  new: { logo: '/wallet-new.svg', touch: '/apple-touch-icon-new.png', manifest: '/manifest-new.webmanifest' },
  legacy: { logo: '/wallet.svg', touch: '/apple-touch-icon.png', manifest: '/manifest.webmanifest' },
}

export const LOGO_NEW = ASSETS.new.logo

export function syncBrandAssets(ui) {
  const a = ASSETS[ui] || ASSETS.new
  document.querySelector('link[rel="icon"]')?.setAttribute('href', a.logo)
  document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', a.touch)
  document.querySelector('link[rel="manifest"]')?.setAttribute('href', a.manifest)
}
