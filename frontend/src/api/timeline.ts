import { apiRequest } from './client'

export type TimelineKind = 'activity' | 'sleep' | 'habit' | 'calendar' | 'media' | 'game' | 'blog'
export type TimelineItem = { id: string; kind: TimelineKind; time: string | null; title: string; detail: string;
  value: string | null; durationMinutes: number | null; completed: boolean }

export const getTimeline = (date: string) =>
  apiRequest<TimelineItem[]>(`/api/timeline?date=${encodeURIComponent(date)}`)
