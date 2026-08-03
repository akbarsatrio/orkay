import { createContext, useContext, useEffect, useState } from 'react'
import { load, save } from '../lib/storage.js'

const BalanceVisibilityContext = createContext(null)

export function BalanceVisibilityProvider({ children }) {
  const [hidden, setHidden] = useState(() => load('balanceHidden', false))

  useEffect(() => {
    save('balanceHidden', hidden)
  }, [hidden])

  const toggle = () => setHidden((h) => !h)

  return (
    <BalanceVisibilityContext.Provider value={{ hidden, setHidden, toggle }}>
      {children}
    </BalanceVisibilityContext.Provider>
  )
}

export function useBalanceVisibility() {
  const ctx = useContext(BalanceVisibilityContext)
  if (!ctx) throw new Error('useBalanceVisibility must be used within BalanceVisibilityProvider')
  return ctx
}
