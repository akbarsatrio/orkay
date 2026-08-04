// Test unit auth: token HMAC, TTL/expiry, checkPin. Pakai node:test built-in.
// Jalankan: node --test server/test/
//
// config.js membaca env saat modul di-load, jadi set env SEBELUM import.
import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'development'
process.env.APP_PIN = '424242'
process.env.AUTH_SECRET = 'test-secret-untuk-unit-test-jangan-dipakai-produksi'
process.env.AUTH_TOKEN_TTL_MS = '1000' // TTL pendek 1 detik untuk uji expiry

const { createToken } = await import('../auth.js')
const authMod = await import('../auth.js')

// requireAuth dipakai lewat middleware; kita uji verify tak langsung via requireAuth mock.
function fakeReqRes(token) {
  const req = { headers: token ? { authorization: `Bearer ${token}` } : {} }
  let statusCode = 200
  let jsonBody = null
  const res = {
    status(c) { statusCode = c; return this },
    json(b) { jsonBody = b; return this },
  }
  let nextCalled = false
  authMod.requireAuth(req, res, () => { nextCalled = true })
  return { statusCode, jsonBody, nextCalled }
}

test('token valid diterima requireAuth', () => {
  const token = createToken()
  const r = fakeReqRes(token)
  assert.equal(r.nextCalled, true)
  assert.equal(r.statusCode, 200)
})

test('tanpa token → 401', () => {
  const r = fakeReqRes(null)
  assert.equal(r.nextCalled, false)
  assert.equal(r.statusCode, 401)
  assert.deepEqual(r.jsonBody, { error: 'unauthorized' })
})

test('token dirusak (tanda tangan salah) → 401', () => {
  const token = createToken()
  const tampered = token.slice(0, -3) + 'aaa'
  const r = fakeReqRes(tampered)
  assert.equal(r.nextCalled, false)
  assert.equal(r.statusCode, 401)
})

test('token kadaluarsa (lewat TTL) → 401', async () => {
  const token = createToken()
  await new Promise((r) => setTimeout(r, 1200)) // > TTL 1000ms
  const r = fakeReqRes(token)
  assert.equal(r.nextCalled, false, 'token kadaluarsa harus ditolak')
  assert.equal(r.statusCode, 401)
})

test('checkPin benar & salah (constant-time)', () => {
  assert.equal(authMod.checkPin('424242'), true)
  assert.equal(authMod.checkPin('000000'), false)
  assert.equal(authMod.checkPin(''), false)
  assert.equal(authMod.checkPin('4242420'), false) // panjang beda
})
