import { apiRequest } from './client'

export type SleepSession = {
  id: number
  startedAt: string
  endedAt: string
  deepSleepMinutes: number | null
  lightSleepMinutes: number | null
  remSleepMinutes: number | null
  awakeMinutes: number | null
  qualityRating: number | null
  note: string | null
}

export type SleepSessionInput = Omit<SleepSession, 'id'>

export const getSleepSessions = (from: string, to: string) =>
  apiRequest<SleepSession[]>(`/api/sleep-sessions?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)

export const createSleepSession = (input: SleepSessionInput) =>
  apiRequest<SleepSession>('/api/sleep-sessions', { method: 'POST', body: JSON.stringify(input) })

export const updateSleepSession = (id: number, input: SleepSessionInput) =>
  apiRequest<SleepSession>(`/api/sleep-sessions/${id}`, { method: 'PUT', body: JSON.stringify(input) })

export const deleteSleepSession = (id: number) =>
  apiRequest<void>(`/api/sleep-sessions/${id}`, { method: 'DELETE' })
