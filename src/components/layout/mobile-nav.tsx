'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ArrowLeftRight,
  Wallet,
  TrendingUp,
  PiggyBank,
  MoreHorizontal,
  Target,
  Calculator,
  Settings,
  BarChart3,
} from 'lucide-react'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const mobileNavItems = [
  { href: '/', label: 'Home', icon: LayoutDashboard },
  { href: '/accounts', label: 'Accounts', icon: Wallet },
  { href: '/transactions', label: 'Txns', icon: ArrowLeftRight },
  { href: '/budgets', label: 'Budgets', icon: PiggyBank },
  { href: '/investments', label: 'Invest', icon: TrendingUp },
] as const

const moreSheetItems = [
  { href: '/savings', label: 'Savings Goals', icon: Target },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/planning', label: 'Planning', icon: Calculator },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const

const moreHrefs = moreSheetItems.map((item) => item.href)

function navItemClassName(active: boolean) {
  return cn(
    'flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg text-sm font-medium transition-colors min-w-[52px]',
    active ? 'text-primary' : 'text-muted-foreground'
  )
}

function sheetNavLinkClassName(active: boolean) {
  return cn(
    'flex flex-col items-center justify-center gap-1 px-3 py-3 rounded-lg text-sm font-medium transition-colors w-full min-h-[56px]',
    active ? 'text-primary' : 'text-muted-foreground'
  )
}

export function MobileNav() {
  const pathname = usePathname()

  const isMoreRouteActive = moreHrefs.some(
    (href) => pathname === href || pathname.startsWith(`${href}/`)
  )

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md">
      <div className="flex items-center justify-around h-16 px-1">
        {mobileNavItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={navItemClassName(isActive)}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}

        <Sheet>
          <SheetTrigger
            className={cn(navItemClassName(isMoreRouteActive), 'border-0 bg-transparent')}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            <div className="flex flex-col gap-0.5 pt-2">
              {moreSheetItems.map((item) => {
                const Icon = item.icon
                const isActive =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`)
                return (
                  <SheetClose
                    key={item.href}
                    nativeButton={false}
                    render={
                      <Link
                        href={item.href}
                        className={sheetNavLinkClassName(isActive)}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{item.label}</span>
                      </Link>
                    }
                  />
                )
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  )
}
