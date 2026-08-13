import { apiRequest } from './client'
import type { LibraryInput, LibraryStatus, ReleaseStatus } from './movies'

export type AnimeSummary = { id: number; title: string; originalTitle: string | null; releaseYear: number | null; coverUrl: string | null; releaseStatus: ReleaseStatus; userStatus: LibraryStatus | null; rating: number | null; favorite: boolean; seasonCount: number; episodeCount: number; watchedEpisodeCount: number; watchedMinutes: number }
export type AnimeEpisode = { id: number; episodeNumber: number; title: string; durationMinutes: number | null; releaseDate: string | null; watched: boolean; watchCount: number }
export type AnimeSeason = { id: number; seasonNumber: number; title: string | null; releaseYear: number | null; episodes: AnimeEpisode[] }
export type AnimeDetails = Omit<AnimeSummary, 'seasonCount' | 'episodeCount' | 'watchedEpisodeCount'> & { description: string | null; startedAt: string | null; completedAt: string | null; personalNote: string | null; seasons: AnimeSeason[] }
export type AnimeInput = Pick<AnimeDetails, 'title' | 'originalTitle' | 'releaseYear' | 'description' | 'coverUrl' | 'releaseStatus'>

export const getAnime = () => apiRequest<AnimeSummary[]>('/api/anime')
export const getAnimeDetails = (id: number) => apiRequest<AnimeDetails>(`/api/anime/${id}`)
export const createAnime = (input: AnimeInput) => apiRequest<AnimeDetails>('/api/anime', { method: 'POST', body: JSON.stringify(input) })
export const updateAnime = (id: number, input: AnimeInput) => apiRequest<AnimeDetails>(`/api/anime/${id}`, { method: 'PUT', body: JSON.stringify(input) })
export const deleteAnime = (id: number) => apiRequest<void>(`/api/anime/${id}`, { method: 'DELETE' })
export const putAnimeLibrary = (id: number, input: LibraryInput) => apiRequest<AnimeDetails>(`/api/anime/${id}/library`, { method: 'PUT', body: JSON.stringify(input) })
export const removeAnimeLibrary = (id: number) => apiRequest<void>(`/api/anime/${id}/library`, { method: 'DELETE' })
export const createAnimeSeason = (id: number, seasonNumber: number) => apiRequest<AnimeDetails>(`/api/anime/${id}/seasons`, { method: 'POST', body: JSON.stringify({ seasonNumber, title: null, releaseYear: null }) })
export const createAnimeEpisode = (seasonId: number, episodeNumber: number, title: string) => apiRequest<AnimeDetails>(`/api/anime/seasons/${seasonId}/episodes`, { method: 'POST', body: JSON.stringify({ episodeNumber, title, durationMinutes: null, releaseDate: null }) })
export const watchAnimeEpisode = (episodeId: number) => apiRequest<AnimeDetails>(`/api/anime/episodes/${episodeId}/watches`, { method: 'POST', body: JSON.stringify({ watchedAt: null }) })
