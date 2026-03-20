import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import { StagingBannerBar } from '@/components/layout/staging-banner'
import { Providers } from '@/components/providers'
import { cn } from '@/lib/utils'
import { isStagingFinanceHost } from '@/lib/utils/staging-host'
import './globals.css'

const sans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans-ui',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
})

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-ui',
  display: 'swap',
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: {
    default: 'Finance — Personal Money Manager',
    template: '%s — Finance',
  },
  description: 'Track your money, investments, budgets, and savings goals in one place.',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? ''
  const showStagingBanner = isStagingFinanceHost(host)

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          sans.variable,
          mono.variable,
          'font-sans min-h-screen antialiased',
          showStagingBanner && 'pt-12'
        )}
      >
        {showStagingBanner ? <StagingBannerBar /> : null}
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
