import { useState, useRef, useEffect } from 'react'
import { Lock, Loader2 } from 'lucide-react'
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
        <div className="mb-8">
          <img src="/wallet-new.svg" alt="" className="h-10 w-10 mb-4" />
          <h1 className="text-4xl font-bold text-fg leading-none">Orkay</h1>
          <p className="text-sm text-muted mt-2">Masukkan PIN untuk mengakses datamu</p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label htmlFor="pin" className="block text-[13px] font-medium text-muted mb-1.5">PIN</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                id="pin"
                ref={inputRef}
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••••"
                className="w-full h-11 pl-9 pr-3 rounded-md bg-surface-2 border border-border hover:border-muted/50 focus:bg-bg focus:border-fg text-base text-fg tracking-widest tnum placeholder:text-muted placeholder:tracking-normal outline-none transition-colors"
              />
            </div>
            {err && <p className="text-xs text-negative mt-2">{err}</p>}
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={!pin || busy}>
            {busy ? <><Loader2 size={16} className="animate-spin" /> Memeriksa…</> : 'Masuk'}
          </Button>
        </form>

        <p className="text-xs text-muted mt-6 leading-relaxed">
          Data keuangan tersimpan di server pribadimu.<br />Jangan bagikan PIN ke siapa pun.
        </p>
      </div>
    </div>
  )
}
