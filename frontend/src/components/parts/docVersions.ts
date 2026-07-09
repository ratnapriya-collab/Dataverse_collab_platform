/**
 * Doc version history — thin localStorage layer.
 *
 * Every doc autosave calls `pushVersion()` which appends a snapshot to a
 * ring buffer capped at MAX_VERSIONS (per partId + tabId). The
 * VersionHistoryPanel lists them and calls `restoreVersion()` to swap
 * the current doc back to an earlier snapshot.
 *
 * We intentionally throttle: only ONE snapshot per 30-second window per
 * (partId, tabId) — otherwise every keystroke would fill the buffer and
 * evict older meaningful versions. Explicit "save" gestures could bump
 * a version out of the throttle if we add them later.
 */

const VERSIONS_PREFIX = 'dataverse.doc.versions.'
const MAX_VERSIONS = 10
const THROTTLE_MS = 30_000

export interface DocVersion {
  createdAt: string // ISO timestamp
  html: string
  charCount: number
}

function key(partId: string, tabId: string): string {
  return `${VERSIONS_PREFIX}${partId}.${tabId}`
}

export function loadVersions(partId: string, tabId: string): DocVersion[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key(partId, tabId))
    if (raw === null) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (v): v is DocVersion =>
        v !== null &&
        typeof v === 'object' &&
        typeof v.createdAt === 'string' &&
        typeof v.html === 'string' &&
        typeof v.charCount === 'number',
    )
  } catch {
    return []
  }
}

/**
 * Add a snapshot. Skipped if:
 *   · html is empty
 *   · html is identical to the newest snapshot (no-op edit)
 *   · the newest snapshot is younger than THROTTLE_MS
 *
 * Returns the updated list so callers can update UI state without a
 * second read from localStorage.
 */
export function pushVersion(partId: string, tabId: string, html: string): DocVersion[] {
  if (typeof window === 'undefined') return []
  const trimmed = html.trim()
  if (trimmed === '' || trimmed === '<br>' || trimmed === '<p><br></p>') {
    return loadVersions(partId, tabId)
  }
  const now = Date.now()
  const list = loadVersions(partId, tabId)
  const newest = list[0]
  if (newest !== undefined) {
    if (newest.html === html) return list
    const age = now - new Date(newest.createdAt).getTime()
    if (age < THROTTLE_MS) return list
  }
  const entry: DocVersion = {
    createdAt: new Date(now).toISOString(),
    html,
    charCount: html.replace(/<[^>]*>/g, '').length,
  }
  const next = [entry, ...list].slice(0, MAX_VERSIONS)
  try {
    window.localStorage.setItem(key(partId, tabId), JSON.stringify(next))
  } catch {
    /* silent — quota / private mode */
  }
  return next
}

/** Restore a version by timestamp. Returns the html, or null if not found. */
export function restoreVersion(
  partId: string,
  tabId: string,
  createdAt: string,
): string | null {
  const list = loadVersions(partId, tabId)
  const v = list.find((x) => x.createdAt === createdAt)
  return v?.html ?? null
}

/** Wipe all versions for a doc. Called from the panel's "Clear" action. */
export function clearVersions(partId: string, tabId: string): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(key(partId, tabId))
  } catch {
    /* silent */
  }
}
