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

export function getApiErrorMessage(reason: unknown, fallback: string): string {
  if (reason instanceof ApiClientError) {
    if (reason.payload.status === 404) return 'Запрашиваемые данные не найдены.'
    if (reason.payload.status >= 500) return 'Backend вернул ошибку. Попробуйте повторить запрос.'
    return reason.message || fallback
  }
  if (reason instanceof TypeError) {
    return 'Не удалось связаться с backend. Проверьте, что сервер запущен.'
  }
  return reason instanceof Error && reason.message ? reason.message : fallback
}

const apiBaseUrl = import.meta.env.VITE_API_URL ?? ''

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch (reason) {
    throw new Error(getApiErrorMessage(reason, 'Не удалось выполнить запрос.'))
  }

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
