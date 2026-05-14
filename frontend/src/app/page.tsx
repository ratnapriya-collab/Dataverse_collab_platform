'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'

export default function RootRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace(isAuthenticated() ? '/workspace' : '/login')
  }, [router])

  return (
    <main className="flex min-h-screen items-center justify-center text-slate-500">
      <span className="text-sm">Loading…</span>
    </main>
  )
}
