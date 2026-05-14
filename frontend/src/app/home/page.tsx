'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { Building2, Shield } from 'lucide-react'
import UploadDropzone from '@/components/ui/UploadDropzone'
import NotificationsBell from '@/components/layout/NotificationsBell'
import WorkspaceSidebar from '@/components/layout/WorkspaceSidebar'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import { SEED_WORKSPACE } from '@/lib/mockWorkspace'
import type { PartRead, UserRead } from '@/types/api'

export default function HomePage() {
  const router = useRouter()
  const [user, setUser] = useState<UserRead | null>(null)
  const [parts, setParts] = useState<PartRead[] | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.auth.me(), api.parts.list()])
      .then(([u, p]) => {
        if (cancelled) return
        setUser(u)
        setParts(p)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          clearToken()
          router.replace('/login')
          return
        }
        setError(err instanceof Error ? err.message : 'Failed to load')
      })
    return () => {
      cancelled = true
    }
  }, [router])

  const handleUpload = useCallback(
    async (file: File) => {
      setError(null)
      setUploading(true)
      try {
        const created = await api.parts.upload(file)
        router.push(`/parts/${created.id}`)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Upload failed')
        setUploading(false)
      }
    },
    [router],
  )

  function handleSignOut(): void {
    clearToken()
    router.replace('/login')
  }

  if (error !== null) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      </main>
    )
  }

  if (user === null || parts === null) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-500">
        <span className="text-sm">Loading…</span>
      </main>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* /home is a secondary upload surface — no sidebar item to highlight. */}
      <WorkspaceSidebar user={user} onSignOut={handleSignOut} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/85 px-6 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider text-slate-400">
              Workspace
            </span>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-900">Parts</span>
          </div>
          <NotificationsBell />
        </header>

      <section className="mx-auto w-full max-w-5xl px-6 py-8">
        {/* Workspace pill — links to /admin */}
        <Link
          href="/admin"
          className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm transition hover:border-primary hover:shadow-md"
        >
          <Building2 className="h-3.5 w-3.5 text-brand" />
          <span className="font-semibold text-slate-900">{SEED_WORKSPACE.name}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold text-primary-700">
            <Shield className="h-2.5 w-2.5" />
            ADMIN
          </span>
          <span className="ml-1 text-slate-400 group-hover:text-primary">→</span>
        </Link>

        <div className="mt-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Welcome, {user.name}.</h2>
            <p className="mt-1 text-sm text-slate-500">
              Upload a CAD file to open it in the 3D viewer. Files are stored privately to
              your account; downloads use short-lived signed URLs.
            </p>
          </div>
          <Link
            href="/viewer"
            className="shrink-0 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-600"
          >
            3D viewer
          </Link>
        </div>

        <div className="mt-8">
          <UploadDropzone onFile={handleUpload} disabled={uploading} />
        </div>

        <div className="mt-10">
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Your parts
            </h3>
            <span className="text-xs text-slate-400">
              {parts.length} {parts.length === 1 ? 'part' : 'parts'}
            </span>
          </div>

          {parts.length === 0 ? (
            <p className="mt-4 rounded-md border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-400">
              No parts yet. Drop a file above to get started.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-200 rounded-md border border-slate-200 bg-white">
              {parts.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/parts/${p.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{p.name}</p>
                      <p className="truncate text-xs text-slate-500">{p.file_name}</p>
                    </div>
                    <div className="ml-4 text-right">
                      <p className="text-xs text-slate-500">
                        {new Date(p.created_at).toLocaleString()}
                      </p>
                      <p className="font-mono text-[10px] text-slate-400">
                        {p.content_hash.slice(0, 12)}…
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      </div>
    </div>
  )
}
