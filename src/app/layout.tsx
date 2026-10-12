import type { Metadata } from 'next'
import './globals.css'
import { LocaleProvider } from '@/lib/i18n'
import { AppShell } from '@/components/AppShell'
import BootLoader from '@/components/BootLoader'

export const metadata: Metadata = {
  title: 'PromptMan',
  description: 'Local prompt management tools',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <BootLoader />
        <LocaleProvider>
          <AppShell>{children}</AppShell>
        </LocaleProvider>
      </body>
    </html>
  )
}


