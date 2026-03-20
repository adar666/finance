import { AppProviders } from '@/components/layout/app-providers'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { CommandPalette } from '@/components/layout/command-palette'
import { MobileNav } from '@/components/layout/mobile-nav'
import { QuickAddFAB } from '@/components/layout/quick-add-fab'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <div className="flex min-h-screen">
        <CommandPalette />
        <AppSidebar />
        <main className="flex-1 overflow-x-hidden pb-20 md:pb-0">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
            {children}
          </div>
        </main>
        <MobileNav />
        <QuickAddFAB />
      </div>
    </AppProviders>
  )
}
