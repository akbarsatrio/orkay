# Panduan Deploy Orkay ke VPS

Arsitektur:

```
HP / Laptop
    │  (HTTPS)
    ▼
Cloudflare  ──►  Cloudflare Tunnel  ──►  Nginx (:80)  ──►  Express (:3001)  ──►  MySQL (:3306)
                                            │                    └─ API
                                            └─ React build (static)
```

- **HTTPS/TLS**: ditangani Cloudflare (gratis, otomatis). Tidak perlu certbot.
- **Cloudflare Tunnel**: expose VPS ke internet tanpa membuka port publik.
- **Auth**: PIN (di-set lewat `server/.env`).
- **Data**: satu database MySQL di VPS → semua device (HP & laptop) baca/tulis DB yang sama, langsung sinkron.

---

## 0. Prasyarat

- VPS (Ubuntu/Debian) dengan akses SSH.
- Domain yang sudah terdaftar di Cloudflare (buat Tunnel + DNS).
- Node.js 18+ di VPS.
- MySQL 8+ di VPS (atau server MySQL terpisah).

Install Node (contoh via nvm):

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
```

Install Nginx, git, dan MySQL:

```bash
sudo apt update && sudo apt install -y git nginx mysql-server
sudo systemctl enable --now mysql
```

> Tidak perlu build tools untuk compile native — driver MySQL (`mysql2`) pure JS.

### Siapkan database & user MySQL

```bash
sudo mysql
```

Di dalam prompt MySQL:

```sql
CREATE DATABASE economic_analytic CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'orkay'@'localhost' IDENTIFIED BY 'GANTI_PASSWORD_KUAT';
GRANT ALL PRIVILEGES ON economic_analytic.* TO 'orkay'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

> Aplikasi otomatis membuat semua tabel & mengisi data contoh saat pertama kali start
> (selama database masih kosong). Tidak perlu import schema manual.

---

## 1. Ambil kode & build

```bash
git clone <URL_REPO_KAMU> orkay   # atau upload manual
cd orkay

# install semua dependency (root + server + client) lalu build React
npm run deploy:build
```

Hasil build React ada di `client/dist`.

---

## 2. Konfigurasi environment

```bash
cd server
cp .env.example .env
nano .env
```

Isi minimal:

```env
NODE_ENV=production
PORT=3001
APP_PIN=<PIN_RAHASIA_KAMU>          # WAJIB ganti!
AUTH_SECRET=<STRING_ACAK_PANJANG>   # generate di bawah

# Koneksi MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=orkay
DB_PASSWORD=GANTI_PASSWORD_KUAT
DB_NAME=economic_analytic
```

Generate `AUTH_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 3. Jalankan backend dengan PM2 (auto-restart)

```bash
npm install -g pm2
cd ~/orkay
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup        # ikuti instruksi yang muncul agar jalan otomatis saat reboot
```

Cek jalan:

```bash
curl http://localhost:3001/api/health   # -> {"ok":true}
pm2 logs orkay
```

> Express saat `NODE_ENV=production` sudah bisa **serve React build sendiri**. Jadi
> kalau mau simpel, kamu bisa **lewati Nginx** dan langsung arahkan Cloudflare Tunnel
> ke `http://localhost:3001` (lihat catatan di `deploy/cloudflared-config.yml`).
> Panduan di bawah pakai Nginx sesuai preferensi.

---

## 4. Nginx (reverse proxy + static)

Salin build ke folder web & pasang config:

```bash
sudo mkdir -p /var/www/orkay
sudo cp -r ~/orkay/client/dist/* /var/www/orkay/

sudo cp ~/orkay/deploy/nginx.conf /etc/nginx/sites-available/orkay
sudo ln -s /etc/nginx/sites-available/orkay /etc/nginx/sites-enabled/orkay
sudo rm -f /etc/nginx/sites-enabled/default   # opsional

sudo nginx -t && sudo systemctl reload nginx
```

Cek:

```bash
curl http://localhost/api/health          # via Nginx -> Express
curl -I http://localhost/                 # index.html React
```

---

## 5. Cloudflare Tunnel

```bash
# install cloudflared (lihat dokumentasi Cloudflare untuk arsitektur VPS-mu)
cloudflared tunnel login
cloudflared tunnel create orkay
cloudflared tunnel route dns orkay orkay.domainkamu.com
```

Buat `~/.cloudflared/config.yml` (contoh ada di `deploy/cloudflared-config.yml`),
ganti `<TUNNEL_ID>` dan hostname, lalu:

```bash
cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

Buka `https://orkay.domainkamu.com` dari HP atau laptop → muncul **layar PIN**.
Masukkan `APP_PIN` → masuk. Data langsung sinkron antar device.

---

## 6. Update aplikasi (setelah ada perubahan kode)

```bash
cd ~/orkay
git pull
npm run deploy:build
sudo cp -r client/dist/* /var/www/orkay/
pm2 restart orkay
```

---

## 7. Backup database (MySQL)

Backup manual pakai `mysqldump`:

```bash
mysqldump -u orkay -p economic_analytic > ~/backup-orkay-$(date +%F).sql
```

Restore dari backup:

```bash
mysql -u orkay -p economic_analytic < ~/backup-orkay-2026-08-01.sql
```

Backup harian otomatis (crontab `crontab -e`) — simpan password di `~/.my.cnf` agar tidak
perlu diketik (chmod 600):

```cron
0 2 * * * mysqldump --defaults-extra-file=/root/.my.cnf economic_analytic > /root/backups/orkay-$(date +\%F).sql
```

Inspeksi data: **DBeaver** / **MySQL Workbench** (GUI) atau `mysql -u orkay -p economic_analytic`.

---

## Catatan keamanan

- **PIN itu proteksi ringan** yang cukup untuk pemakaian pribadi. Ada rate-limit
  (maks 10 percobaan / 5 menit per IP) untuk mencegah brute-force.
- Jangan pakai `APP_PIN` default. Server akan memberi peringatan di log kalau masih `123456`.
- Karena lewat Cloudflare, kamu bisa menambah lapisan **Cloudflare Access** (email OTP)
  di depan aplikasi untuk keamanan ekstra — opsional tapi direkomendasikan.
- Simpan `.env` aman; jangan commit ke git (sudah masuk `.gitignore`).
