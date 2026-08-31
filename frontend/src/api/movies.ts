import { apiRequest } from './client'

export type ContentFormat = 'LIVE_ACTION' | 'ANIMATION'
export type ReleaseStatus = 'ANNOUNCED' | 'ONGOING' | 'RELEASED' | 'ENDED' | 'CANCELLED'
export type LibraryStatus = 'NOT_STARTED' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'PAUSED' | 'DROPPED'
export type Movie = { id: number; title: string; originalTitle: string | null; itemType: 'MOVIE'; format: ContentFormat; releaseYear: number | null; description: string | null; coverUrl: string | null; durationMinutes: number | null; releaseStatus: ReleaseStatus; genre: string | null; developer: string | null; releaseDate: string | null; xboxPlayAnywhere: boolean }
export type MovieInput = Omit<Movie, 'id'>
export type LibraryEntry = { id: number; content: Movie; status: LibraryStatus; rating: number | null; favorite: boolean; startedAt: string | null; completedAt: string | null; personalNote: string | null }
export type LibraryInput = Omit<LibraryEntry, 'id' | 'content'>
export type Watch = { id: number; targetId: number; watchedAt: string; watchNumber: number; bulk: boolean }
export type MovieCatalogItem = Omit<Movie, 'itemType' | 'xboxPlayAnywhere'> & { libraryId: number | null; userStatus: LibraryStatus | null; rating: number | null; favorite: boolean; startedAt: string | null; completedAt: string | null; personalNote: string | null; watchCount: number; watchedMinutes: number }
export type MovieCatalogStatistics = { totalMovies: number; inLibrary: number; completed: number; planned: number; liveAction: number; animation: number }
export type MovieCatalogPage = { items: MovieCatalogItem[]; page: number; size: number; totalItems: number; hasMore: boolean; statistics: MovieCatalogStatistics }
export type KinopoiskMovieCandidate = { filmId: number; nameRu: string | null; nameOriginal: string | null; year: string | null; posterUrlPreview: string | null; existingContentId: number | null }
export type KinopoiskMovieDetails = { filmId: number; title: string; originalTitle: string | null; format: ContentFormat; releaseYear: number | null; description: string | null; coverUrl: string | null; durationMinutes: number | null; releaseStatus: ReleaseStatus; genre: string | null; existingContentId: number | null }
export type KinopoiskRatingPreviewItem = { filmId: number; title: string; originalTitle: string | null; year: number | null; userRating: number | null; type: string | null; posterUrlPreview: string | null; genre: string | null; existingContentId: number | null }
export type KinopoiskRatingsPreview = { profileId: string; totalRatings: number; totalPages: number; movieCount: number; seriesCount: number; existingCount: number; newCount: number; movies: KinopoiskRatingPreviewItem[] }
export type KinopoiskRatingsImportResult = { totalMovies: number; created: number; updated: number; skipped: number; backupFile: string }
export type KinopoiskMovieEnrichmentResult = { total: number; updated: number; remaining: number; quotaExhausted: boolean; backupFile: string | null }

export const getMovies = () => apiRequest<Movie[]>('/api/content?type=MOVIE')
export const getMovieCatalog = () => apiRequest<MovieCatalogItem[]>('/api/movies')
export const getMovieCatalogPage = (page = 0, size = 50, query = '', status: LibraryStatus | '' = '') => { const params = new URLSearchParams({ page: String(page), size: String(size) }); if (query.trim()) params.set('query', query.trim()); if (status) params.set('status', status); return apiRequest<MovieCatalogPage>(`/api/movies/page?${params}`) }
export const searchKinopoiskMovies = (query: string) => apiRequest<KinopoiskMovieCandidate[]>(`/api/movies/kinopoisk/search?query=${encodeURIComponent(query)}`)
export const previewKinopoiskMovie = (filmId: number) => apiRequest<KinopoiskMovieDetails>(`/api/movies/kinopoisk/${filmId}`)
export const createKinopoiskMovie = (filmId: number, input: MovieInput) => apiRequest<Movie>(`/api/movies/kinopoisk/${filmId}`, { method: 'POST', body: JSON.stringify(input) })
export const previewKinopoiskRatings = (profileId: string) => apiRequest<KinopoiskRatingsPreview>(`/api/movies/kinopoisk/profile/${encodeURIComponent(profileId)}/ratings`)
export const importKinopoiskRatings = (profileId: string) => apiRequest<KinopoiskRatingsImportResult>(`/api/movies/kinopoisk/profile/${encodeURIComponent(profileId)}/ratings/import`, { method: 'POST' })
export const enrichKinopoiskMovies = (batchSize = 350) => apiRequest<KinopoiskMovieEnrichmentResult>(`/api/movies/kinopoisk/enrich?batchSize=${batchSize}`, { method: 'POST' })
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
