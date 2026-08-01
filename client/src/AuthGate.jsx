import { useEffect, useState, useCallback } from 'react'
import { Loader2, Wallet } from 'lucide-react'
import LockScreen from './components/LockScreen.jsx'
import { DataProvider } from './context/DataContext.jsx'
import App from './App.jsx'
import { checkSession, getToken, clearToken, setOnUnauthorized } from './lib/api.js'

export default function AuthGate() {
  const [state, setState] = useState('checking') // checking | locked | unlocked

  // Saat token ditolak server (401), kunci ulang app
  useEffect(() => {
    setOnUnauthorized(() => {
      clearToken()
      setState('locked')
    })
  }, [])

  useEffect(() => {
    let alive = true
    if (!getToken()) {
      setState('locked')
      return
    }
    checkSession().then((ok) => {
      if (!alive) return
      setState(ok ? 'unlocked' : 'locked')
    })
    return () => { alive = false }
  }, [])

  const handleUnlock = useCallback(() => setState('unlocked'), [])

  if (state === 'checking') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg gap-3">
        <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center">
          <Wallet size={20} className="text-accent-fg" />
        </div>
        <Loader2 size={18} className="animate-spin text-muted" />
      </div>
    )
  }

  if (state === 'locked') {
    return <LockScreen onUnlock={handleUnlock} />
  }

  return (
    <DataProvider>
      <App />
    </DataProvider>
  )
}
