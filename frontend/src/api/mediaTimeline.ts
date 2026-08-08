import { apiRequest } from './client'
import { getBooks } from './books'

type ContentItem = { id: number; title: string; itemType: 'MOVIE' | 'SERIES' | 'ANIME' | 'GAME' | 'BOOK'; durationMinutes: number | null }
type Season = { id: number; seasonNumber: number }
type Episode = { id: number; episodeNumber: number; title: string | null; durationMinutes: number | null }
type Watch = { id: number; watchedAt: string; watchNumber: number }
export type MediaTimelineItem = { id: string; occurredAt: string; title: string; detail: string; durationMinutes: number | null }

const watchedOn = (instant: string, date: string) => new Date(instant).toLocaleDateString('en-CA') === date

export async function getMediaTimeline(date: string): Promise<MediaTimelineItem[]> {
  const content = await apiRequest<ContentItem[]>('/api/content')
  const movieItems = (await Promise.all(content.filter((item) => item.itemType === 'MOVIE').map(async (movie) => {
    const watches = await apiRequest<Watch[]>(`/api/content/${movie.id}/watches`)
    return watches.filter((watch) => watchedOn(watch.watchedAt, date)).map((watch) => ({ id: `movie-${watch.id}`, occurredAt: watch.watchedAt, title: movie.title, detail: watch.watchNumber > 1 ? `Повторный просмотр №${watch.watchNumber}` : 'Просмотрен фильм', durationMinutes: movie.durationMinutes }))
  }))).flat()
  const episodeItems = (await Promise.all(content.filter((item) => item.itemType === 'SERIES' || item.itemType === 'ANIME').map(async (item) => {
    const seasons = await apiRequest<Season[]>(`/api/content/${item.id}/seasons`)
    return (await Promise.all(seasons.map(async (season) => {
      const episodes = await apiRequest<Episode[]>(`/api/content/seasons/${season.id}/episodes`)
      return (await Promise.all(episodes.map(async (episode) => {
        const watches = await apiRequest<Watch[]>(`/api/content/episodes/${episode.id}/watches`)
        return watches.filter((watch) => watchedOn(watch.watchedAt, date)).map((watch) => ({ id: `episode-${watch.id}`, occurredAt: watch.watchedAt, title: item.title, detail: `Сезон ${season.seasonNumber}, серия ${episode.episodeNumber}${episode.title ? ` — ${episode.title}` : ''}`, durationMinutes: episode.durationMinutes }))
      }))).flat()
    }))).flat()
  }))).flat()
  const books = await getBooks()
  const bookItems = books.flatMap((book) => book.sessions.filter((session) => watchedOn(session.startedAt, date))
    .map((session) => ({ id: `book-${session.id}`, occurredAt: session.startedAt, title: book.title,
      detail: session.pagesRead ? `Прочитано ${session.pagesRead} стр.` : 'Сеанс чтения', durationMinutes: session.durationMinutes })))
  return [...movieItems, ...episodeItems, ...bookItems]
}
