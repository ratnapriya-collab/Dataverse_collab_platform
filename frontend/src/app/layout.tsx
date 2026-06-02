import type { Metadata } from 'next'
import { Suspense, type ReactNode } from 'react'
import CommandPalette from '@/components/layout/CommandPalette'
import NavigationLoader from '@/components/ui/NavigationLoader'
import './globals.css'

export const metadata: Metadata = {
  title: 'DataVerse Collab',
  description: 'CAD/engineering collaboration platform',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        {children}
        {/* Global Cmd+K / Ctrl+K palette. Self-contained — its own state and
            keyboard listener. Any "Quick search" button anywhere can open it
            via `openCommandPalette()`. */}
        <CommandPalette />
        {/* Global bubble loader for client-side route transitions.
            Suspense boundary required because the loader calls
            useSearchParams() (App Router rule). */}
        <Suspense fallback={null}>
          <NavigationLoader />
        </Suspense>
      </body>
    </html>
  )
}
