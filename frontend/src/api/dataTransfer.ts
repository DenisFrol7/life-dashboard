import { ApiClientError, type ApiErrorPayload } from './client'

export type DataTransferResult = { backupFile: string; tableCount: number; rowCount: number }
const apiBaseUrl = import.meta.env.VITE_API_URL ?? ''

async function throwApiError(response: Response, path: string): Promise<never> {
  const payload = await response.json().catch(() => ({ status: response.status, error: response.statusText, message: 'Не удалось выполнить запрос', path })) as ApiErrorPayload
  throw new ApiClientError(payload)
}

export async function exportData(): Promise<void> {
  const path = '/api/data/export'
  const response = await fetch(`${apiBaseUrl}${path}`)
  if (!response.ok) await throwApiError(response, path)
  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  const simpleName = disposition.match(/filename="?([^";]+)"?/i)?.[1]
  const fileName = encodedName ? decodeURIComponent(encodedName) : simpleName ?? 'life-dashboard.json'
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export async function importData(file: File): Promise<DataTransferResult> {
  const path = '/api/data/import'
  const form = new FormData()
  form.append('file', file)
  const response = await fetch(`${apiBaseUrl}${path}`, { method: 'POST', body: form })
  if (!response.ok) await throwApiError(response, path)
  return response.json() as Promise<DataTransferResult>
}
