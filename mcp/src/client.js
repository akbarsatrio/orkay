// OrkayClient — wrapper HTTP ke API Orkay.
// - login() sekali pakai PIN -> token disimpan in-memory
// - semua request bawa Authorization: Bearer
// - kalau 401, re-login 1x lalu retry
// - bootstrap() di-cache singkat agar hemat call
import 'dotenv/config'

const API_URL = (process.env.ORKAY_API_URL || 'http://localhost:3001').replace(/\/$/, '')
const PIN = process.env.ORKAY_PIN || '123456'
const BOOTSTRAP_TTL_MS = Number(process.env.BOOTSTRAP_TTL_MS) || 30000

class OrkayClient {
  constructor() {
    this.token = null
    this._bootstrapCache = null
    this._bootstrapAt = 0
  }

  async login() {
    const res = await fetch(`${API_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: PIN }),
    })
    if (!res.ok) {
      const msg = await safeError(res)
      throw new Error(`Login Orkay gagal (${res.status}): ${msg}. Cek ORKAY_PIN & pastikan server jalan di ${API_URL}.`)
    }
    const data = await res.json()
    this.token = data.token
    return this.token
  }

  // Request generik dengan auto-login & retry 401 sekali.
  async request(method, path, body) {
    if (!this.token) await this.login()

    const doFetch = () =>
      fetch(`${API_URL}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })

    let res = await doFetch()
    if (res.status === 401) {
      // token kadaluarsa/invalid -> login ulang & coba lagi sekali
      await this.login()
      res = await doFetch()
    }

    if (!res.ok) {
      const msg = await safeError(res)
      throw new Error(msg || `Request ${method} ${path} gagal (${res.status})`)
    }
    // beberapa endpoint balikin {ok:true} — tetap parse JSON
    const text = await res.text()
    return text ? JSON.parse(text) : {}
  }

  get(path) { return this.request('GET', path) }
  post(path, body) { return this.request('POST', path, body) }
  put(path, body) { return this.request('PUT', path, body) }
  del(path) { return this.request('DELETE', path) }

  // Ambil snapshot lengkap data (dengan cache singkat).
  async bootstrap(force = false) {
    const fresh = Date.now() - this._bootstrapAt < BOOTSTRAP_TTL_MS
    if (!force && this._bootstrapCache && fresh) {
      return this._bootstrapCache
    }
    const data = await this.get('/api/bootstrap')
    this._bootstrapCache = data
    this._bootstrapAt = Date.now()
    return data
  }

  // Paksa refresh cache setelah operasi tulis, agar kalkulasi berikutnya akurat.
  invalidate() {
    this._bootstrapCache = null
    this._bootstrapAt = 0
  }
}

async function safeError(res) {
  try {
    const data = await res.json()
    return data.error || JSON.stringify(data)
  } catch {
    return res.statusText
  }
}

// Singleton — satu koneksi per proses MCP.
export const client = new OrkayClient()
export { API_URL }
