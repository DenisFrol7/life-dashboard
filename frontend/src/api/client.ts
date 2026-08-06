export type ApiErrorPayload = {
  status: number
  error: string
  message: string
  path: string
  fieldErrors?: Record<string, string>
}

export class ApiClientError extends Error {
  readonly payload: ApiErrorPayload

  constructor(payload: ApiErrorPayload) {
    super(payload.message)
    this.name = 'ApiClientError'
    this.payload = payload
  }
}

const apiBaseUrl = import.meta.env.VITE_API_URL ?? ''

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({
      status: response.status,
      error: response.statusText,
      message: 'Не удалось выполнить запрос',
      path,
    })) as ApiErrorPayload
    throw new ApiClientError(payload)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}
