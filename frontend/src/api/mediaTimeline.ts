import { apiRequest } from './client'
import { getBooks } from './books'

export type MediaTimelineItem = { id: string; occurredAt: string; title: string; detail: string; durationMinutes: number | null }

const watchedOn = (instant: string, date: string) => new Date(instant).toLocaleDateString('en-CA') === date

export async function getMediaTimeline(date: string): Promise<MediaTimelineItem[]> {
  const from = new Date(`${date}T00:00:00`)
  const to = new Date(from); to.setDate(to.getDate() + 1)
  const mediaItems = await apiRequest<MediaTimelineItem[]>(`/api/content/timeline?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`)
  const books = await getBooks()
  const bookItems = books.flatMap((book) => book.sessions.filter((session) => watchedOn(session.startedAt, date))
    .map((session) => ({ id: `book-${session.id}`, occurredAt: session.startedAt, title: book.title,
      detail: book.bookFormat === 'AUDIOBOOK' ? `Прослушано ${session.listenedMinutes} мин.`
        : session.pagesRead ? `Прочитано ${session.pagesRead} стр.` : 'Сеанс чтения', durationMinutes: session.durationMinutes })))
  return [...mediaItems, ...bookItems]
}
