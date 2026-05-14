/**
 * Local token storage helpers.
 *
 * MVP uses localStorage; post-MVP we'll migrate to httpOnly cookies. All access
 * goes through these helpers so swapping the implementation later is one file.
 */

const TOKEN_KEY = 'dataverse.token'

function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

export function getToken(): string | null {
  if (!isBrowser()) return null
  return window.localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  if (!isBrowser()) return
  window.localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  if (!isBrowser()) return
  window.localStorage.removeItem(TOKEN_KEY)
}

export function isAuthenticated(): boolean {
  return getToken() !== null
}
