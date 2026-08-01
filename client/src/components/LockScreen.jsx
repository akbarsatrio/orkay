import { useState, useRef, useEffect } from 'react'
import { Wallet, Lock, Loader2 } from 'lucide-react'
import { Button } from './ui/index.jsx'
import { login } from '../lib/api.js'

export default function LockScreen({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const submit = async (e) => {
    e?.preventDefault()
    if (!pin || busy) return
    setBusy(true)
    setErr(null)
    try {
      await login(pin)
      onUnlock()
    } catch (e2) {
      setErr(e2.message || 'PIN salah')
      setPin('')
      inputRef.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-accent flex items-center justify-center mb-3">
            <Wallet size={24} className="text-accent-fg" />
          </div>
          <h1 className="text-lg font-bold text-fg">Orkay</h1>
          <p className="text-xs text-muted mt-1">Masukkan PIN untuk mengakses datamu</p>
        </div>

        <form onSubmit={submit} className="bg-surface border border-border rounded-card shadow-card p-6 space-y-4">
          <div>
            <span className="block text-xs font-medium text-muted mb-1.5">PIN</span>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••••"
                className="w-full h-11 pl-9 pr-3 rounded-lg bg-surface border border-border text-base text-fg tracking-widest tnum placeholder:text-muted/50 placeholder:tracking-normal focus:border-accent outline-none"
              />
            </div>
            {err && <p className="text-xs text-negative mt-2">{err}</p>}
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={!pin || busy}>
            {busy ? <><Loader2 size={16} className="animate-spin" /> Memeriksa…</> : 'Masuk'}
          </Button>
        </form>

        <p className="text-2xs text-muted text-center mt-4 leading-relaxed">
          Data keuangan tersimpan di server pribadimu.<br />Jangan bagikan PIN ke siapa pun.
        </p>
      </div>
    </div>
  )
}
