/**
 * Typed API client. Pages MUST go through this — no raw fetch() in components.
 */

import type {
  AnchorCreate,
  AnchorRead,
  ApiErrorBody,
  DecisionCreate,
  DecisionRead,
  DecisionState,
  HealthResponse,
  PartDetail,
  PartRead,
  RationaleSuggestion,
  TokenResponse,
  UserRead,
} from '@/types/api'
import { getToken } from '@/lib/auth'

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000'

/** Absolute URL to the backend. Useful for embedding signed download paths. */
export function apiUrl(path: string): string {
  return `${BASE_URL}${path}`
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: unknown
  auth?: boolean
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = false } = opts
  const headers: Record<string, string> = {}

  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = getToken()
    if (token === null) {
      throw new ApiError(401, 'no_token', 'Not authenticated')
    }
    headers['Authorization'] = `Bearer ${token}`
  }

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'network error'
    throw new ApiError(0, 'network_error', message)
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  const parsed: unknown = text.length > 0 ? safeJsonParse(text) : null

  if (!response.ok) {
    const { code, message } = extractError(parsed, response.status)
    throw new ApiError(response.status, code, message)
  }

  return parsed as T
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function extractError(parsed: unknown, status: number): { code: string; message: string } {
  if (parsed !== null && typeof parsed === 'object' && 'detail' in parsed) {
    const detail = (parsed as { detail: unknown }).detail
    if (detail !== null && typeof detail === 'object') {
      const d = detail as Partial<ApiErrorBody>
      if (typeof d.error === 'string' && typeof d.message === 'string') {
        return { code: d.error, message: d.message }
      }
    }
    if (typeof detail === 'string') {
      return { code: 'error', message: detail }
    }
  }
  return { code: 'error', message: `Request failed with status ${status}` }
}

// ── Public API surface ──────────────────────────────────────────────────────

export const api = {
  health(): Promise<HealthResponse> {
    return request<HealthResponse>('/health')
  },

  auth: {
    register(body: { email: string; password: string; name: string }): Promise<UserRead> {
      return request<UserRead>('/api/auth/register', { method: 'POST', body })
    },
    login(body: { email: string; password: string }): Promise<TokenResponse> {
      return request<TokenResponse>('/api/auth/login', { method: 'POST', body })
    },
    me(): Promise<UserRead> {
      return request<UserRead>('/api/auth/me', { auth: true })
    },
  },

  parts: {
    async upload(file: File): Promise<PartRead> {
      const token = getToken()
      if (token === null) {
        throw new ApiError(401, 'no_token', 'Not authenticated')
      }
      const form = new FormData()
      form.append('file', file)
      let response: Response
      try {
        response = await fetch(`${BASE_URL}/api/parts/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        })
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : 'network error'
        throw new ApiError(0, 'network_error', message)
      }
      const text = await response.text()
      const parsed: unknown = text.length > 0 ? safeJsonParse(text) : null
      if (!response.ok) {
        const { code, message } = extractError(parsed, response.status)
        throw new ApiError(response.status, code, message)
      }
      return parsed as PartRead
    },
    list(): Promise<PartRead[]> {
      return request<PartRead[]>('/api/parts', { auth: true })
    },
    get(id: string): Promise<PartDetail> {
      return request<PartDetail>(`/api/parts/${id}`, { auth: true })
    },
  },

  anchors: {
    /** Idempotent upsert. Returns the same anchor for the same (part_id, face_uuid). */
    create(body: AnchorCreate): Promise<AnchorRead> {
      return request<AnchorRead>('/api/anchors', { method: 'POST', body, auth: true })
    },
    list(partId: string): Promise<AnchorRead[]> {
      return request<AnchorRead[]>(`/api/anchors?part_id=${encodeURIComponent(partId)}`, {
        auth: true,
      })
    },
  },

  decisions: {
    list(partId: string, state?: DecisionState): Promise<DecisionRead[]> {
      const query = new URLSearchParams({ part_id: partId })
      if (state !== undefined) query.set('state', state)
      return request<DecisionRead[]>(`/api/decisions?${query.toString()}`, { auth: true })
    },
    create(body: DecisionCreate): Promise<DecisionRead> {
      return request<DecisionRead>('/api/decisions', { method: 'POST', body, auth: true })
    },
    transition(id: string, to: DecisionState): Promise<DecisionRead> {
      return request<DecisionRead>(`/api/decisions/${id}/transition`, {
        method: 'PATCH',
        body: { to },
        auth: true,
      })
    },
  },

  datum: {
    suggestRationale(partName?: string, anchorId?: string): Promise<RationaleSuggestion> {
      return request<RationaleSuggestion>('/api/datum/suggest-rationale', {
        method: 'POST',
        body: { part_name: partName, anchor_id: anchorId },
        auth: true,
      })
    },
  },
}
