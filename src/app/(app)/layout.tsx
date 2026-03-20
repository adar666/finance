import { AppSidebar } from '@/components/layout/app-sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 overflow-x-hidden pb-20 md:pb-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          {children}
        </div>
      </main>
      <MobileNav />
    </div>
  )
}
