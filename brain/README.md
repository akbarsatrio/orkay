# Orkay Brain

Orchestrator yang menghubungkan **WhatsApp (OpenWA)** ↔ **AI (9Router)** ↔ **MCP Orkay**.

```
OpenWA(:2785) ─webhook→ Brain(:4000) ─stdio→ MCP Orkay ─HTTP→ Orkay API(:3001) → MySQL
     ▲                    │ (agent loop via 9Router)
     └── send-text ───────┘
```

Alur 1 pesan: user kirim WA → OpenWA push webhook ke Brain → Brain verifikasi
(HMAC + whitelist) → agent loop ke LLM (LLM pilih tool MCP) → eksekusi tool →
balasan natural → kirim balik ke WA.

## Setup

```bash
cd brain
npm install
cp .env.example .env      # isi LLM_API_KEY (9Router) minimal
```

### Env penting

| Variable | Keterangan |
|---|---|
| `PORT` | Port Brain (default 4000) |
| `WA_WEBHOOK_SECRET` | HMAC secret webhook OpenWA. **Kosong = skip verifikasi** (test lokal) |
| `WA_ALLOWED_NUMBERS` | Whitelist nomor (comma-sep, `628xxx`). Kosong = izinkan semua |
| `OPENWA_API_URL` / `OPENWA_API_KEY` / `OPENWA_SESSION_ID` | Untuk kirim balasan. **`OPENWA_API_KEY` kosong = MODE STUB** (balasan di-log) |
| `LLM_BASE_URL` | `https://api.openai.com/v1` |
| `LLM_API_KEY` | API key 9Router |
| `LLM_MODEL` | Default `cc/claude-opus-4-8` (ganti model = ganti ini) |
| `MCP_ENTRY` | Path MCP Orkay (default `../mcp/src/index.js`) |
| `ORKAY_API_URL` / `ORKAY_PIN` | Diteruskan ke proses MCP |

## Menjalankan

```bash
npm start          # jalankan Brain (spawn MCP Orkay otomatis)
npm run dev        # dengan --watch (auto-reload)
```

Prasyarat: **server Orkay (:3001) + MySQL harus jalan** (`npm run dev` di root repo).
Untuk balasan WA beneran butuh OpenWA (Fase 3); tanpa itu Brain jalan di **mode stub**.

## Test tanpa OpenWA (mock webhook)

Di terminal 1 (Brain) — pastikan `OPENWA_API_KEY` kosong (stub) & `LLM_API_KEY` terisi:
```bash
npm start
```

Di terminal 2 (kirim pesan palsu):
```bash
node test/mock-webhook.js "jajan 25rb pakai gopay"
# atau tanpa argumen -> jalankan beberapa skenario default
npm run test:webhook
```

Balasan LLM akan muncul di console Brain sebagai `[WA STUB → …]`.
Follow-up (memory) otomatis nyambung karena histori disimpan per nomor.

## Struktur

```
src/
├── index.js       Express :4000: POST /webhook/wa + GET /health
├── verify.js      HMAC (X-OpenWA-Signature) + whitelist nomor
├── mcp-client.js  spawn MCP Orkay (stdio), listTools, callTool
├── llm.js         9Router (openai SDK) + agent loop tool-calling + schema bridge
├── memory.js      histori chat in-memory per nomor (TTL)
├── wa.js          kirim balasan OpenWA send-text (+ mode stub)
└── prompt.js      system prompt asisten keuangan (Bahasa Indonesia + tanggal)
test/
└── mock-webhook.js
```

## Catatan

- **MCP di-spawn sekali** saat start (persisten). Kalau mati, otomatis reconnect di panggilan berikutnya.
- **Schema bridge otomatis**: tool MCP → format tools OpenAI. Nambah tool di MCP langsung kebaca Brain.
- **2 lapis keamanan**: HMAC (pesan asli OpenWA) + whitelist nomor.
- **Memory ilang saat restart** — cukup untuk personal. Kirim "reset" untuk mulai percakapan baru.
- Balas cepat `{ok:true}` ke OpenWA lalu proses LLM async (hindari retry webhook).
