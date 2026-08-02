# Orkay MCP Server

MCP (Model Context Protocol) server untuk **Orkay** — jembatan antara AI dan API
keuangan pribadi. Dipakai agar AI (mis. lewat WhatsApp / Claude Desktop) bisa
mencatat transaksi, cek saldo, lihat tagihan, dan laporan lewat bahasa natural.

Server ini **standalone** dan mengonsumsi HTTP API Orkay yang sudah ada
(`server/` di root). Tidak mengubah backend maupun frontend.

```
AI / WhatsApp  →  MCP Client  →[stdio]→  Orkay MCP  →[HTTP+Bearer]→  Orkay API (:3001)  →  MySQL
```

## Setup

```bash
cd mcp
npm install
cp .env.example .env      # sesuaikan PIN & URL kalau perlu
```

`.env`:

| Variable | Default | Keterangan |
|---|---|---|
| `ORKAY_API_URL` | `http://localhost:3001` | URL server Express Orkay |
| `ORKAY_PIN` | `123456` | PIN login (sama dgn `APP_PIN` di `server/.env`) |
| `BOOTSTRAP_TTL_MS` | `30000` | Lama cache snapshot data (ms) |

> Prasyarat: server Orkay + MySQL harus **jalan** (`npm run dev` di root, atau server saja).

## Menjalankan

```bash
npm start           # jalankan MCP server (stdio)
npm run inspect     # buka MCP Inspector (UI test tool interaktif)
npm run test:tools  # smoke test read-only lawan API lokal
```

## Konfigurasi di klien MCP

**Claude Desktop / Claude Code** (`.mcp.json` atau config app):

```json
{
  "mcpServers": {
    "orkay": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/economic-analytic/mcp/src/index.js"],
      "env": {
        "ORKAY_API_URL": "http://localhost:3001",
        "ORKAY_PIN": "123456"
      }
    }
  }
}
```

Nanti di **Fase 2 (Brain service)**, server ini di-spawn otomatis oleh Brain sebagai
subprocess stdio — konfigurasi env diambil dari Brain.

## Tools (27)

### Transaksi
| Tool | Fungsi |
|---|---|
| `add_expense` | Catat pengeluaran (paham "25rb", "1,2jt"; nama akun & kategori difuzzy) |
| `add_income` | Catat pemasukan |
| `add_transfer` | Transfer antar rekening (+ fee opsional) |
| `list_recent_transactions` | Transaksi terbaru (filter rekening/kata kunci) — buat cari id sebelum edit/hapus |
| `update_transaction` | Koreksi transaksi by id (nominal/kategori/rekening/tanggal/catatan) |
| `delete_transaction` | Hapus transaksi by id |

### Saldo & kekayaan
| Tool | Fungsi |
|---|---|
| `get_balances` | Saldo semua rekening cash + sisa limit pay later |
| `get_networth` | Kekayaan bersih (cash − utang) |
| `get_account` | Detail satu rekening |

### Tagihan & cicilan
| Tool | Fungsi |
|---|---|
| `list_bills` | Tagihan pay later belum lunas (sudah closing) |
| `list_installments` | Cicilan aktif + termin berikutnya |
| `add_installment` | Buat cicilan baru (tenor + bunga Rp/%) |
| `pay_bill` | Bayar tagihan statement pay later |
| `pay_installment` | Bayar 1 termin cicilan |

### Tagihan rutin / langganan
| Tool | Fungsi |
|---|---|
| `list_recurring` | Daftar langganan + status bulan ini |
| `add_recurring` | Buat tagihan rutin (nama, nominal, tgl jatuh tempo) |
| `confirm_recurring` | Konfirmasi/bayar langganan bulan ini |
| `update_recurring` | Ubah nominal/tanggal/aktif |
| `delete_recurring` | Hapus langganan |

### Laporan & budget
| Tool | Fungsi |
|---|---|
| `spending_by_category` | Pengeluaran per kategori (per bulan) |
| `monthly_summary` | Pemasukan vs pengeluaran + top kategori |
| `budget_status` | Status budget tiap kategori |
| `set_budget` | Set/ubah budget kategori |
| `delete_budget` | Hapus budget kategori |

### Master data
| Tool | Fungsi |
|---|---|
| `list_categories` | Daftar kategori (filter expense/income) |
| `list_accounts` | Daftar rekening + jenis |
| `add_category` | Buat kategori baru |

## Catatan desain

- **Nama, bukan ID.** Semua tool menerima nama ("gopay", "makan") lalu di-resolve
  ke ID secara fuzzy (`src/resolve.js`). Kalau ambigu / tak ketemu, balikan pesan
  ramah berisi pilihan yang ada.
- **Money model dijaga persis** seperti web app: charge pay later dihitung saat
  belanja, pembayaran statement = transfer (tidak dobel), pembelian cicilan tidak
  masuk pengeluaran, bayar termin = pengeluaran dari cash.
- **Logika billing di-copy** dari `client/src/lib/` (`paylater.js`, `installments.js`)
  ke `src/` — karena MCP tak bisa meng-`import` file client. Kalau aturan billing di
  client berubah, **sinkronkan kedua file ini secara manual**.
- **Saldo & laporan dihitung di sisi MCP** dari `/api/bootstrap` (backend tidak diubah).
- Balasan tool sudah berformat teks Bahasa Indonesia + Rupiah, siap diteruskan ke chat.

## Struktur

```
src/
├── index.js          entry: McpServer + register tools + stdio
├── client.js         OrkayClient (login, token cache, retry 401, bootstrap cache)
├── resolve.js        fuzzy nama → ID
├── util.js           parseAmount ("25rb"/"1,2jt"), resolveDate, safeTool
├── format.js         Rupiah & tanggal (Bahasa Indonesia)
├── balances.js       kalkulasi saldo & kekayaan (port dari DataContext)
├── paylater.js       COPY billing cycle (A1)
├── installments.js   COPY jadwal cicilan (A1)
├── recurring.js      COPY logic recurring (A1)
└── tools/            transactions, accounts, bills, reports, master, recurring
test/
├── smoke.js          list + panggil tool read-only
├── write.js          test add_expense/add_transfer + error handling
└── batch2.js         test cicilan/recurring/budget tools
```

## Backlog (belum di-expose ke MCP)

Fungsi ini didukung backend tapi belum ada tool-nya — jarang dilakukan via chat,
biasanya diatur di web app. Tambahkan bila perlu:

- **Akun**: `add_account`, `update_account`, `delete_account` (`POST/PUT/DELETE /accounts`)
- **Income source**: `add/list/delete_income_source` (`/income-sources`)
- **Kategori**: `update_category`, `delete_category` (`PUT/DELETE /categories`)
- **Settings**: `get_settings`, `update_settings` — payDay/theme/currency (`/settings`)
- **Cicilan**: `update_installment`, `delete_installment` (`PUT/DELETE /installments/:id`)
