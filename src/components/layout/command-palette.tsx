'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  TrendingUp,
  PiggyBank,
  Target,
  Calculator,
  Settings,
  BarChart3,
  PlusCircle,
} from 'lucide-react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'

export function CommandPalette() {
  const t = useTranslations()
  const [open, setOpen] = React.useState(false)
  const router = useRouter()

  const NAV = [
    { href: '/', label: t('nav.dashboard'), icon: LayoutDashboard },
    { href: '/accounts', label: t('nav.accounts'), icon: Wallet },
    { href: '/transactions', label: t('nav.transactions'), icon: ArrowLeftRight },
    { href: '/analytics', label: t('nav.analytics'), icon: BarChart3 },
    { href: '/budgets', label: t('nav.budgets'), icon: PiggyBank },
    { href: '/savings', label: t('nav.savings'), icon: Target },
    { href: '/investments', label: t('nav.investments'), icon: TrendingUp },
    { href: '/planning', label: t('nav.planning'), icon: Calculator },
    { href: '/settings', label: t('nav.settings'), icon: Settings },
  ]

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const run = React.useCallback(
    (fn: () => void) => {
      setOpen(false)
      fn()
    },
    []
  )

  return (
    <CommandDialog open={open} onOpenChange={setOpen} showCloseButton={false}>
      <Command>
        <CommandInput placeholder={t('commandPalette.placeholder')} />
        <CommandList>
          <CommandEmpty>{t('commandPalette.noResults')}</CommandEmpty>
          <CommandGroup heading={t('commandPalette.actionsHeading')}>
            <CommandItem
              onSelect={() =>
                run(() => router.push('/transactions?add=1'))
              }
            >
              <PlusCircle />
              {t('commandPalette.addTransaction')}
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading={t('commandPalette.navigationHeading')}>
            {NAV.map(({ href, label, icon: Icon }) => (
              <CommandItem
                key={href}
                onSelect={() => run(() => router.push(href))}
              >
                <Icon />
                {label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
