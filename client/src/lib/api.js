const BASE = '/api'
const TOKEN_KEY = 'orkay:token'

// ---- Token management ----
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // noop
  }
}
export function clearToken() {
  setToken(null)
}

// Callback yang dipanggil saat server balas 401 (sesi habis / token invalid)
let onUnauthorized = null
export function setOnUnauthorized(fn) {
  onUnauthorized = fn
}

async function request(method, path, body) {
  const token = getToken()
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401) {
    clearToken()
    if (onUnauthorized) onUnauthorized()
    throw new Error('Sesi berakhir. Silakan masuk lagi.')
  }

  if (!res.ok) {
    let msg = `HTTP ${res.status}`
    try {
      const err = await res.json()
      if (err && err.error) msg = err.error
    } catch {
      // abaikan
    }
    throw new Error(msg)
  }

  if (res.status === 204) return null
  const ct = res.headers.get('content-type') || ''
  return ct.includes('application/json') ? res.json() : null
}

// ---- Auth calls (tidak butuh token) ----
export async function login(pin) {
  const res = await fetch(BASE + '/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  })
  if (!res.ok) {
    let msg = 'PIN salah'
    try {
      const err = await res.json()
      if (err && err.error) msg = err.error
    } catch {
      // noop
    }
    throw new Error(msg)
  }
  const data = await res.json()
  setToken(data.token)
  return data.token
}

// Cek token yang tersimpan masih valid
export async function checkSession() {
  const token = getToken()
  if (!token) return false
  try {
    const res = await fetch(BASE + '/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) return true
    clearToken()
    return false
  } catch {
    // server tak terjangkau — anggap sesi masih ada, biarkan bootstrap yang menangani
    return true
  }
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  del: (path) => request('DELETE', path),
}

export default api
