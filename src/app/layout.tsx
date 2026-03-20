import type { Metadata } from 'next'
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import { StagingBanner } from '@/components/layout/staging-banner'
import { Providers } from '@/components/providers'
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
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${sans.variable} ${mono.variable} font-sans min-h-screen antialiased`}
      >
        <StagingBanner />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
