'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  TrendingUp,
  PiggyBank,
  Target,
  Calculator,
  Settings,
  LogOut,
  Sun,
  Moon,
  ChevronLeft,
  Monitor,
  BarChart3,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useTheme } from '@/components/theme-provider'
import { cn } from '@/lib/utils'
import { usePrivacyMode } from '@/components/layout/privacy-mode'
import { LocaleToggle } from '@/components/layout/locale-toggle'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Separator } from '@/components/ui/separator'
import { useState, useEffect } from 'react'

const COLLAPSED_KEY = 'sidebar-collapsed'

export function AppSidebar() {
  const t = useTranslations()
  const pathname = usePathname()
  const router = useRouter()
  const { enabled: privacyOn, toggle: togglePrivacy } = usePrivacyMode()
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [collapsed, setCollapsed] = useState(false)
  const [userEmail, setUserEmail] = useState<string | null>(null)

  const navItems = [
    { href: '/', label: t('nav.dashboard'), icon: LayoutDashboard },
    { href: '/accounts', label: t('nav.accounts'), icon: Wallet },
    { href: '/transactions', label: t('nav.transactions'), icon: ArrowLeftRight },
    { href: '/analytics', label: t('nav.analytics'), icon: BarChart3 },
    { href: '/budgets', label: t('nav.budgets'), icon: PiggyBank },
    { href: '/savings', label: t('nav.savings'), icon: Target },
    { href: '/investments', label: t('nav.investments'), icon: TrendingUp },
    { href: '/planning', label: t('nav.planning'), icon: Calculator },
  ]

  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSED_KEY)
    if (stored === 'true') setCollapsed(true)
  }, [])

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
    })
  }, [])

  function toggleCollapsed() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem(COLLAPSED_KEY, String(next))
  }

  function cycleTheme() {
    const order: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system']
    const idx = order.indexOf(theme as 'light' | 'dark' | 'system')
    setTheme(order[(idx + 1) % order.length])
  }

  const themeIcon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Sun : Moon
  const themeLabel = theme === 'system' ? t('sidebar.systemTheme') : resolvedTheme === 'dark' ? t('sidebar.lightMode') : t('sidebar.darkMode')
  const ThemeIcon = themeIcon

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col h-screen sticky top-0 border-e border-border bg-card transition-[width] duration-200',
        collapsed ? 'w-[68px]' : 'w-[220px]'
      )}
    >
      <div className={cn('flex items-center gap-2 px-4 h-14 border-b border-border', collapsed && 'justify-center px-2')}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <TrendingUp className="h-4 w-4" />
        </div>
        {!collapsed && <span className="text-lg font-bold tracking-tight">{t('brand.finance')}</span>}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href))
          const linkClass = cn(
            'min-h-11 flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium transition-colors',
            isActive
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent',
            collapsed && 'justify-center px-2'
          )

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger
                  render={(props) => (
                    <Link href={item.href} {...props} className={cn(linkClass, props.className)}>
                      <item.icon className="h-5 w-5 shrink-0" />
                    </Link>
                  )}
                />
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            )
          }

          return (
            <Link key={item.href} href={item.href} className={linkClass}>
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {userEmail && !collapsed && (
        <div className="px-4 pb-2">
          <p className="text-sm text-muted-foreground truncate">{userEmail}</p>
        </div>
      )}

      <div className="px-2 pb-3 space-y-0.5">
        <Separator className="mb-2" />
        {collapsed ? (
          <>
            <Tooltip>
              <TooltipTrigger
                render={(props) => (
                  <Link
                    href="/settings"
                    {...props}
                    className={cn(
                      'min-h-11 flex items-center justify-center px-2 py-2 rounded-lg text-base font-medium transition-colors',
                      pathname === '/settings'
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                      props.className
                    )}
                  >
                    <Settings className="h-4 w-4" />
                  </Link>
                )}
              />
              <TooltipContent side="right">{t('nav.settings')}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={(props) => (
                  <button
                    type="button"
                    {...props}
                    onClick={(e) => {
                      props.onClick?.(e)
                      togglePrivacy()
                    }}
                    className={cn(
                      'min-h-11 flex items-center justify-center w-full px-2 py-2 rounded-lg text-base text-muted-foreground hover:text-foreground hover:bg-accent transition-colors',
                      privacyOn && 'text-primary',
                      props.className
                    )}
                  >
                    {privacyOn ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                )}
              />
              <TooltipContent side="right">
                {privacyOn ? t('sidebar.showAmounts') : t('sidebar.hideAmounts')}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={(props) => (
                  <button
                    type="button"
                    {...props}
                    onClick={(e) => {
                      props.onClick?.(e)
                      cycleTheme()
                    }}
                    className={cn(
                      'min-h-11 flex items-center justify-center w-full px-2 py-2 rounded-lg text-base text-muted-foreground hover:text-foreground hover:bg-accent transition-colors',
                      props.className
                    )}
                  >
                    <ThemeIcon className="h-4 w-4" />
                  </button>
                )}
              />
              <TooltipContent side="right">{themeLabel}</TooltipContent>
            </Tooltip>
            <LocaleToggle className="min-h-11 w-full px-2 py-2 rounded-lg text-base text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" />
            <Tooltip>
              <TooltipTrigger
                render={(props) => (
                  <button
                    type="button"
                    {...props}
                    onClick={(e) => {
                      props.onClick?.(e)
                      void handleSignOut()
                    }}
                    className={cn(
                      'min-h-11 flex items-center justify-center w-full px-2 py-2 rounded-lg text-base text-muted-foreground hover:text-destructive hover:bg-accent transition-colors',
                      props.className
                    )}
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                )}
              />
              <TooltipContent side="right">{t('sidebar.signOut')}</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <>
            <Link
              href="/settings"
              className={cn(
                'min-h-11 flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium transition-colors',
                pathname === '/settings'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              )}
            >
              <Settings className="h-4 w-4" />
              {t('nav.settings')}
            </Link>
            <button
              type="button"
              onClick={togglePrivacy}
              className={cn(
                'min-h-11 flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors',
                privacyOn && 'text-primary'
              )}
            >
              {privacyOn ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {privacyOn ? t('sidebar.showAmounts') : t('sidebar.hideAmounts')}
            </button>
            <button
              onClick={cycleTheme}
              className="min-h-11 flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <ThemeIcon className="h-4 w-4" />
              {themeLabel}
            </button>
            <LocaleToggle className="min-h-11 flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-base font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" />
            <button
              onClick={handleSignOut}
              className="min-h-11 flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-base font-medium text-muted-foreground hover:text-destructive hover:bg-accent transition-colors"
            >
              <LogOut className="h-4 w-4" />
              {t('sidebar.signOut')}
            </button>
          </>
        )}
      </div>

      <button
        onClick={toggleCollapsed}
        className="absolute -end-3 top-20 flex h-6 w-6 items-center justify-center rounded-full border bg-card text-muted-foreground hover:text-foreground shadow-sm transition-colors"
      >
        <ChevronLeft className={cn('h-3 w-3 transition-transform', collapsed && 'rotate-180')} />
      </button>
    </aside>
  )
}
