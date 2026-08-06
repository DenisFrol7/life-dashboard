import { apiRequest, ApiClientError } from './client'
import type { LibraryStatus, ReleaseStatus } from './movies'

export type Game = { id: number; title: string; originalTitle: string | null; itemType: 'GAME'; format: null; releaseYear: number | null; description: string | null; coverUrl: string | null; durationMinutes: null; releaseStatus: ReleaseStatus }
export type GameInput = Omit<Game, 'id'>
export type Reference = { id: number; code: string; name: string; type: 'DIGITAL_STORE' | 'PHYSICAL' | 'SUBSCRIPTION' | null }
export type AccessType = 'OWNED' | 'SUBSCRIPTION'
export type GameLibrary = { id: number; contentId: number; title: string; platform: Reference; source: Reference; accessType: AccessType; edition: string | null; acquiredAt: string | null; note: string | null; status: LibraryStatus; rating: number | null; favorite: boolean; startedAt: string | null; completedAt: string | null; personalNote: string | null }
export type GameLibraryInput = Omit<GameLibrary, 'id' | 'contentId' | 'title' | 'platform' | 'source'> & { platformId: number; sourceId: number }
export type XboxProgress = { id: number; libraryEntryId: number; totalAchievements: number; unlockedAchievements: number; achievementPercent: number; totalGamerscore: number; earnedGamerscore: number; gamerscorePercent: number; lastUpdatedAt: string }
export type XboxProgressInput = Pick<XboxProgress, 'totalAchievements' | 'unlockedAchievements' | 'totalGamerscore' | 'earnedGamerscore'>

export const getGameCatalog = () => apiRequest<Game[]>('/api/content?type=GAME')
export const createGame = (input: GameInput) => apiRequest<Game>('/api/content', { method: 'POST', body: JSON.stringify(input) })
export const updateGame = (id: number, input: GameInput) => apiRequest<Game>(`/api/content/${id}`, { method: 'PUT', body: JSON.stringify(input) })
export const deleteGame = (id: number) => apiRequest<void>(`/api/content/${id}`, { method: 'DELETE' })
export const getPlatforms = () => apiRequest<Reference[]>('/api/games/platforms')
export const getSources = () => apiRequest<Reference[]>('/api/games/sources')
export const getGameLibrary = () => apiRequest<GameLibrary[]>('/api/games/library')
export const createGameLibrary = (contentId: number, input: GameLibraryInput) => apiRequest<GameLibrary>(`/api/games/library/${contentId}`, { method: 'POST', body: JSON.stringify(input) })
export const updateGameLibrary = (id: number, input: GameLibraryInput) => apiRequest<GameLibrary>(`/api/games/library/${id}`, { method: 'PUT', body: JSON.stringify(input) })
export const deleteGameLibrary = (id: number) => apiRequest<void>(`/api/games/library/${id}`, { method: 'DELETE' })
export const getXboxProgress = async (libraryId: number) => { try { return await apiRequest<XboxProgress>(`/api/games/library/${libraryId}/xbox-progress`) } catch (error) { if (error instanceof ApiClientError && error.payload.status === 404) return null; throw error } }
export const putXboxProgress = (libraryId: number, input: XboxProgressInput) => apiRequest<XboxProgress>(`/api/games/library/${libraryId}/xbox-progress`, { method: 'PUT', body: JSON.stringify(input) })
