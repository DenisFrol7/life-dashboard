import { apiRequest } from './client'

export type ContentFormat = 'LIVE_ACTION' | 'ANIMATION'
export type ReleaseStatus = 'ANNOUNCED' | 'ONGOING' | 'RELEASED' | 'ENDED' | 'CANCELLED'
export type LibraryStatus = 'NOT_STARTED' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED' | 'DROPPED'
export type Movie = { id: number; title: string; originalTitle: string | null; itemType: 'MOVIE'; format: ContentFormat; releaseYear: number | null; description: string | null; coverUrl: string | null; durationMinutes: number | null; releaseStatus: ReleaseStatus; genre: string | null; developer: string | null; releaseDate: string | null; xboxPlayAnywhere: boolean }
export type MovieInput = Omit<Movie, 'id'>
export type LibraryEntry = { id: number; content: Movie; status: LibraryStatus; rating: number | null; favorite: boolean; startedAt: string | null; completedAt: string | null; personalNote: string | null }
export type LibraryInput = Omit<LibraryEntry, 'id' | 'content'>
export type Watch = { id: number; targetId: number; watchedAt: string; watchNumber: number }

export const getMovies = () => apiRequest<Movie[]>('/api/content?type=MOVIE')
export const getMovie = (id: number) => apiRequest<Movie>(`/api/content/${id}`)
export const createMovie = (input: MovieInput) => apiRequest<Movie>('/api/content', { method: 'POST', body: JSON.stringify(input) })
export const updateMovie = (id: number, input: MovieInput) => apiRequest<Movie>(`/api/content/${id}`, { method: 'PUT', body: JSON.stringify(input) })
export const deleteMovie = (id: number) => apiRequest<void>(`/api/content/${id}`, { method: 'DELETE' })
export const getLibrary = () => apiRequest<LibraryEntry[]>('/api/library')
export const putInLibrary = (contentId: number, input: LibraryInput) => apiRequest<LibraryEntry>(`/api/library/${contentId}`, { method: 'PUT', body: JSON.stringify(input) })
export const removeFromLibrary = (contentId: number) => apiRequest<void>(`/api/library/${contentId}`, { method: 'DELETE' })
export const getMovieWatches = (contentId: number) => apiRequest<Watch[]>(`/api/content/${contentId}/watches`)
export const watchMovie = (contentId: number, watchedAt?: string) => apiRequest<Watch>(`/api/content/${contentId}/watches`, { method: 'POST', body: JSON.stringify({ watchedAt: watchedAt ?? null }) })
export const updateMovieWatch = (watchId: number, watchedAt: string) => apiRequest<Watch>(`/api/content/watches/${watchId}`, { method: 'PUT', body: JSON.stringify({ watchedAt }) })
export const deleteMovieWatch = (watchId: number) => apiRequest<void>(`/api/content/watches/${watchId}`, { method: 'DELETE' })
