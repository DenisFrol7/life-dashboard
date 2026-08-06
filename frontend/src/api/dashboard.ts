import { apiRequest } from './client'

export type Dashboard = {
  date: string
  activity: { steps: number | null; distanceMeters: number | null }
  sleep: { durationMinutes: number; qualityRating: number | null; sessions: number }
  habits: { scheduled: number; completed: number; skipped: number; completionPercent: number }
  calendar: { scheduled: number; events: number; reminders: number; completedTasks: number; pendingTasks: number }
  journalEntries: number
  media: {
    currentMovies: number
    currentSeries: number
    pausedSeries: number
    currentAnime: number
    pausedAnime: number
    currentGames: number
  }
}

export const getDashboard = (date?: string) =>
  apiRequest<Dashboard>(`/api/dashboard${date ? `?date=${date}` : ''}`)
