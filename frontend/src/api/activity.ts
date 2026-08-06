import { apiRequest } from './client'

export type DailyActivity = {
  id: number
  activityDate: string
  steps: number | null
  distanceMeters: number | null
  note: string | null
}

export type DailyActivityInput = Pick<DailyActivity, 'steps' | 'distanceMeters' | 'note'>

export const getActivityRange = (from: string, to: string) =>
  apiRequest<DailyActivity[]>(`/api/daily-activity?from=${from}&to=${to}`)

export const putActivity = (date: string, input: DailyActivityInput) =>
  apiRequest<DailyActivity>(`/api/daily-activity/${date}`, { method: 'PUT', body: JSON.stringify(input) })

export const deleteActivity = (date: string) =>
  apiRequest<void>(`/api/daily-activity/${date}`, { method: 'DELETE' })
