import { apiRequest } from './client'

export type TrackingType = 'BOOLEAN' | 'NUMBER' | 'DURATION'
export type HabitDataSource = 'MANUAL' | 'DAILY_ACTIVITY_STEPS' | 'DAILY_ACTIVITY_DISTANCE' | 'SLEEP_DURATION'
export type HabitScheduleType = 'DAILY' | 'SELECTED_DAYS'
export type HabitStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED'

export type Habit = {
  id: number
  name: string
  description: string | null
  trackingType: TrackingType
  dataSource: HabitDataSource
  targetValue: number | null
  unit: string | null
  scheduleType: HabitScheduleType
  startDate: string
  endDate: string | null
  status: HabitStatus
  scheduleDays: number[]
}

export type HabitInput = Omit<Habit, 'id'>

export type HabitEntry = {
  id: number
  entryDate: string
  value: number | null
  targetValueSnapshot: number | null
  skipped: boolean
  note: string | null
  recordedAt: string
}

export const getHabits = (status?: HabitStatus) =>
  apiRequest<Habit[]>(`/api/habits${status ? `?status=${status}` : ''}`)

export const createHabit = (input: HabitInput) =>
  apiRequest<Habit>('/api/habits', { method: 'POST', body: JSON.stringify(input) })

export const updateHabit = (id: number, input: HabitInput) =>
  apiRequest<Habit>(`/api/habits/${id}`, { method: 'PUT', body: JSON.stringify(input) })

export const deleteHabit = (id: number) =>
  apiRequest<void>(`/api/habits/${id}`, { method: 'DELETE' })

export const getHabitEntries = (id: number) =>
  apiRequest<HabitEntry[]>(`/api/habits/${id}/entries`)

export const putHabitEntry = (id: number, date: string, value: number | null, skipped = false) =>
  apiRequest<HabitEntry>(`/api/habits/${id}/entries/${date}`, {
    method: 'PUT', body: JSON.stringify({ value, skipped, note: null }),
  })

export const deleteHabitEntry = (id: number, date: string) =>
  apiRequest<void>(`/api/habits/${id}/entries/${date}`, { method: 'DELETE' })
