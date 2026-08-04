# Orkay

**Orkay** adalah aplikasi *personal money tracker* (pelacak keuangan pribadi) yang bisa diakses
lewat **web app** maupun **WhatsApp** (via AI). Dibuat untuk kebutuhan sehari-hari: mencatat
pengeluaran/pemasukan, transfer antar rekening, kelola kartu kredit / pay later, cicilan,
tagihan rutin, budget, sampai laporan keuangan — semuanya dalam Bahasa Indonesia dan format Rupiah.

Data disimpan di satu database MySQL, jadi semua perangkat (HP & laptop) membaca/menulis data
yang sama dan langsung sinkron.

---

## ✨ Fitur

- **Dashboard** — ringkasan kekayaan bersih, saldo tiap rekening, tagihan mendatang.
- **Transaksi** — catat pengeluaran, pemasukan, dan transfer antar rekening (dengan biaya admin opsional).
- **Rekening** — rekening cash (bank, e-wallet, tunai) dan **pay later / kartu kredit** dengan
  limit & siklus tagihan.
- **Cicilan** — pembelian dicicil dengan tenor + bunga (nominal Rp atau persen flat). Dua **model billing**:
  - **Statement** — mengikuti siklus kartu kredit (closing day, due day, offset bulan).
  - **Anniversary** — jatuh tempo di tanggal yang sama dengan tanggal transaksi, tiap bulan berikutnya.
- **Pay Later** — perhitungan tagihan (statement) otomatis berdasarkan billing cycle + pembayaran tagihan.
- **Tagihan Rutin (Recurring)** — langganan bulanan (kos, internet, Netflix, dll) dengan konfirmasi per bulan.
- **Budget** — batas pengeluaran per kategori + status pemakaian.
- **Reports** — pengeluaran per kategori, ringkasan bulanan, tren.
- **Settings** — tanggal gajian (payDay), tema (dark/light), mata uang.
- **Keamanan** — login PIN + lock screen + rate-limit anti brute-force.

---

## 🤖 Integrasi AI + WhatsApp

Orkay bisa dikendalikan lewat **chat WhatsApp** pakai bahasa natural ("jajan 25rb pakai gopay",
"saldo gua berapa?", "tagihan bulan ini?"). Alurnya:

```
User WA ─► OpenWA (gateway) ─webhook─► Orchestrator ─► LLM (9Router) ─► MCP Orkay ─► Orkay API ─► MySQL
   ▲                                        │  (agent loop: LLM pilih tool, Orchestrator eksekusi)
   └────────────── balasan WhatsApp ────────┘
```

Tiga komponen tambahan (masing-masing punya README sendiri):

| Komponen | Folder | Fungsi |
|---|---|---|
| **MCP Orkay** | [`mcp/`](./mcp/README.md) | Server MCP dengan 27 tools (catat transaksi, cek saldo, tagihan, cicilan, recurring, budget, laporan) yang dikonsumsi AI. |
| **Orchestrator / Brain** | [`brain/`](./brain/README.md) | Jembatan: terima webhook WhatsApp → panggil LLM (via 9Router) → eksekusi tool MCP → balas WA. Punya memory percakapan per nomor. |
| **OpenWA** | eksternal | WhatsApp API gateway ([rmyndharis/OpenWA](https://github.com/rmyndharis/OpenWA)). Menerima pesan WA & mengirim balasan. |

> Untuk setup AI + WhatsApp, lihat [`mcp/README.md`](./mcp/README.md) dan [`brain/README.md`](./brain/README.md).
> Bagian ini **opsional** — web app berjalan penuh tanpa komponen AI.

---

## 🏗️ Arsitektur & Tech Stack

```
┌─────────────┐     ┌──────────────────────┐     ┌───────────┐
│   Browser   │ ──► │  Express (Node.js)    │ ──► │   MySQL   │
│  React SPA  │ ◄── │  - REST API (/api)    │ ◄── │           │
└─────────────┘     │  - serve React build  │     └───────────┘
                    │    (mode production)  │
                    └──────────────────────┘
     (opsional AI)          ▲
   WhatsApp ─► OpenWA ─► Orchestrator ─► MCP Orkay ──┘ (lewat REST API yang sama)
```

| Layer | Teknologi |
|---|---|
| **Client** | React 18, Vite 5, Tailwind CSS 3, React Router, Recharts, lucide-react |
| **Server** | Node.js, Express, MySQL (`mysql2/promise`) |
| **AI layer** | `@modelcontextprotocol/sdk` (MCP), `openai` SDK → 9Router (OpenAI-compatible) |
| **Auth** | PIN + token HMAC (sesi personal single-user) |

---

## 📁 Struktur Folder

```
economic-analytic/
├── client/          React + Vite (web app)
│   └── src/
│       ├── pages/           Dashboard, Transactions, Accounts, Recurring, Budgets, Reports, Settings
│       ├── components/      UI + form + modal
│       ├── context/         DataContext (state global)
│       └── lib/             format, paylater, installments, recurring (logic bisnis)
├── server/          Express + MySQL (backend + REST API)
│   ├── routes/              categories, accounts, transactions, recurring, budgets, installments, paylater, ...
│   ├── db.js                pool MySQL + init schema + migrasi
│   ├── schema.sql           DDL tabel
│   └── .env.example         template konfigurasi
├── mcp/             MCP server (27 tools) untuk AI  → lihat mcp/README.md
├── brain/           Orchestrator WhatsApp ↔ LLM ↔ MCP → lihat brain/README.md
├── ecosystem.config.cjs     konfigurasi PM2 (deploy)
└── package.json             script workspace (dev, build, deploy)
```

---

## ✅ Prasyarat

- **Node.js 18+**
- **MySQL 8+**

---

## 🖱️ Cara Termudah: Installer Wizard (GUI Browser)

Buat yang **tidak mau menyentuh terminal**, Orkay punya **wizard pemasangan visual**
yang berjalan di browser. Tinggal klik-klik.

**Prasyarat:** Node.js 18+ terpasang. (MySQL bisa disiapkan otomatis lewat Docker,
atau pakai MySQL yang sudah ada.)

### Cara menjalankan

- **Double-click launcher** sesuai sistem operasi:
  - macOS → `Pasang-Orkay.command`
  - Windows → `Pasang-Orkay.bat`
  - Linux → `pasang-orkay.sh`
- Atau lewat terminal: `npm install` lalu `npm run console`.

Browser akan terbuka otomatis ke wizard. Ikuti langkahnya:

1. **Cek Sistem** — wizard memeriksa Node, dependency, dan Docker (untuk DB otomatis).
2. **Pilih Mode** — *Aplikasi Web* saja, atau *Web + WhatsApp/AI*.
3. **Buat Akun** — tentukan nama aplikasi (untuk multi-instance) & PIN.
4. **Database** — pilih salah satu:
   - **MySQL sudah ada** — isi akses admin MySQL, wizard membuat database otomatis.
   - **Otomatis (Docker)** — wizard menyiapkan MySQL sendiri lewat Docker (tanpa install MySQL manual).
5. **Pasang** — wizard install dependency + setup DB (progress real-time).
6. **Selesai** — klik **Buka Aplikasi**.

### Kelola & multi-instance lewat GUI

Tab **"Kelola Aplikasi"** di wizard menampilkan semua instance terpasang. Dari sana bisa:
**Jalankan / Stop / Buka** tiap aplikasi, **Pasang Baru** (multi-instance, port otomatis
anti-bentrok), **Export** config deploy (PM2 + Nginx) untuk produksi, dan **Hapus**.

**Hapus aplikasi:** klik tombol **Hapus** → muncul konfirmasi. Secara default hanya
menghapus konfigurasi (proses dihentikan, **database tetap aman**). Centang *"Hapus juga
database & datanya"* untuk menghapus data permanen (untuk MySQL biasa perlu akses admin;
untuk Docker container + volume ikut terhapus). Wajib **ketik ulang nama aplikasi** agar
tidak terhapus tak sengaja.

> Wizard ini hanya UI di atas installer CLI di bawah — hasilnya identik. Pilih mana saja
> yang kamu suka.

---

## ⚡ Cara Cepat (CLI): Installer Otomatis (`npm run dev`)

Kalau tidak mau setup manual, pakai **bootstrap installer**. Sekali jalan langsung
menyiapkan database, generate config, dan menjalankan semua service.

**Prasyarat:** Node.js 18+ & MySQL 8+ sudah terpasang dan MySQL sedang berjalan.

```bash
git clone <URL_REPO_KAMU> orkay
cd orkay
npm install               # dependency root (buat script installer)
npm run dev               # bootstrap instance "default" lalu jalankan
```

Saat pertama kali, `npm run dev` otomatis menjalankan bootstrap interaktif:

1. Tanya **nama instance**, **mode** (web-only / full+AI), **PIN**.
2. **Install** dependency (root + server + client [+ mcp + brain kalau full]).
3. **Buat database + user MySQL otomatis** (minta kredensial admin MySQL sekali — *tidak disimpan*).
4. Simpan config ke `instances/<nama>.json`, lalu jalankan service.

Setelah itu, `npm run dev` berikutnya langsung jalan tanpa tanya-tanya lagi.

- **Web app:** `http://localhost:5173`
- **API:** `http://localhost:3001`
- **Brain (mode full):** `http://localhost:4000`

> **Mode:** pilih **web** (server + client) atau **full** (tambah MCP + Brain untuk
> AI/WhatsApp). Mode full butuh `LLM_API_KEY` (isi saat bootstrap atau edit
> `instances/<nama>.json`).

Jalankan **non-interaktif** (mis. untuk otomasi):

```bash
node scripts/bootstrap.mjs default --yes \
  --mode=web --pin=246810 \
  --db-admin-user=root --db-admin-pass=RAHASIA
```

---

## 🧩 Multi-Instance di Satu Server

Kamu bisa menjalankan **beberapa instance Orkay terpisah** di satu server — masing-masing
punya **database, PIN, dan port sendiri** (data terisolasi total). Cocok untuk beberapa
pengguna di satu VPS.

Tiap instance dapat **slot** unik yang menentukan port (otomatis, tanpa bentrok):

| Slot | server | web (vite) | brain |
|---|---|---|---|
| 0 (default) | 3001 | 5173 | 4000 |
| 1 | 3101 | 5273 | 4100 |
| 2 | 3201 | 5373 | 4200 |

```bash
# Buat instance baru (mis. untuk "budi") — slot & port dialokasikan otomatis
npm run instance:new budi -- --mode=full

# Lihat semua instance + port-nya
npm run instance:list

# Jalankan instance tertentu (dev)
npm run dev -- --instance=budi
# atau: npm run instance:start budi

# Detail satu instance
npm run instance -- info budi

# Hapus instance (default: config saja, database aman)
npm run instance -- delete budi
# Hapus sekalian database & datanya (permanen)
npm run instance -- delete budi --drop-data
# Tanpa konfirmasi interaktif (untuk otomasi)
npm run instance -- delete budi --yes
```

Config tiap instance tersimpan di `instances/<nama>.json` (berisi rahasia — sudah masuk
`.gitignore`). Satu checkout kode bisa menjalankan banyak instance sekaligus; env
di-inject saat runtime, jadi tidak saling menimpa.

### Deploy multi-instance ke VPS (PM2 + Nginx)

Generate config production per-instance:

```bash
# Satu instance dengan domain spesifik
npm run deploy:config -- budi --domain=budi.contoh.com

# Semua instance sekaligus (subdomain = nama instance)
npm run deploy:config -- --all --domain-suffix=contoh.com
```

Menghasilkan di `deploy/<nama>/`:

- `server.env` (+ `brain.env`, `mcp.env` kalau full) — env production
- `ecosystem.<nama>.cjs` — config PM2
- `nginx-<nama>.conf` — reverse proxy Nginx (per domain/subdomain)

Lalu di VPS:

```bash
npm run build                                   # build React (sekali, dipakai semua instance)
pm2 start deploy/budi/ecosystem.budi.cjs        # ulangi untuk tiap instance
pm2 save && pm2 startup

sudo cp deploy/budi/nginx-budi.conf /etc/nginx/sites-available/orkay-budi
sudo ln -s /etc/nginx/sites-available/orkay-budi /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d budi.contoh.com         # HTTPS
```

> Setiap instance tetap butuh **database MySQL sendiri**. Bootstrap (`npm run instance:new`)
> membuatnya otomatis; kalau setup manual, buat DB + user sesuai `instances/<nama>.json`.

---

## 🚀 Instalasi & Menjalankan (Development, Manual)

> Bagian ini opsional — cara manual kalau tidak memakai installer di atas.
> `npm run dev:legacy` menjalankan server + client langsung (tanpa sistem instance).

### 1. Ambil kode & install dependency

```bash
git clone <URL_REPO_KAMU> orkay
cd orkay

# install semua dependency (root + server + client)
npm run install:all
```

### 2. Siapkan database MySQL

Masuk ke MySQL (`mysql -u root -p` atau `sudo mysql`), lalu:

```sql
CREATE DATABASE economic_analytic CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'orkay'@'localhost' IDENTIFIED BY 'GANTI_PASSWORD_KUAT';
GRANT ALL PRIVILEGES ON economic_analytic.* TO 'orkay'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

> Aplikasi otomatis membuat semua tabel & menjalankan migrasi saat pertama kali start
> (tabel akan dibuat jika belum ada). Tidak perlu import schema manual.

### 3. Konfigurasi environment server

```bash
cd server
cp .env.example .env
# lalu edit .env (lihat tabel di bawah)
```

Isi minimal `server/.env`:

```env
NODE_ENV=development
PORT=3001
APP_PIN=123456                 # ganti dengan PIN rahasia kamu
AUTH_SECRET=<string-acak>       # generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
DB_HOST=localhost
DB_PORT=3306
DB_USER=orkay
DB_PASSWORD=GANTI_PASSWORD_KUAT
DB_NAME=economic_analytic
```

### 4. Jalankan

```bash
cd ..            # kembali ke root repo
npm run dev
```

- Server API: `http://localhost:3001`
- Web app (Vite dev): `http://localhost:5173` (Vite mem-proxy `/api` ke server)

Buka `http://localhost:5173` → muncul layar PIN → masukkan `APP_PIN`.

---

## ⚙️ Konfigurasi Environment (`server/.env`)

| Variable | Default | Keterangan |
|---|---|---|
| `PORT` | `3001` | Port Express |
| `NODE_ENV` | `production` | `development` (dev) / `production` (serve React build + SPA fallback) |
| `APP_PIN` | `123456` | **WAJIB ganti.** PIN untuk masuk aplikasi |
| `AUTH_SECRET` | — | String acak untuk menandatangani token sesi |
| `DB_HOST` | `localhost` | Host MySQL |
| `DB_PORT` | `3306` | Port MySQL |
| `DB_USER` | `root` | User MySQL |
| `DB_PASSWORD` | — | Password MySQL |
| `DB_NAME` | `economic_analytic` | Nama database |
| `CLIENT_DIST` | `../client/dist` | Folder hasil build React yang diserve saat production |

Generate `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 📦 Build Production

```bash
npm run deploy:build     # install semua dependency + build React ke client/dist
```

Saat `NODE_ENV=production`, Express **otomatis melayani** `client/dist` (SPA fallback), jadi
web app & API jalan dari satu proses di port `3001`.

Jalankan production secara lokal:

```bash
npm run start            # NODE_ENV=production, serve dari client/dist
```

---

## 🖥️ Deploy ke VPS (Native)

Panduan deploy langsung di VPS (Ubuntu/Debian) tanpa layanan pihak ketiga:
**Node + MySQL + Nginx + PM2 + HTTPS via Let's Encrypt**.

```
Browser ──HTTPS──► Nginx (:443) ──► Express (:3001) ──► MySQL (:3306)
                     │                    └─ REST API (/api)
                     └─ React build (static)
```

### 0. Install dependency di VPS

```bash
# Node (contoh via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20

# Nginx, git, MySQL, Certbot
sudo apt update
sudo apt install -y git nginx mysql-server certbot python3-certbot-nginx
sudo systemctl enable --now mysql
```

### 1. Setup database MySQL

```bash
sudo mysql
```

```sql
CREATE DATABASE economic_analytic CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'orkay'@'localhost' IDENTIFIED BY 'GANTI_PASSWORD_KUAT';
GRANT ALL PRIVILEGES ON economic_analytic.* TO 'orkay'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 2. Ambil kode & build

```bash
git clone <URL_REPO_KAMU> orkay
cd orkay
npm run deploy:build       # install + build React -> client/dist
```

### 3. Konfigurasi environment

```bash
cd server
cp .env.example .env
nano .env
```

Isi (mode production):

```env
NODE_ENV=production
PORT=3001
APP_PIN=<PIN_RAHASIA_KAMU>
AUTH_SECRET=<STRING_ACAK_PANJANG>
DB_HOST=localhost
DB_PORT=3306
DB_USER=orkay
DB_PASSWORD=GANTI_PASSWORD_KUAT
DB_NAME=economic_analytic
```

### 4. Jalankan backend dengan PM2

```bash
npm install -g pm2
cd ~/orkay
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup        # ikuti instruksi agar auto-start saat reboot
```

Cek:

```bash
curl http://localhost:3001/api/health   # -> {"ok":true}
pm2 logs orkay
```

> Express di mode production sudah melayani React build sendiri, jadi Nginx cukup jadi
> reverse proxy + TLS di depannya.

### 5. Nginx (reverse proxy)

Buat file `/etc/nginx/sites-available/orkay`:

```nginx
server {
    listen 80;
    server_name orkay.domainkamu.com;   # ganti dengan domain kamu

    client_max_body_size 5m;

    # Semua request diteruskan ke Express (yang juga serve React build)
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Aktifkan & reload:

```bash
sudo ln -s /etc/nginx/sites-available/orkay /etc/nginx/sites-enabled/orkay
sudo rm -f /etc/nginx/sites-enabled/default   # opsional
sudo nginx -t && sudo systemctl reload nginx
```

Cek: `curl http://localhost/api/health` → `{"ok":true}`.

> **Alternatif (serve static via Nginx):** kalau mau Nginx yang melayani file statis langsung
> (lebih ringan), salin build ke `/var/www/orkay` dan arahkan `root` ke sana, lalu proxy hanya
> `location /api/` ke Express. Untuk kesederhanaan, panduan di atas cukup menyerahkan semuanya
> ke Express.

### 6. HTTPS dengan Let's Encrypt (Certbot)

Pastikan domain sudah mengarah ke IP VPS (DNS A record). Lalu:

```bash
sudo certbot --nginx -d orkay.domainkamu.com
```

Certbot otomatis memasang sertifikat, mengonfigurasi Nginx untuk HTTPS (:443), dan menyiapkan
auto-renew. Cek renew:

```bash
sudo certbot renew --dry-run
```

Buka `https://orkay.domainkamu.com` → layar PIN → masuk.

---

## 🔄 Update Aplikasi (setelah ada perubahan kode)

```bash
cd ~/orkay
git pull
npm run deploy:build
pm2 restart orkay
```

> Migrasi schema database berjalan otomatis (idempotent) saat server restart.

---

## 💾 Backup Database (MySQL)

Backup manual:

```bash
mysqldump -u orkay -p economic_analytic > ~/backup-orkay-$(date +%F).sql
```

Restore:

```bash
mysql -u orkay -p economic_analytic < ~/backup-orkay-2026-08-01.sql
```

Backup harian otomatis (crontab `crontab -e`) — simpan kredensial di `~/.my.cnf` (chmod 600):

```cron
0 2 * * * mysqldump --defaults-extra-file=/root/.my.cnf economic_analytic > /root/backups/orkay-$(date +\%F).sql
```

Inspeksi data: **DBeaver** / **MySQL Workbench** (GUI) atau `mysql -u orkay -p economic_analytic`.

---

## 🔒 Catatan Keamanan

- **PIN** adalah proteksi ringan yang cukup untuk pemakaian pribadi. Ada **rate-limit**
  (maks 10 percobaan / 5 menit per IP) untuk mencegah brute-force.
- Jangan pakai `APP_PIN` default (`123456`). Server memberi peringatan di log jika masih default.
- Simpan `.env` dengan aman dan **jangan commit ke git** (sudah masuk `.gitignore`).
- Untuk integrasi WhatsApp, endpoint webhook dilindungi **HMAC signature** + **whitelist nomor**
  (lihat [`brain/README.md`](./brain/README.md)).

---

## 📜 Script yang Tersedia (root)

| Script | Fungsi |
|---|---|
| `npm run console` | **Buka console/panel kontrol Orkay di browser** (paling mudah) |
| `npm run dev` | Bootstrap (kalau perlu) + jalankan instance (default), hot reload |
| `npm run dev -- --instance=<nama>` | Jalankan instance tertentu |
| `npm run bootstrap` | Installer: setup instance (DB, config, dep) |
| `npm run instance:new <nama>` | Buat instance baru |
| `npm run instance:list` | Daftar semua instance + port |
| `npm run instance:start <nama>` | Jalankan instance tertentu |
| `npm run instance -- info <nama>` | Detail config satu instance |
| `npm run instance -- delete <nama> [--drop-data] [--yes]` | Hapus instance (config; opsional + database) |
| `npm run deploy:config -- <nama> --domain=...` | Generate config PM2 + Nginx per instance |
| `npm run dev:legacy` | Jalankan server + client langsung (tanpa sistem instance) |
| `npm run build` | Build React ke `client/dist` |
| `npm run start` | Jalankan server mode production (serve build) |
| `npm run install:all` | Install dependency root + server + client + mcp + brain |
| `npm run deploy:build` | Install semua + build (untuk deploy) |

---

## Lisensi

Proyek pribadi. Gunakan sesuai kebutuhan.
