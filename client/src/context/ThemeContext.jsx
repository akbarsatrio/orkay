import { createContext, useContext, useEffect, useState } from 'react'
import { load, save } from '../lib/storage.js'
import { syncThemeColor } from '../lib/themeColor.js'

const ThemeContext = createContext(null)

const media = () => window.matchMedia('(prefers-color-scheme: dark)')

// pref: 'system' | 'light' | 'dark'. Tidak ada nilai tersimpan = ikut sistem.
// theme: tema yang sedang aktif ('light' | 'dark').
export function ThemeProvider({ children }) {
  const [pref, setPrefState] = useState(() => load('theme', 'system'))
  const [systemDark, setSystemDark] = useState(() => media().matches)

  useEffect(() => {
    const mq = media()
    const onChange = (e) => setSystemDark(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const theme = pref === 'system' ? (systemDark ? 'dark' : 'light') : pref

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    syncThemeColor()
  }, [theme])

  const setPref = (next) => {
    setPrefState(next)
    save('theme', next)
  }
  const toggle = () => setPref(theme === 'dark' ? 'light' : 'dark')

  return (
    <ThemeContext.Provider value={{ theme, pref, setPref, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
