'use client'

import { type DragEvent, type ReactNode, useCallback, useRef, useState } from 'react'
import { Loader2, UploadCloud } from 'lucide-react'

const ACCEPT = '.step,.stp,.glb,.gltf'
const ACCEPT_EXTS = ['step', 'stp', 'glb', 'gltf']
const MAX_MB = 50

interface Props {
  onFile: (file: File) => void
  disabled?: boolean
}

export default function UploadDropzone({ onFile, disabled = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const accept = useCallback(
    (file: File) => {
      setError(null)
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!ext || !ACCEPT_EXTS.includes(ext)) {
        setError(
          `Unsupported file. Allowed: ${ACCEPT_EXTS.map((e) => '.' + e).join(', ')}`,
        )
        return
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        setError(`File is too large. Max ${MAX_MB} MB.`)
        return
      }
      onFile(file)
    },
    [onFile],
  )

  function handleDragOver(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault()
    if (!disabled) setOver(true)
  }
  function handleDragLeave(): void {
    setOver(false)
  }
  function handleDrop(e: DragEvent<HTMLDivElement>): void {
    e.preventDefault()
    setOver(false)
    if (disabled) return
    const file = e.dataTransfer.files[0]
    if (file) accept(file)
  }

  const stateClasses = disabled
    ? 'cursor-not-allowed border-slate-200 bg-slate-50/50 opacity-70'
    : over
      ? 'cursor-pointer border-primary bg-primary-50 shadow-xl shadow-primary/15 scale-[1.005]'
      : 'cursor-pointer border-slate-200 bg-gradient-to-br from-white via-slate-50 to-brand-50 hover:border-primary-300 hover:shadow-lg hover:shadow-primary/5'

  return (
    <div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) inputRef.current?.click()
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        className={[
          'relative overflow-hidden rounded-2xl border-2 border-dashed px-8 py-12 text-center transition-all duration-300',
          stateClasses,
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) accept(file)
            e.target.value = ''
          }}
        />

        {/* Icon */}
        <div
          className={[
            'mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg transition-all',
            disabled
              ? 'bg-slate-200 text-slate-400'
              : over
                ? 'scale-110 bg-gradient-to-br from-primary to-brand text-white shadow-primary/30'
                : 'bg-gradient-to-br from-primary to-brand text-white shadow-primary/20',
          ].join(' ')}
        >
          {disabled ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <UploadCloud className="h-7 w-7" />
          )}
        </div>

        {/* Heading */}
        <h3 className="text-base font-semibold text-slate-900">
          {disabled
            ? 'Uploading your file…'
            : over
              ? 'Release to upload'
              : 'Drop your CAD file here'}
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          {disabled ? 'This may take a moment' : 'or click anywhere to browse from your computer'}
        </p>

        {/* Format chips */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
          {ACCEPT_EXTS.map((ext) => (
            <Chip key={ext}>{ext.toUpperCase()}</Chip>
          ))}
          <span className="ml-1 text-xs text-slate-400">·</span>
          <span className="text-xs text-slate-400">Max {MAX_MB} MB</span>
        </div>
      </div>

      {error !== null && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          {error}
        </p>
      )}
    </div>
  )
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-slate-600 shadow-sm">
      {children}
    </span>
  )
}
