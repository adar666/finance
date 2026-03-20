'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'

type Theme = 'dark' | 'light' | 'system'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'dark' | 'light'
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
  resolvedTheme: 'dark',
})

function getSystemTheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({
  children,
  defaultTheme = 'dark',
  storageKey = 'theme',
}: {
  children: ReactNode
  defaultTheme?: Theme
  storageKey?: string
}) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme)
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark')

  const applyTheme = useCallback((t: Theme) => {
    const root = document.documentElement
    const resolved = t === 'system' ? getSystemTheme() : t
    root.classList.remove('light', 'dark')
    root.classList.add(resolved)
    setResolvedTheme(resolved)
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem(storageKey) as Theme | null
    if (stored) {
      setThemeState(stored)
      applyTheme(stored)
    } else {
      applyTheme(defaultTheme)
    }
  }, [storageKey, defaultTheme, applyTheme])

  useEffect(() => {
    applyTheme(theme)
  }, [theme, applyTheme])

  useEffect(() => {
    if (theme !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => applyTheme('system')
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [theme, applyTheme])

  function setTheme(t: Theme) {
    localStorage.setItem(storageKey, t)
    setThemeState(t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
