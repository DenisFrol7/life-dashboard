import { apiRequest } from './client'

export type AnalyticsOverview = {
  totalSteps: number; distanceMeters: number; activeDays: number
  averageSleepMinutes: number; averageSleepQuality: number
  completedHabitEntries: number; trackedHabitEntries: number; habitCompletionPercent: number
  gameMinutes: number; gameSessions: number; unlockedAchievements: number
  moviesWatched: number; seriesEpisodesWatched: number; animeEpisodesWatched: number
  pagesRead: number; readingMinutes: number
}

export type AnalyticsDailyPoint = {
  date: string; steps: number; distanceMeters: number; sleepMinutes: number; sleepSessions: number
  sleepQuality: number | null; completedHabitEntries: number; trackedHabitEntries: number
  gameMinutes: number; gameSessions: number; unlockedAchievements: number; moviesWatched: number
  seriesEpisodesWatched: number; animeEpisodesWatched: number; pagesRead: number; readingMinutes: number
}

export type Analytics = {
  from: string; to: string; previousFrom: string; previousTo: string
  current: AnalyticsOverview; previous: AnalyticsOverview; daily: AnalyticsDailyPoint[]
}

export const getAnalytics = (from: string, to: string, allTime = false) =>
  apiRequest<Analytics>(`/api/analytics?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${allTime ? '&allTime=true' : ''}`)
