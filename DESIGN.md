# DESIGN.md: Orkay

Arah desain untuk web app Orkay (`client/`). Disusun 2026-11-18 dari jawaban owner:

- Karakter **temen ngobrol**, device **seimbang (HP + laptop)**, tema **ikut sistem**.
- Revisi 2026-11-18: tampilan baru harus terasa **benar-benar beda** dari tampilan lama: warna **putih bersih +
  hitam pekat + aksen oranye bata** (indigo tidak dipakai lagi), **tanpa card pembungkus**, dan **navigasi ikut dirombak**.
- Fokus Dashboard **"aman sampai gajian?"**.
- **Informasi di semua halaman tetap sama seperti sekarang**; yang berubah hanya tampilannya.
- Tampilan baru harus **out of the box**, lewat gaya **angka raksasa**.
- **Tampilan lama tetap tersedia** sebagai pilihan, dan kemungkinan dihapus beberapa bulan ke depan.

Semua bagian sudah dikonfirmasi owner. Ubah file ini dulu sebelum mengubah arah desain; file ini milik owner.

---

## Prinsip revamp: tampilan baru, informasi tetap

User tidak boleh perlu adaptasi ulang soal isi. Berlaku untuk **semua halaman**
(Dashboard, Transaksi, Rekening, Investasi, Laporan, Settings).

Yang **dikunci** (tidak berubah):

- Kartu, angka, dan grafik yang tampil: semuanya tetap ada.
- Urutan bagian. Dashboard: 4 angka ringkasan, lalu gajian + proyeksi + tagihan akan datang,
  lalu grafik kategori + tren harian, kekayaan bersih, arus kas, lalu transaksi terbaru.
- Teks label dan judul (mis. "Total Saldo", "Gajian Berikutnya", "Tagihan Akan Datang"),
  isi badge status, dan kalimat narasi yang sudah ada.
- Interaksi: tombol "Bayar", toggle perkiraan belanja, pilihan metode, link "Lihat semua", form, filter.

Yang **boleh** berubah: warna, tipografi, ukuran, jarak, bobot visual, bentuk permukaan, ikon dekoratif,
ukuran target sentuh, dan jumlah kolom per lebar layar selama urutan bacanya sama.

---

## Identitas

Orkay itu pencatat keuangan pribadi yang ngomong kayak temen: singkat, ramah, langsung ke angka.
Web dan WhatsApp adalah satu orang yang sama, jadi suara di layar sama dengan suara di chat
(`brain/src/prompt.js`, bagian GAYA BALASAN).

Pengguna: satu orang per instance, login PIN. Bukan produk publik, jadi tidak perlu meyakinkan siapa pun;
tugas UI cuma bikin keputusan harian soal uang jadi cepat.

**Design Read:** aplikasi keuangan pribadi untuk satu pengguna, suara hangat percakapan,
bahasa visual editorial berbasis angka besar, dial **ENERGY 3 / RHYTHM 2 / MOTION 1**.

| Dial | Nilai | Artinya di Orkay |
|---|---|---|
| ENERGY | 3 | Berani lewat **tipografi**, bukan lewat warna, glow, atau animasi: kontras ukuran ekstrem antara angka dan label. |
| RHYTHM | 2 | Struktur konsisten; pemecahnya adalah satu angka raksasa per layar yang mematahkan grid. |
| MOTION | 1 | Feedback saja: hover, tekan, buka/tutup sheet dan modal. Tidak ada animasi scroll, angka berhitung, atau loop. |

---

## Motif identitas: angka raksasa

Nominal Rupiah adalah elemen visual utama. Label kecil dan tenang, angka besar dan berat,
dekorasi hampir nol. Ini yang bikin Orkay beda; warna dan ornamen sengaja ditahan supaya angkanya yang bicara.

### Skala angka

| Tingkat | Ukuran | Pemakaian |
|---|---|---|
| Raksasa | fluid, kira-kira `clamp(2.5rem, 8vw + 1rem, 5.5rem)`, berat paling tebal, `line-height: 1`, tracking sedikit rapat | **Satu angka per layar**, lihat tabel fokus. |
| Besar | fluid, kira-kira `clamp(1.75rem, 3vw + 1rem, 2.5rem)` | Angka utama di panel ringkasan dan kartu pendukung. |
| Baris | 15-16px, semibold | Angka di daftar transaksi, tagihan, rekening. |
| Label | 13px, `muted`, sentence case | Semua label angka. |

Aturan angka:
- Semua angka uang pakai `.tnum`.
- "Rp" ditulis lebih kecil dari digit dan sejajar atas, supaya digitnya yang terbaca.
- **Angka tidak boleh terpotong.** Nominal sampai 13 digit (`Rp 1.250.000.000.000`) harus muat utuh
  di layar 320px. Kalau tidak muat, ukuran turun bertahap sesuai panjang digit; tidak pakai `truncate`.
- Saat saldo disembunyikan (`BalanceVisibilityContext`), placeholder tampil di ukuran yang sama supaya layout tidak loncat.
- Kalimat narasi yang sudah ada (mis. `narrative(...)` di `CashflowForecast.jsx`, "3 hari lagi" di kartu gajian)
  jadi caption langsung di bawah angka raksasa.

### Fokus per layar

Fokus dibuat lewat ukuran di posisi yang sudah ada, bukan dengan memindah atau menghapus bagian.

| Layar | Keputusan yang dibantu | Angka raksasa |
|---|---|---|
| Dashboard | Aman nggak sampai gajian? | Proyeksi saldo sampai gajian, berwarna sesuai status (`positive`/`warning`/`negative`). |
| Rekening | Uangku ada di mana | Kekayaan bersih (kartu yang sudah ada di `Accounts.jsx`). |
| Investasi | Portofolio untung atau rugi | Total nilai portfolio (kartu yang sudah ada di `Investments.jsx`). |
| Laporan | Uang ke mana bulan ini | Angka teratas yang sudah ada di halaman Laporan. |
| Transaksi | Catat cepat & cari transaksi | Tidak ada; fokusnya tombol tambah + daftar. |
| Tagihan Rutin | Berapa tagihan tetap per bulan, mana yang belum dibayar | Total tagihan aktif / bulan. Jumlah tagihan aktif dan "menunggu konfirmasi" jadi satu baris di bawahnya; tombol Tambah di kanan. |
| Anggaran | Masih aman belanja bulan ini? | **Terpakai** (total pengeluaran di kategori beranggaran) dengan bar total di bawahnya; total anggaran dan jumlah "lewat batas" jadi satu baris keterangan; tombol Atur di kanan. Baris kategori: nama + badge status, **Sisa** rata kanan (angka penentu keputusan), lalu bar selebar baris dengan "Terpakai / Limit". Bar normal `fg`, ≥ 85% `warning`, ≥ 100% `negative` (aksen oranye tidak dipakai). |
| Settings | Ubah pengaturan | Tidak ada. Bergaya menu pengaturan HP (keputusan owner), datar tanpa kotak (gaya Android). Menu dikelompokkan (Tampilan; Keuangan; Zona Berbahaya); tiap baris: ikon 34px, nama, nilai sekarang di kanan (mis. "Ikut sistem", "Tgl 28", jumlah kategori). **HP & tablet:** `/settings` = menu, tiap baris membuka sub-layar `/settings/:section` dengan tombol kembali di Topbar. **Desktop:** menu di kiri (bagian aktif disorot), isi bagian di kanan; `/settings` membuka Versi tampilan. Pilihan tunggal (versi tampilan, tema) berupa daftar baris dengan centang, bukan `Segmented`. Destroy Data membuka dialog, bukan sub-layar. Bagian didefinisikan di `lib/settingsSections.js`. |
| Peta Transaksi | Di mana uang paling banyak keluar | Peta itu sendiri; angka **Total berlokasi** (`large`) di panel kanan bersama cakupan "N dari M transaksi punya lokasi" supaya peta tidak terlihat lengkap padahal belum. Detail di bagian "Peta Transaksi" di bawah. |

### Peta Transaksi

- **Peta dasar Mapbox `light-v11` / `dark-v11`** ikut tema: peta monokrom supaya warna kategori pada titik terbaca; aksen
  oranye tidak dipakai di peta.
- **Tempat** (untuk rincian, Cluster, Heatmap): transaksi dengan `placeId` sama digabung; titik GPS tanpa `placeId` ikut
  tempat terdekat ≤ 50 m; dua `placeId` berbeda tidak pernah digabung (toko bersebelahan di mal tetap terpisah). Logika di
  `lib/places.js`. Tempat/titik yang dibuka diberi **lingkaran 50 m** (isian `fg` 8% + garis putus-putus) dan catatan
  "Transaksi dari titik GPS dalam lingkaran 50 m ikut tempat ini", supaya aturan penggabungan terlihat, bukan tersembunyi.
- **Titik (keputusan owner)**: satu titik per transaksi di koordinat aslinya, tanpa penggabungan; warna = kategori
  transaksinya, luas sebanding nominal (akar, 5–14 px, lebih kecil dari titik tempat karena bisa bertumpuk). Ketuk titik =
  rincian tempatnya. **Cluster**: lingkaran `fg` berlabel total ringkas tanpa "Rp" ("80 rb", "1,2 jt") supaya muat; label
  jadi "N trx" saat saldo disembunyikan. **Heatmap**: ramp kuning → merah tua (konvensi "makin panas makin banyak"), bobot
  nominal atau frekuensi; di zoom dekat memudar jadi titik tempat supaya tetap bisa diketuk.
- **Rincian tempat**: nama bisa diubah (ikon pensil di judul, berlaku untuk semua transaksi tempat itu di semua periode),
  dan dua aksi lebar penuh yang sama dengan "Titik dipilih": **Buat transaksi baru di sini** (primer) dan **Pasang ke
  transaksi lama** (sekunder). Lebar penuh & bertumpuk supaya terbaca sebagai sepasang pilihan, bukan dua tombol beda
  ukuran yang membungkus.
- **Tooltip saat hover (desktop/perangkat dengan kursor; di layar sentuh ketuk = rincian)**: melayang di atas titik
  (di bawahnya kalau titik dekat tepi atas), dijaga tetap di area peta yang tidak tertutup panel, tidak menangkap kursor,
  hilang saat peta bergerak. Isi: **Titik** = satu transaksi (catatan/kategori, nominal besar, tanggal · kategori ·
  rekening, nama tempat); kalau beberapa transaksi berkoordinat persis sama (bertumpuk), ringkasannya. **Cluster** dan
  titik tempat = 3 transaksi terbesar, "+N lainnya", dan "Total N transaksi" + nominal. Nominal ikut tombol sembunyikan
  saldo. Bentuk sama dengan panel mengambang tapi `rounded-lg` (lebih kecil, sementara).
- **Peta penuh, kontrol mengambang (keputusan owner).** Peta memenuhi area konten dari tepi sidebar sampai tepi kanan,
  setinggi layar, tanpa Topbar & padding halaman (`App.jsx` → `fullBleed`). Semua kontrol berupa **panel mengambang**:
  `rounded-xl` (lebih besar dari tombol/isian `rounded-md` supaya terbaca sebagai wadah), latar `bg` padat, garis `border`,
  dan `shadow-pop` sebagai penanda elevasi di atas peta. Ini satu-satunya pengecualian aturan "tanpa card pembungkus":
  tanpa wadah, kontrol tidak terbaca di atas peta. Tanpa blur (peta di belakang tetap tajam, kontras teks terjamin).
- **Panel seringkas mungkin (keputusan owner)**: peta adalah isinya, panel hanya kontrol.
  - **Desktop**: panel kiri atas satu baris: judul, pemilih bulan (atau "Semua waktu"), tombol **Filter**, pilihan mode.
    Filter membuka baris tambahan di panel yang sama (periode, tipe, kategori, rekening, bobot heatmap saat Heatmap);
    Escape menutupnya. Kolom kanan: panel ringkasan kecil (total, cakupan, sembunyikan saldo, pilihan "Lompat ke
    tempat") dan panel rincian di bawahnya **hanya saat** tempat/titik dipilih (rincian tempat → "Titik dipilih" →
    "Pasang ke transaksi lama"), ditutup dengan ×. Daftar "Tempat paling boros" dihapus (keputusan owner).
  - **HP**: panel atas: judul, tombol Filter (badge oranye = jumlah filter aktif, sama seperti Transaksi; isinya juga
    pemilih bulan), pilihan mode selebar panel. Panel bawah di atas bottom nav: ringkasan, ditambah rincian saat
    tempat/titik dipilih (maks 60% tinggi layar). Tombol zoom disembunyikan (cubit dua jari).
- **Panel tidak menutupi data**: ukuran panel diukur (`ResizeObserver`) lalu dipakai sebagai jarak tepi `fitBounds`,
  pusat `easeTo`, titik tengah, dan titik/tempat yang sedang dibuka digeser masuk ke area terlihat kalau tertutup panel
  yang membesar.
- **Kontrol Mapbox (keputusan owner)**: lokasi saya + zoom di **kiri bawah**; logo + atribusi di **pojok kanan bawah**.
  Kolom panel kanan desktop berhenti 3rem di atas tepi bawah supaya logo & atribusi (wajib terlihat) tidak tertutup. Di HP
  keduanya diangkat ke atas panel bawah lewat CSS var `--inset-bottom`.
- **Alternatif keyboard** (titik di kanvas peta tidak bisa difokus): pilihan "Lompat ke tempat" di panel ringkasan
  (desktop) membuka rincian tempat mana pun; untuk titik baru, fokus ke peta (Tab), geser dengan tombol panah, lalu
  **Enter** memilih tengah area terlihat. Tombol peta ⌖ untuk ini dihapus atas keputusan owner; label kanvas menjelaskan
  cara pakainya ke pembaca layar.
- **Pencarian tempat dari OpenStreetMap (Photon)**, bukan Search Box Mapbox: hasil Search Box tidak boleh disimpan permanen
  menurut ToS Mapbox (keputusan owner). Atribusi "© OpenStreetMap contributors" tampil di bawah hasil pencarian.
- **Lokasi di form transaksi** opsional, hanya untuk pengeluaran & pemasukan biasa (transfer tidak punya tempat, cicilan
  dicatat lewat tagihan). Disembunyikan di balik saklar **Tambah lokasi** (keputusan owner, pola sama dengan saklar
  Cicilan) supaya form tetap pendek; saklar sudah menyala kalau transaksi punya lokasi (ubah transaksi, atau dibuka dari
  Peta), dan mematikannya menghapus lokasi. Isi: cari tempat (tempat yang pernah dipakai muncul duluan, ikon riwayat),
  atau Lokasi saat ini lalu pilih nama dari tempat terdekat. "Tetap di sini" mempertahankan lokasi untuk transaksi
  berikutnya.

### Baris tagihan

Semua daftar tagihan yang bisa dibayar/dikonfirmasi (Dashboard "Tagihan Akan Datang", Tagihan Rutin "Perlu Konfirmasi"
dan "Pay Later & Cicilan") memakai satu komponen, `components/bills/BillRow.jsx`:
ikon 34px | nama + badge (cicilan x/y, jatuh tempo) + keterangan | nominal | tombol aksi.
Di desktop nominal dan tombol sebaris; lebar tombol disamakan per halaman supaya nominal membentuk satu kolom rata kanan.
Di HP nominal di atas tombol. Daftar "Semua Tagihan Rutin" memakai kolom yang sama (status | nominal | aksi), dengan
saklar aktif/nonaktif (`Toggle`) menggantikan ikon power, dan tombol ubah/hapus yang muncul saat kursor di atas baris.

### Baris transaksi

Halaman Transaksi: toolbar (cari + jenis; kategori, rekening, rentang tanggal dengan label di atas tiap kontrol) tanpa
garis bagian, lalu daftar per hari. Kepala hari (nama hari tebal, tanggal, total bersih hari itu) menempel di atas saat
di-scroll. (Versi pita abu sudah dicoba dan ditolak owner.)
Baris: ikon 34px | judul + keterangan satu baris (kategori · rekening, atau rekening asal -> tujuan) |
nominal rata kanan bertanda (+ hijau masuk, − keluar, ⇄ abu transfer) | aksi. Di desktop ubah/hapus muncul saat kursor
di atas baris atau saat difokus keyboard.

### Aksi di HP & tablet (< 1024px): geser dan ketuk

Keputusan owner: di HP & tablet, aksi baris tidak tampil sebagai tombol. Komponen `components/ui/SwipeRow.jsx`:

- **Geser ke kiri** memunculkan tombol ikon Ubah (pensil, abu) dan Hapus (tempat sampah, merah) di kanan baris, seperti
  WhatsApp/Telegram. Tanpa label teks (keputusan owner); nama aksi ada di `aria-label`. Satu baris terbuka sekaligus;
  ketuk di luar, Escape, atau geser balik untuk menutup.
- Gerak: tombol setinggi baris, menempel tanpa celah & tanpa radius, melebar mulus dari kanan mengikuti jari (lebar
  panel = jarak geser) dengan latar padat. Konten mendapat padding kanan yang tumbuh bersama geseran (maks 14px)
  supaya nominal tidak menempel ke tombol; saat tertutup tata letak baris tidak berubah. Ikon memudar masuk selama
  80% pertama geseran (0% -> 80% = opacity 0 -> 1), lalu penuh; latar tombol tetap padat.
- **Ketuk baris = Ubah** (alternatif satu ketukan untuk gesture, WCAG 2.5.1). Form ubah punya tombol **Hapus** di kiri
  footer (`FormDeleteButton`, hanya < 1024px), jadi hapus juga bisa tanpa geser.
- Keyboard & pembaca layar: Ubah/Hapus tetap tersedia sebagai tombol tak terlihat berlabel ("Ubah Kos Poltangan").
- Dipakai di: daftar Transaksi, kartu Rekening (rekening investasi: ketuk = buka Investasi), riwayat Investasi,
  Anggaran, Semua Tagihan Rutin, Cicilan Aktif (hanya Hapus), kategori dan Sumber Pemasukan di Pengaturan
  (Sumber Pemasukan: chip di desktop, daftar baris dengan geser-hapus di HP & tablet).
- **Ketuk baris tagihan = Konfirmasi/Bayar** (`BillRow tapToAct`) di Dashboard "Tagihan Akan Datang" dan Tagihan Rutin
  "Perlu Konfirmasi" & "Pay Later & Cicilan". Tombol disembunyikan secara visual (tetap ada untuk keyboard) dan diganti
  chevron sebagai penanda baris bisa diketuk.
- Desktop (≥ 1024px) tidak berubah: tombol aksi di baris.

---

## Panel ringkasan (pengganti 4 kartu angka di Dashboard)

Empat angka ringkasan (Total Saldo, Pemasukan bulan ini, Pengeluaran bulan ini, Selisih (Net))
tampil dalam **satu panel, bukan 4 card terpisah**. Label, urutan, dan delta "vs bulan lalu" tetap.

- Total Saldo di atas, tingkat **Besar**.
- Tiga angka lain jadi baris: label kiri, angka kanan, delta kecil di bawah angka.
- Semua 4 angka langsung kelihatan; tidak pakai carousel atau swipe.
- Tinggi panel di HP kira-kira setengah dari 4 card sekarang, supaya proyeksi gajian cepat terlihat.

---

## Warna

Putih bersih + hitam pekat, dengan **oranye bata** sebagai satu-satunya aksen. Alasan: indigo membuat tampilan baru
terasa sama dengan tampilan lama (dan indigo adalah warna default AI paling umum); oranye bata hangat, nyambung dengan
karakter "temen ngobrol", dan jarang dipakai app keuangan. Karakter tetap datang dari angka raksasa; warna ditahan.

Token tampilan baru di `client/src/index.css` (`:root[data-ui='new']`). Token tampilan lama (`:root`, `.dark`) tidak diubah.

| Token | Terang | Gelap | Pemakaian |
|---|---|---|---|
| `bg` / `surface` | `#FFFFFF` | `#0A0A0A` | Latar semua halaman. Tidak ada permukaan "card". |
| `surface-2` | `#F4F4F5` | `#1C1C1C` | Isian tombol sekunder, `Segmented`, ringkasan hitungan di form. |
| `border` | `#E5E5E5` | `#262626` | Garis tipis pemisah bagian dan baris. |
| `fg` | `#0A0A0A` | `#F5F5F5` | Teks utama dan semua angka netral. |
| `muted` | `#616161` | `#A3A3A3` | Label dan teks sekunder. |
| `accent` | `#C2410C` | `#F97316` | Oranye bata. Lihat aturan aksen. |
| `positive` | `#157337` | `#4ADE80` | Masuk/untung/aman. |
| `negative` | `#BE123C` | `#FB7185` | Keluar/rugi/kurang. Merah kemerahmudaan supaya tidak tertukar dengan oranye aksen. |
| `warning` | `#8A5806` | `#FACC15` | Perlu perhatian. |

Semua teks di atas `bg`, `surface-2`, dan badge ber-tint 10% lolos WCAG AA 4.5:1 (dihitung dari nilai token).
Warna status bar PWA mengikuti `bg` yang aktif (`lib/themeColor.js`).

Aksen oranye **hanya** di:
1. **Tambah Transaksi** (sidebar, bottom nav, dan tombol di empty state Dashboard/Transaksi): aksi inti app, satu-satunya
   tombol oranye.
2. Item navigasi aktif (ikon menu aktif di sidebar, label menu aktif di bottom nav).
3. Focus ring.
4. Penanda jumlah filter aktif di Transaksi (menandai state nyata).

Hirarki tombol: `accent` (oranye) = Tambah Transaksi; `primary` (hitam/putih sesuai tema) = aksi utama halaman dan
tombol submit form (Tambah Rekening, Catat Periode, Simpan); `secondary` (isian abu) = aksi pendukung dan aksi per baris.

Aksen **tidak** dipakai di: angka, ikon (kecuali ikon menu aktif), garis, latar blok, label section, link "Lihat semua"
(pakai `fg` + chevron).

Warna kategori dan rekening (chip ikon kategori/rekening) tetap boleh karena itu data milik user, bukan palet UI.

**Logo & ikon aplikasi (permintaan owner):** bentuk dompet yang sama, warna mengikuti tampilan.

| Aset | Tampilan baru | Tampilan lama |
|---|---|---|
| Logo / favicon | `public/wallet-new.svg` (dompet oranye bata `#C2410C` di kotak putih) | `public/wallet.svg` (indigo) |
| Ikon PWA | `icon-192-new.png`, `icon-512-new.png` (dompet putih di latar oranye bata) | `icon-192.png`, `icon-512.png` |
| Ikon iOS | `apple-touch-icon-new.png` | `apple-touch-icon.png` |
| Manifest | `manifest-new.webmanifest` (`theme_color` oranye bata) | `manifest.webmanifest` |

`index.html` memuat aset tampilan baru; `lib/brandAssets.js` menukar favicon, ikon iOS, dan manifest ke versi lama saat
perangkat memilih tampilan lama. Ikon yang sudah ter-install di layar utama HP tidak berubah sampai app di-install ulang.

---

## Tipografi

Kandidat dari owner: Host Grotesk, Space Grotesk, Instrument Sans. Dicek dari file font Google Fonts
(render digit tebal + fitur OpenType):

| Font | Angka tabular | Berat | Ukuran maks agar `1.250.000.000.000` muat 288px |
|---|---|---|---|
| Host Grotesk | Bawaan (tanpa `tnum`) | 300-800 | ~31px |
| Space Grotesk | Via `tnum` | 300-700 | ~31px |
| Instrument Sans | Via `tnum` | 400-700, plus sumbu lebar `wdth` 75-100 | ~32px normal, **~39px di `wdth` 75** |

- **Instrument Sans** dipakai untuk tampilan baru. Alasan: sumbu lebar (`wdth`) membuat angka bisa
  dipadatkan di layar sempit, sehingga angka raksasa di HP ~25% lebih besar dari dua kandidat lain di lebar yang sama.
  Ini langsung melayani motif angka raksasa.
- Gestur khas: angka raksasa dan besar memakai `wdth` 75 (padat) di HP dan melebar ke `wdth` 100 di layar lebar.
  Teks biasa selalu `wdth` 100.
- Instrument Sans juga jadi **font default semua teks** tampilan baru (label, daftar, form, tombol),
  menggantikan Inter, supaya angka dan teks satu suara. Inter tetap dipakai tampilan lama.
- Selalu set `font-variant-numeric: tabular-nums` (`.tnum`) karena angka tabular Instrument Sans tidak aktif bawaan.
- Load dari Google Fonts dengan rentang sumbu: `Instrument+Sans:wdth,wght@75..100,400..700`.
- Meta teks minimal 12px di HP.
- Label pakai sentence case biasa, tidak pakai `uppercase tracking-wide`.

---

## Bentuk & kedalaman

- **Tanpa card pembungkus.** Komponen `Card` di tampilan baru adalah `<section>` tanpa kotak, diawali **garis bagian**
  (`border-t border-rule`: hitam di tema terang, abu `#525252` di tema gelap supaya tidak menyilaukan). Baris di dalam
  bagian dipisah **garis abu** (`divide-border`). Dua tingkat garis ini adalah hirarki struktur: garis bagian memulai
  bagian baru, garis abu memisahkan isi.
- Toolbar (pencarian/filter Transaksi, pemilih bulan Laporan) tidak diberi garis bagian supaya tidak ada dua garis bagian
  berdempetan.
- **Jarak (satu sistem untuk semua halaman):**
  - Judul halaman -> isi pertama: 24px.
  - Isi -> garis bagian berikutnya: 24px (`space-y-6` / `gap-y-6` di level halaman). Sama dengan jarak judul -> isi
    supaya seimbang.
  - Garis bagian -> isi bagian: 20px (`pt-5` di `Card`). Garis sedikit lebih dekat ke bagian yang dimulainya.
  - Baris terakhir dalam daftar tidak membawa padding bawah (`[&>*:last-child]:pb-0` / `last:pb-0`), supaya jarak ke
    garis berikutnya tetap 24px.
- Grid yang dulu berisi card menjadi blok-blok tanpa kotak, masing-masing diawali garis bagian.
- Isian tipis `bg-surface-2` hanya untuk: tombol sekunder, `Segmented`, badge status, progress bar, dan ringkasan hitungan
  di dalam form/modal. Tidak ada border di sekelilingnya.
- Radius: `rounded-md` untuk tombol, input, isian; `rounded-t-2xl` untuk sheet; `rounded-full` hanya untuk dot, toggle,
  dan tombol tambah melayang di HP.
- Input: isian abu `surface-2` + garis tipis `border` saat diam, garis hitam saat fokus (`fieldClass` di
  `components/ui/index.jsx`, dipakai juga oleh input mentah). Garis gelap permanen terlalu kontras tanpa kotak di sekitarnya.
- Shadow: hanya sheet, modal, tombol tambah melayang di HP, panel mengambang dan tooltip di atas Peta Transaksi
  (elevasi di atas peta). Blur: hanya backdrop modal/sheet.
  Gradien: tidak ada.

## Navigasi (shell)

Menu, urutan menu, dan isinya tetap. Gayanya:

- **Judul halaman** `text-2xl` tebal, ikut ter-scroll (tidak sticky). Sengaja lebih kecil dari angka raksasa: judul memberi
  konteks, angka raksasa jadi fokus. Di kanan judul hanya tombol sembunyikan saldo; tema diatur di Pengaturan.
- **Sidebar (desktop) gelap** (`rail`, hitam di tema terang, abu arang di tema gelap): identitas shell dan pemisah tegas
  antara navigasi dan konten putih. Isi: logo + "Orkay" besar, tombol **Tambah Transaksi** oranye, menu dalam dua kelompok
  (harian: Dashboard, Transaksi, Rekening, Investasi; perencanaan: Tagihan Rutin, Anggaran, Laporan, Peta Transaksi,
  Pengaturan; urutan tetap, Peta Transaksi ditambahkan owner), menu aktif berlatar abu gelap dengan ikon oranye, lalu
  Kunci Aplikasi.
- **Bottom nav (HP)**: latar solid, garis tipis di atas, dan **tombol tambah bulat oranye yang melayang** di tengah
  (keputusan owner: tombol melayang adalah penegasan keras bahwa mencatat transaksi adalah aksi inti).
- **Menu Lainnya** berupa daftar baris, bukan grid tile.
- Tidak ada tombol ganda untuk aksi yang sama di satu layar: Tambah Transaksi hanya di shell (dan empty state),
  sembunyikan saldo hanya di kanan judul.

## Ikon

- Lucide tetap dipakai, hanya kalau menjelaskan sesuatu: arah uang (masuk/keluar/transfer),
  jenis rekening, ikon kategori pilihan user.
- Ikon penanda yang sudah dikenal user (dompet di Total Saldo, panah masuk/keluar) dipertahankan, ukurannya kecil di samping label.
- `Sparkles` di "Selisih (Net)" diganti ikon yang bermakna; bintang, petir, dan sejenisnya tidak dipakai.

## Suara & copy

Sumber suara: GAYA BALASAN di `brain/src/prompt.js`.

- Bahasa Indonesia santai, sapaan "kamu", sama seperti chat WA dan copy yang sudah ada.
- Teks yang sudah ada **tidak diubah**. Aturan suara ini untuk copy baru: empty state, error, konfirmasi,
  teks bantuan, pesan transisi tampilan.
- Copy baru singkat dan langsung ke angka. Empty state menyebut penyebab + satu aksi.
- **Tidak ada emoji di UI** (emoji tetap boleh di WA). "Hari ini! 🎉" jadi "Hari ini!".
- Tidak pakai tanda pisah panjang di teks UI.

---

## Responsif

HP untuk mencatat cepat dan cek "aman sampai gajian", laptop untuk laporan dan analisa.
Urutan bagian di semua lebar sama dengan urutan sekarang; yang berubah hanya jumlah kolom dan ukuran.

| Lebar | Layout Dashboard |
|---|---|
| < 640px | Satu kolom, bottom nav dengan tombol tambah transaksi di tengah. Panel ringkasan dengan baris bertumpuk. Angka raksasa memenuhi lebar. |
| 640-1023px | Panel ringkasan; grafik kategori + tren harian dua kolom mulai 768px; tetap bottom nav. |
| >= 1024px | Sidebar; panel ringkasan dengan 4 angka sejajar dalam satu permukaan; gajian + proyeksi di kiri, tagihan di kanan; grafik dua kolom. |

Breakpoint mengikuti titik konten pecah, bukan daftar device; geser kalau saat dites kontennya pecah di lebar lain.

Aturan (berlaku untuk tampilan baru):
- Target sentuh minimal 44x44px di layar sentuh, dengan jarak antar target.
- Padding bawah konten = tinggi bottom nav + `env(safe-area-inset-bottom)`, supaya baris terakhir tidak ketutup.
- Tidak ada scroll horizontal; elemen kelebaran dibenerin (wrap, scroll container tabel),
  bukan disembunyikan dengan `overflow-x-hidden`.
- Semua interaksi hover punya padanan tap.

## Tema

- Default **ikut sistem**, dengan pilihan tiga posisi: Sistem / Terang / Gelap.
- `ThemeContext.jsx` sekarang menyimpan pilihan pertama ke storage, jadi setelah sekali buka tidak lagi
  ikut perubahan sistem. Perlu mode "sistem" yang mendengarkan `prefers-color-scheme`.
- Kedua tema wajib lolos kontras WCAG AA di kedua tampilan.
- `theme-color` di `client/index.html` sudah mengikuti skema sistem; pertahankan.

---

## Transisi: tampilan lama dan tampilan baru

### Untuk user

- Dua pilihan di Settings: **Tampilan baru** dan **Tampilan lama**.
- Default untuk semua user: **Tampilan baru**. User bisa balik ke tampilan lama kapan saja.
- Pilihan disimpan **per perangkat** (localStorage, sama seperti tema). HP dan laptop bisa beda.
- Pertama kali tampilan baru terbuka di sebuah perangkat: satu pesan kecil yang bisa ditutup,
  memberi tahu bahwa tampilan lama masih ada di Settings. Muncul sekali per perangkat.
- Saat tanggal penghapusan sudah ditentukan: pesan di tampilan lama yang menyebut tanggalnya.
  Tanggal belum ditentukan.

### Aturan tampilan lama

- **Dibekukan**: tampilan, ukuran, dan komponen tampilan lama tidak diubah.
- Pengecualian: (a) pilihan pindah tampilan ditambahkan di Settings tampilan lama,
  (b) perbaikan bug data/kalkulasi yang ada di lapisan bersama otomatis ikut.
- Fitur baru selama masa transisi hanya dibuat di tampilan baru.

### Aturan kode (supaya penghapusan nanti bersih)

- **Lapisan bersama** dipakai dua tampilan: `context/`, `lib/` (termasuk `api.js`, `selectors.js`), server.
- **Lapisan tampilan** terpisah: tampilan lama ada utuh di `client/src/legacy/` (`LegacyApp.jsx`, `pages/`,
  `components/` termasuk salinan `components/ui`), supaya perubahan komponen tampilan baru tidak bocor ke tampilan lama.
  `AuthGate.jsx` memuatnya secara lazy, jadi perangkat yang memakai tampilan baru tidak mengunduhnya.
- Pilihan tampilan: `context/UiVersionContext.jsx`, kunci localStorage `orkay:ui` (`new` | `legacy`), dipasang ke
  `<html data-ui>`. Font dipilih lewat `--font-sans` di `index.css` (`:root` = Inter, `[data-ui='new']` = Instrument Sans).
- Pesan sekali-tampil: `components/layout/NewUiNotice.jsx`, kunci `orkay:uiNoticeSeen`.
- Varian Tailwind `touch:` (`@media (pointer: coarse)`) untuk target sentuh 44px; komponen angka raksasa di
  `components/ui/Money.jsx` + kelas `.money-fit`/`.money` di `index.css`.
- Menghapus tampilan lama nanti: hapus `client/src/legacy/`, `UiVersionContext.jsx` (dan provider-nya di `main.jsx`),
  cabang `legacy` di `AuthGate.jsx` dan `context/ConfirmContext.jsx`, pilihan "Versi tampilan" di Settings,
  aturan `:root { --font-sans: 'Inter' }` + token lama di `index.css` (lalu pindahkan token `[data-ui='new']` ke `:root`/`.dark`),
  font Inter di `index.html`, serta kunci `orkay:ui`. User yang masih memilih tampilan lama otomatis pindah ke tampilan baru.
  Aset logo lama (`wallet.svg`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `manifest.webmanifest`) dan
  `lib/brandAssets.js` ikut dihapus; aset `-new` boleh diganti nama ke nama lama.

---

## Tidak dibawa ke tampilan baru

Diambil dari audit tampilan lama (tampilan lama sendiri tidak diubah):

- `Sparkles` di "Selisih (Net)", diganti ikon bermakna.
- Emoji 🎉 di kartu gajian.
- Gradien aksen di kartu ringkasan Dashboard, Rekening, Investasi.
- Kotak ikon `bg-accent/10 text-accent` di baris transfer, tagihan kartu kredit, cicilan (ikonnya tetap, warnanya netral).
- Gaya `uppercase tracking-wide` (kata-katanya tetap, jadi huruf biasa).
- 4 kartu angka terpisah di Dashboard, diganti panel ringkasan.
- `truncate` pada nilai uang.
