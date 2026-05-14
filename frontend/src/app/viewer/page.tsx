'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import Logo from '@/components/ui/Logo'
import UserBadge from '@/components/ui/UserBadge'
import { ApiError, api } from '@/lib/api'
import { clearToken } from '@/lib/auth'
import type { UserRead } from '@/types/api'
import type { ViewerFace } from '@/components/viewer/ViewerCanvas'

const ViewerCanvas = dynamic(() => import('@/components/viewer/ViewerCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center text-sm text-slate-500">
      Loading 3D viewer…
    </div>
  ),
})

export default function ViewerDemoPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserRead | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastPick, setLastPick] = useState<ViewerFace | null>(null)

  useEffect(() => {
    let cancelled = false
    api.auth
      .me()
      .then((u) => {
        if (!cancelled) setUser(u)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 401) {
          clearToken()
          router.replace('/login')
          return
        }
        setError(err instanceof Error ? err.message : 'Failed to load user')
      })
    return () => {
      cancelled = true
    }
  }, [router])

  const handleFacePick = useCallback((face: ViewerFace) => {
    // eslint-disable-next-line no-console
    console.log('[face-pick]', { faceId: face.uuid, centroid: face.centroid })
    setLastPick(face)
  }, [])

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

  if (user === null) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-500">
        <span className="text-sm">Loading…</span>
      </main>
    )
  }

  return (
    <main className="flex h-screen flex-col">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-4">
            <Link
              href="/home"
              aria-label="Back to home"
              title="Back to home"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-primary hover:text-primary hover:shadow-sm"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Logo compact />
          </div>
          <div className="flex items-center gap-3">
            <UserBadge name={user.name} email={user.email} />
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <section className="grid flex-1 grid-cols-[1fr_320px] overflow-hidden">
        <div className="relative bg-slate-100">
          <ViewerCanvas onFacePick={handleFacePick} />
        </div>

        <aside className="dv-thin-scroll overflow-y-auto border-l border-slate-200 bg-white px-5 py-6">
          <h2 className="text-sm font-semibold text-slate-900">Welcome, {user.name}.</h2>
          <p className="mt-1 text-xs text-slate-500">
            Click any face on the 3D model to pick it. A stable topology-hash UUID is
            computed on every pick — the same face produces the same UUID across re-uploads.
          </p>

          <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Last picked face
            </h3>
            {lastPick === null ? (
              <p className="mt-2 text-sm text-slate-400">No face picked yet.</p>
            ) : (
              <dl className="mt-3 space-y-1 text-xs">
                <KV label="UUID" value={lastPick.uuid} mono />
                <KV label="Mesh" value={lastPick.meshName} mono />
                <KV
                  label="Centroid"
                  value={`${fmt(lastPick.centroid.x)}, ${fmt(lastPick.centroid.y)}, ${fmt(lastPick.centroid.z)}`}
                  mono
                />
                <KV
                  label="Normal"
                  value={`${fmt(lastPick.normal.x)}, ${fmt(lastPick.normal.y)}, ${fmt(lastPick.normal.z)}`}
                  mono
                />
                <KV label="Area" value={lastPick.area.toFixed(3)} mono />
                <KV label="Triangles" value={String(lastPick.triangleCount)} mono />
              </dl>
            )}
          </div>

          <p className="mt-6 text-xs text-slate-400">
            Tip: to view your own uploaded part instead of sample geometry,{' '}
            <Link href="/home" className="text-primary hover:underline">
              go back to /home
            </Link>{' '}
            and pick a part.
          </p>
        </aside>
      </section>
    </main>
  )
}

function fmt(n: number): string {
  return n.toFixed(2)
}

function KV({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-right text-slate-900 ${mono ? 'font-mono' : ''} break-all`}>
        {value}
      </dd>
    </div>
  )
}
