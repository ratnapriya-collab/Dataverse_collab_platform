import type { ReactNode } from 'react'
import TopNav from './TopNav'

interface Props {
  children: ReactNode
  /** Set to true on viewer-style pages to skip page padding. */
  bare?: boolean
}

export default function AppShell({ children, bare = false }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <TopNav />
      <main className={`flex-1 ${bare ? '' : ''}`}>{children}</main>
    </div>
  )
}
