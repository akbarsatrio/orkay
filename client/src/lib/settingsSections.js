// Sub-layar Pengaturan (/settings/:section). Dipakai halaman Pengaturan (menu + isi) dan App (judul di Topbar).
export const SETTINGS_SECTIONS = {
  tampilan: {
    title: 'Versi tampilan',
    subtitle: 'Tampilan lama masih bisa dipakai selama masa transisi. Pilihan ini tersimpan di perangkat ini saja.',
  },
  tema: { title: 'Tema', subtitle: 'Terang, gelap, atau ikut pengaturan perangkat.' },
  gajian: { title: 'Tanggal Gajian', subtitle: 'Dipakai untuk hitung mundur gajian dan prakiraan saldo di Dashboard.' },
  kategori: { title: 'Kategori', subtitle: 'Atur kategori pemasukan & pengeluaran sesuai kebutuhan kamu.' },
  sumber: { title: 'Sumber Pemasukan', subtitle: 'Contoh: Gaji Kantor, Freelance, Bisnis sampingan.' },
  libur: { title: 'Hari Libur Nasional', subtitle: 'Otomatis diambil dari tanggalmerah.upset.dev untuk perhitungan gajian.' },
}

// Bagian yang dibuka saat /settings di desktop (panel kanan tidak boleh kosong).
export const DEFAULT_SETTINGS_SECTION = 'tampilan'
