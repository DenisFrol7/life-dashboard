import { apiRequest } from './client'
import type { LibraryInput, LibraryStatus, ReleaseStatus, Watch } from './movies'

export type SeriesFormat = 'LIVE_ACTION' | 'ANIMATION'
export type Series = { id: number; title: string; originalTitle: string | null; itemType: 'SERIES'; format: SeriesFormat; releaseYear: number | null; description: string | null; coverUrl: string | null; durationMinutes: number | null; releaseStatus: ReleaseStatus; genre: string | null; developer: string | null; releaseDate: string | null; xboxPlayAnywhere: boolean }
export type SeriesInput = Omit<Series, 'id'>
export type SeriesLibraryEntry = { id: number; content: Series; status: LibraryStatus; rating: number | null; favorite: boolean; startedAt: string | null; completedAt: string | null; personalNote: string | null }
export type Season = { id: number; contentId: number; seasonNumber: number; title: string | null; releaseYear: number | null }
export type Episode = { id: number; seasonId: number; episodeNumber: number; title: string; durationMinutes: number | null; releaseDate: string | null }
export type SeasonInput = Omit<Season, 'id' | 'contentId'>
export type EpisodeInput = Omit<Episode, 'id' | 'seasonId'>
export type BulkEpisodeInput = { count: number; durationMinutes: number | null; markWatched: boolean; watchedAt: string | null }
export type SeasonCompletion = { id: number; seasonId: number; completedAt: string | null; episodeCount: number }
export type ViewingEpisode = Episode & { watches: Watch[] }
export type ViewingSeason = Season & { completion?: SeasonCompletion; episodes: ViewingEpisode[] }
export type ViewingStructure = { seasons: ViewingSeason[] }
export type SeriesCatalogItem = Omit<Series, 'itemType' | 'xboxPlayAnywhere'> & { libraryId: number | null; userStatus: LibraryStatus | null; rating: number | null; favorite: boolean; startedAt: string | null; completedAt: string | null; personalNote: string | null; seasonCount: number; episodeCount: number; watchedEpisodeCount: number; watchedMinutes: number }

export const getSeries = () => apiRequest<Series[]>('/api/content?type=SERIES')
export const getSeriesCatalog = () => apiRequest<SeriesCatalogItem[]>('/api/series')
export const getSeriesById = (id: number) => apiRequest<Series>(`/api/content/${id}`)
export const createSeries = (input: SeriesInput) => apiRequest<Series>('/api/content', { method: 'POST', body: JSON.stringify(input) })
export const updateSeries = (id: number, input: SeriesInput) => apiRequest<Series>(`/api/content/${id}`, { method: 'PUT', body: JSON.stringify(input) })
export const deleteSeries = (id: number) => apiRequest<void>(`/api/content/${id}`, { method: 'DELETE' })
export const getSeriesLibrary = () => apiRequest<SeriesLibraryEntry[]>('/api/library')
export const putSeriesLibrary = (id: number, input: LibraryInput) => apiRequest<SeriesLibraryEntry>(`/api/library/${id}`, { method: 'PUT', body: JSON.stringify(input) })
export const removeSeriesLibrary = (id: number) => apiRequest<void>(`/api/library/${id}`, { method: 'DELETE' })
export const getSeasons = (id: number) => apiRequest<Season[]>(`/api/content/${id}/seasons`)
export const getViewingStructure = (id: number) => apiRequest<ViewingStructure>(`/api/content/${id}/viewing-structure`)
export const createSeason = (id: number, input: SeasonInput) => apiRequest<Season>(`/api/content/${id}/seasons`, { method: 'POST', body: JSON.stringify(input) })
export const updateSeason = (id: number, input: SeasonInput) => apiRequest<Season>(`/api/content/seasons/${id}`, { method: 'PUT', body: JSON.stringify(input) })
export const deleteSeason = (id: number) => apiRequest<void>(`/api/content/seasons/${id}`, { method: 'DELETE' })
export const getEpisodes = (id: number) => apiRequest<Episode[]>(`/api/content/seasons/${id}/episodes`)
export const createEpisode = (id: number, input: EpisodeInput) => apiRequest<Episode>(`/api/content/seasons/${id}/episodes`, { method: 'POST', body: JSON.stringify(input) })
export const createEpisodes = (id: number, input: BulkEpisodeInput) => apiRequest<Episode[]>(`/api/content/seasons/${id}/episodes/bulk`, { method: 'POST', body: JSON.stringify(input) })
export const updateEpisode = (id: number, input: EpisodeInput) => apiRequest<Episode>(`/api/content/episodes/${id}`, { method: 'PUT', body: JSON.stringify(input) })
export const deleteEpisode = (id: number) => apiRequest<void>(`/api/content/episodes/${id}`, { method: 'DELETE' })
export const getEpisodeWatches = (id: number) => apiRequest<Watch[]>(`/api/content/episodes/${id}/watches`)
export const watchEpisode = (id: number, watchedAt?: string) => apiRequest<Watch>(`/api/content/episodes/${id}/watches`, { method: 'POST', body: JSON.stringify({ watchedAt: watchedAt ?? null }) })
export const updateEpisodeWatch = (watchId: number, watchedAt: string) => apiRequest<Watch>(`/api/content/episode-watches/${watchId}`, { method: 'PUT', body: JSON.stringify({ watchedAt }) })
export const watchSeason = (id: number, watchedAt?: string) => apiRequest<void>(`/api/content/seasons/${id}/watches`, { method: 'POST', body: JSON.stringify({ watchedAt: watchedAt ?? null }) })
export const clearSeasonWatches = (id: number) => apiRequest<void>(`/api/content/seasons/${id}/watches`, { method: 'DELETE' })
export const getSeasonCompletion = (id: number) => apiRequest<SeasonCompletion | undefined>(`/api/content/seasons/${id}/completion`)
