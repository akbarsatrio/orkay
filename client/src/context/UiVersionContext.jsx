import { createContext, useContext, useLayoutEffect, useState } from 'react'
import { load, save } from '../lib/storage.js'
import { syncThemeColor } from '../lib/themeColor.js'

// Pilihan tampilan per perangkat selama masa transisi: 'new' (default) atau 'legacy'.
// Saat tampilan lama dihapus: hapus provider ini, folder src/legacy/, dan kunci storage 'ui'.
const UiVersionContext = createContext(null)

export function UiVersionProvider({ children }) {
  const [ui, setUi] = useState(() => (load('ui', 'new') === 'legacy' ? 'legacy' : 'new'))

  useLayoutEffect(() => {
    document.documentElement.dataset.ui = ui
    save('ui', ui)
    syncThemeColor()
  }, [ui])

  return <UiVersionContext.Provider value={{ ui, setUi }}>{children}</UiVersionContext.Provider>
}

export function useUiVersion() {
  const ctx = useContext(UiVersionContext)
  if (!ctx) throw new Error('useUiVersion must be used within UiVersionProvider')
  return ctx
}
