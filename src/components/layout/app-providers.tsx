'use client'

import { PrivacyModeProvider } from '@/components/layout/privacy-mode'

export function AppProviders({ children }: { children: React.ReactNode }) {
  return <PrivacyModeProvider>{children}</PrivacyModeProvider>
}
