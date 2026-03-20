'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'finance-privacy-mode'

type PrivacyModeContextValue = {
  enabled: boolean
  setEnabled: (v: boolean) => void
  toggle: () => void
}

const PrivacyModeContext = React.createContext<PrivacyModeContextValue | null>(null)

export function PrivacyModeProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = React.useState(false)
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    try {
      setEnabledState(localStorage.getItem(STORAGE_KEY) === '1')
    } catch {
      /* ignore */
    }
    setHydrated(true)
  }, [])

  const setEnabled = React.useCallback((v: boolean) => {
    setEnabledState(v)
    try {
      localStorage.setItem(STORAGE_KEY, v ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  const toggle = React.useCallback(() => {
    setEnabledState((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const value = React.useMemo(
    () => ({ enabled: hydrated ? enabled : false, setEnabled, toggle }),
    [enabled, hydrated, setEnabled, toggle]
  )

  return (
    <PrivacyModeContext.Provider value={value}>{children}</PrivacyModeContext.Provider>
  )
}

export function usePrivacyMode() {
  const ctx = React.useContext(PrivacyModeContext)
  if (!ctx) {
    throw new Error('usePrivacyMode must be used within PrivacyModeProvider')
  }
  return ctx
}

/** Blur formatted money (or any sensitive numeric text) when privacy mode is on. */
export function PrivateMoney({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const { enabled } = usePrivacyMode()
  if (!enabled) return <>{children}</>
  return (
    <span
      className={cn(
        'inline-block select-none blur-[7px] sm:blur-[6px]',
        className
      )}
      title="Amount hidden"
      aria-hidden
    >
      {children}
    </span>
  )
}
