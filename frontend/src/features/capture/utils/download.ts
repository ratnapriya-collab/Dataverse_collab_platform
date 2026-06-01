'use client'

/**
 * Trigger a browser download for a Blob — no `file-saver` dependency.
 * The Object URL is created, clicked, then revoked on next tick.
 */

export function downloadBlob(blob: Blob, filename: string): void {
  if (typeof window === 'undefined') return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke on next tick — some browsers need a beat to start the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Build a safe-ish filename from arbitrary part name + suffix. */
export function safeFilename(parts: (string | undefined)[], extension: string): string {
  const cleaned = parts
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .map((p) =>
      p
        .normalize('NFKD')
        .replace(/[^\w\-. ]+/g, '')
        .trim()
        .replace(/\s+/g, '-'),
    )
    .filter((p) => p.length > 0)
    .join('-')
    .slice(0, 120)
  return `${cleaned || 'capture'}.${extension.replace(/^\./, '')}`
}
