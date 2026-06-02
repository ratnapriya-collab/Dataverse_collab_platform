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
  FlagRegressionsRequest,
  FlagRegressionsResponse,
  RationaleSuggestion,
  ScreenBoundaryRequest,
  ScreenBoundaryResponse,
  SummarizeDocumentRequest,
  SummarizeDocumentResponse,
  SummarizeThreadRequest,
  SummarizeThreadResponse,
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
  /** Hard timeout in ms. Default 15000. A timed-out request throws ApiError(0, 'timeout'). */
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 15_000

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = false, timeoutMs = DEFAULT_TIMEOUT_MS } = opts
  const headers: Record<string, string> = {}

  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = getToken()
    if (token === null) {
      throw new ApiError(401, 'no_token', 'Not authenticated')
    }
    headers['Authorization'] = `Bearer ${token}`
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (cause) {
    clearTimeout(timer)
    if (cause instanceof Error && cause.name === 'AbortError') {
      throw new ApiError(0, 'timeout', `Request timed out after ${timeoutMs}ms`)
    }
    const message = cause instanceof Error ? cause.message : 'network error'
    throw new ApiError(0, 'network_error', message)
  }
  clearTimeout(timer)

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
    summarizeThread(body: SummarizeThreadRequest): Promise<SummarizeThreadResponse> {
      return request<SummarizeThreadResponse>('/api/datum/summarize-thread', {
        method: 'POST',
        body,
        auth: true,
      })
    },
    flagRegressions(body: FlagRegressionsRequest): Promise<FlagRegressionsResponse> {
      return request<FlagRegressionsResponse>('/api/datum/flag-regressions', {
        method: 'POST',
        body,
        auth: true,
      })
    },
    screenBoundary(body: ScreenBoundaryRequest): Promise<ScreenBoundaryResponse> {
      return request<ScreenBoundaryResponse>('/api/datum/screen-boundary', {
        method: 'POST',
        body,
        auth: true,
      })
    },
    summarizeDocument(body: SummarizeDocumentRequest): Promise<SummarizeDocumentResponse> {
      return request<SummarizeDocumentResponse>('/api/datum/summarize-document', {
        method: 'POST',
        body,
        auth: true,
      })
    },
  },

  captures: {
    list(partId: string): Promise<CaptureRead[]> {
      return request<CaptureRead[]>(`/api/parts/${encodeURIComponent(partId)}/captures`, {
        auth: true,
      })
    },

    /** Upload a captured image. The Blob can be a JPEG/PNG/WebP; pass MIME via the blob.type. */
    async create(
      partId: string,
      blob: Blob,
      meta: {
        caption?: string
        width: number
        height: number
        cameraState?: Record<string, unknown> | null
      },
    ): Promise<CaptureRead> {
      const token = getToken()
      if (token === null) {
        throw new ApiError(401, 'no_token', 'Not authenticated')
      }
      const form = new FormData()
      // Filename matters for FastAPI's UploadFile — give it a hint based on MIME.
      const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
      form.append('file', blob, `capture.${ext}`)
      form.append('caption', meta.caption ?? '')
      form.append('width', String(meta.width))
      form.append('height', String(meta.height))
      if (meta.cameraState !== null && meta.cameraState !== undefined) {
        form.append('camera_state_json', JSON.stringify(meta.cameraState))
      }
      let response: Response
      try {
        response = await fetch(`${BASE_URL}/api/parts/${encodeURIComponent(partId)}/captures`, {
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
      return parsed as CaptureRead
    },

    update(id: string, body: { caption?: string }): Promise<CaptureRead> {
      return request<CaptureRead>(`/api/captures/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body,
        auth: true,
      })
    },

    delete(id: string): Promise<void> {
      return request<void>(`/api/captures/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        auth: true,
      })
    },

    reorder(partId: string, orderedIds: string[]): Promise<CaptureRead[]> {
      return request<CaptureRead[]>(
        `/api/parts/${encodeURIComponent(partId)}/captures/reorder`,
        { method: 'POST', body: { ordered_ids: orderedIds }, auth: true },
      )
    },

    /**
     * Fetch an image's bytes as a Blob, sending the Bearer token.
     *
     * `<img src>` doesn't send Authorization headers — so for auth-protected
     * image endpoints we fetch with auth, get a Blob, and the caller
     * (captureStore) turns it into a Blob URL for the gallery's <img>.
     */
    async fetchImageBlob(captureId: string): Promise<Blob> {
      const token = getToken()
      if (token === null) {
        throw new ApiError(401, 'no_token', 'Not authenticated')
      }
      const response = await fetch(
        `${BASE_URL}/api/captures/${encodeURIComponent(captureId)}/image`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      if (!response.ok) {
        throw new ApiError(response.status, 'image_fetch_failed', `Failed to load capture image (${response.status})`)
      }
      return response.blob()
    },
  },
}

// ── Capture types — kept inline because they're tightly coupled to the
// `captures.*` methods above. (The frontend's domain type in
// features/capture/types lives separately and references this one.)

export interface CaptureRead {
  id: string
  part_id: string
  author_id: string
  caption: string
  width: number
  height: number
  image_url: string
  image_mime: string
  image_size: number
  camera_state: Record<string, unknown> | null
  sort_order: number
  created_at: string
  updated_at: string
}
