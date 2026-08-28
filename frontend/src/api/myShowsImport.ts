import { ApiClientError, type ApiErrorPayload } from './client'

export type MyShowsSeriesPreview = {
  title: string
  status: string
  rating: number | null
  watchedEpisodes: number | null
  remainingEpisodes: number | null
  match: 'MATCHED' | 'NEW' | 'AMBIGUOUS'
  contentId: number | null
}

export type MyShowsImportPreview = {
  totalSeries: number
  totalEpisodeWatches: number
  matchedSeries: number
  newSeries: number
  ambiguousSeries: number
  statuses: Record<string, number>
  series: MyShowsSeriesPreview[]
  warnings: string[]
}

export type KinopoiskCandidate = { filmId: number; nameRu: string | null; nameEn: string | null; year: string | null; type: string }
export type KinopoiskMatchPreview = {
  totalSeries: number
  matchedSeries: number
  reviewRequired: number
  notFound: number
  series: Array<{
    title: string
    status: string
    match: 'MATCHED' | 'REVIEW' | 'NOT_FOUND'
    selectedFilmId: number | null
    candidates: KinopoiskCandidate[]
  }>
}

export type MyShowsImportChoice = { sourceTitle: string; action: 'IMPORT' | 'SKIP'; filmId: number | null; nameRu: string | null; nameEn: string | null; year: string | null }
export type MyShowsImportResult = { importedSeries: number; skippedSeries: number; importedEpisodeWatches: number; backupFile: string }
export type KinopoiskEnrichmentResult = { total: number; updated: number; remaining: number; rateLimited: boolean; backupFile: string | null }

const apiBaseUrl = import.meta.env.VITE_API_URL ?? ''

export async function previewMyShowsImport(file: File): Promise<MyShowsImportPreview> {
  const path = '/api/series/import/myshows/preview'
  const form = new FormData()
  form.append('file', file)
  const response = await fetch(`${apiBaseUrl}${path}`, { method: 'POST', body: form })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({
      status: response.status,
      error: response.statusText,
      message: 'Не удалось прочитать экспорт MyShows',
      path,
    })) as ApiErrorPayload
    throw new ApiClientError(payload)
  }
  return response.json() as Promise<MyShowsImportPreview>
}

export async function matchMyShowsWithKinopoisk(file: File): Promise<KinopoiskMatchPreview> {
  const path = '/api/series/import/myshows/kinopoisk-match'
  const form = new FormData()
  form.append('file', file)
  const response = await fetch(`${apiBaseUrl}${path}`, { method: 'POST', body: form })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({
      status: response.status,
      error: response.statusText,
      message: 'Не удалось сопоставить сериалы с Кинопоиском',
      path,
    })) as ApiErrorPayload
    throw new ApiClientError(payload)
  }
  return response.json() as Promise<KinopoiskMatchPreview>
}

export async function confirmMyShowsImport(file: File, choices: MyShowsImportChoice[]): Promise<MyShowsImportResult> {
  const path = '/api/series/import/myshows/confirm'
  const form = new FormData()
  form.append('file', file)
  form.append('config', new Blob([JSON.stringify({ choices })], { type: 'application/json' }))
  const response = await fetch(`${apiBaseUrl}${path}`, { method: 'POST', body: form })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ status: response.status, error: response.statusText, message: 'Не удалось импортировать данные MyShows', path })) as ApiErrorPayload
    throw new ApiClientError(payload)
  }
  return response.json() as Promise<MyShowsImportResult>
}

export async function enrichSeriesFromKinopoisk(batchSize = 10): Promise<KinopoiskEnrichmentResult> {
  const path = `/api/series/import/myshows/enrich?batchSize=${batchSize}`
  const response = await fetch(`${apiBaseUrl}${path}`, { method: 'POST' })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({ status: response.status, error: response.statusText, message: 'Не удалось загрузить каталог Кинопоиска', path })) as ApiErrorPayload
    throw new ApiClientError(payload)
  }
  return response.json() as Promise<KinopoiskEnrichmentResult>
}
