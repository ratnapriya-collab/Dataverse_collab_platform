'use client'

/**
 * sendToDoc — bridge between the 3D-viewer Capture gallery and the
 * per-Part doc editor.
 *
 * The doc editor's source of truth is `localStorage.getItem(
 *   'dataverse.doc.<partId>.<tabId>'
 * )` (see DocEditor.tsx). Because localStorage is capped at ~5-10MB
 * per origin, we CANNOT inline captures as base64 — 8 screenshots at
 * 1460×915 would blow the quota (~16MB).
 *
 * Instead the doc HTML holds a reference:
 *
 *   <img class="dv-capture-ref" data-capture-id="<uuid>"
 *        data-w="1460" data-h="915" alt="caption or ''"
 *        src="data:image/svg+xml;utf8,<tiny placeholder>" />
 *
 * The doc editor scans for `.dv-capture-ref` on mount / on external
 * append and swaps the src for a blob URL fetched from
 * `/api/captures/{id}/image`. Blob URLs are cheap and short-lived — the
 * editor revokes them on unmount.
 *
 * Persistence therefore relies on the backend, which is already the
 * source of truth for captures (Postgres BYTEA via captureStore). The
 * doc HTML persists across reloads because the reference (a few bytes)
 * survives; the actual pixels are re-hydrated from the API.
 */

const DOC_STORAGE_PREFIX = 'dataverse.doc.'

/** 1×1 transparent PNG — inline placeholder used until the doc editor
 *  resolves the real image via /api/captures/{id}/image. Keeping the
 *  src populated (even with a placeholder) means the browser doesn't
 *  emit a broken-image icon in the split-second before hydration. */
const PLACEHOLDER_SRC =
  'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='

interface AppendOpts {
  /** Part whose doc receives the image. */
  partId: string
  /** Which doc tab (defaults to 'tab1'). */
  tabId?: string
  /** Optional caption rendered under the image inside a <figcaption>. */
  caption?: string
  /** Pixel dimensions of the source capture — used to hint aspect
   *  ratio while the real bytes are still loading. */
  width?: number
  height?: number
}

/**
 * Append a capture reference to the doc's stored HTML.
 * Returns the number of images now present in that doc.
 */
export async function appendImageToDoc(
  captureId: string,
  opts: AppendOpts,
): Promise<{ imagesInDoc: number; storageKey: string }> {
  const tabId = opts.tabId ?? 'tab1'
  const storageKey = `${DOC_STORAGE_PREFIX}${opts.partId}.${tabId}`

  const captionHtml =
    opts.caption !== undefined && opts.caption.trim() !== ''
      ? `<figcaption class="dv-figcaption" contenteditable="true">${escapeHtml(opts.caption)}</figcaption>`
      : ''

  // Reference-only <img>. The editor swaps src → blob URL on mount.
  // Width/height hints stop the layout from jumping on hydration.
  const wAttr = opts.width !== undefined ? ` data-w="${opts.width}"` : ''
  const hAttr = opts.height !== undefined ? ` data-h="${opts.height}"` : ''
  const altAttr = opts.caption !== undefined ? ` alt="${escapeHtml(opts.caption)}"` : ' alt=""'
  const figureHtml =
    `<figure class="dv-figure" contenteditable="false">` +
    `<span class="dv-annotatable" contenteditable="false">` +
    `<img class="dv-capture-ref" data-capture-id="${escapeHtml(captureId)}"${wAttr}${hAttr}${altAttr} ` +
    `src="${PLACEHOLDER_SRC}" style="max-width:100%;height:auto" />` +
    `</span>` +
    captionHtml +
    `</figure>`

  const existing = window.localStorage.getItem(storageKey) ?? ''
  const next = existing.trim() + figureHtml + '<p><br></p>'
  // Cheap guard: if by some pathological path we're still about to
  // exceed the quota, throw a clean error the caller can surface.
  try {
    window.localStorage.setItem(storageKey, next)
  } catch (err) {
    if (err instanceof Error && /quota/i.test(err.message)) {
      throw new Error(
        `Doc storage is full. Remove some content from this doc first, or clear old versions from the Version History panel.`,
      )
    }
    throw err
  }

  const dom = new DOMParser().parseFromString(next, 'text/html')
  const imagesInDoc = dom.querySelectorAll('img').length

  // Signal any open DocEditor to refresh + rehydrate refs.
  window.dispatchEvent(
    new CustomEvent('dv:doc:external-append', {
      detail: { storageKey, partId: opts.partId, tabId },
    }),
  )

  return { imagesInDoc, storageKey }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
