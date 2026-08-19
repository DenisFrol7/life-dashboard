import { apiRequest } from './client'

export type EventType = 'EVENT' | 'TASK' | 'REMINDER'
export type ScheduleType = 'ONCE' | 'DAILY' | 'WEEKLY' | 'SELECTED_DAYS'
export type CalendarEventStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED'
export type OccurrenceStatus = 'COMPLETED' | 'CANCELLED' | 'SKIPPED'

export type CalendarEvent = {
  id: number; title: string; description: string | null; eventType: EventType; scheduleType: ScheduleType
  startDate: string; repeatUntil: string | null; startTime: string | null; endTime: string | null
  allDay: boolean; location: string | null; status: CalendarEventStatus; scheduleDays: number[]
}
export type CalendarEventInput = Omit<CalendarEvent, 'id'>
export type Occurrence = { id: number; occurrenceDate: string; status: OccurrenceStatus; completedAt: string | null; note: string | null }

export const getCalendarEvents = () => apiRequest<CalendarEvent[]>('/api/calendar/events?status=ACTIVE')
export const createCalendarEvent = (input: CalendarEventInput) => apiRequest<CalendarEvent>('/api/calendar/events', { method: 'POST', body: JSON.stringify(input) })
export const updateCalendarEvent = (id: number, input: CalendarEventInput) => apiRequest<CalendarEvent>(`/api/calendar/events/${id}`, { method: 'PUT', body: JSON.stringify(input) })
export const deleteCalendarEvent = (id: number) => apiRequest<void>(`/api/calendar/events/${id}`, { method: 'DELETE' })
export const getOccurrences = (id: number) => apiRequest<Occurrence[]>(`/api/calendar/events/${id}/occurrences`)
export const getOccurrencesForRange = (from: string, to: string) =>
  apiRequest<{ eventId: number; occurrence: Occurrence }[]>(`/api/calendar/occurrences?from=${from}&to=${to}`)
export const completeOccurrence = (id: number, date: string) => apiRequest<Occurrence>(`/api/calendar/events/${id}/occurrences/${date}`, { method: 'PUT', body: JSON.stringify({ status: 'COMPLETED', completedAt: null, note: null }) })
export const deleteOccurrence = (id: number, date: string) => apiRequest<void>(`/api/calendar/events/${id}/occurrences/${date}`, { method: 'DELETE' })
