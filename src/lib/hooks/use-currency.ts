'use client'

import { useProfile } from './use-profile'

export function useCurrency(): string {
  const { data: profile } = useProfile()
  return profile?.currency ?? 'ILS'
}
