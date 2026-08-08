import { apiRequest } from './client'
import type { LibraryStatus } from './movies'

export type BookFormat = 'PAPER' | 'EBOOK' | 'AUDIOBOOK'
export type ReadingSession = { id: number; startedAt: string; durationMinutes: number; pagesRead: number; listenedMinutes: number; note: string | null }
export type Book = { id: number; contentId: number; title: string; author: string; bookFormat: BookFormat; pageCount: number | null; durationMinutes: number | null; releaseYear: number | null; genre: string | null; coverUrl: string | null; description: string | null; libraryEntryId: number | null; status: LibraryStatus | null; rating: number | null; favorite: boolean; personalNote: string | null; startedAt: string | null; completedAt: string | null; currentPage: number | null; currentMinute: number | null; progressPercent: number; sessions: ReadingSession[] }
export type BookInput = { title: string; author: string; bookFormat: BookFormat; pageCount: number | null; durationMinutes: number | null; releaseYear: number | null; genre: string | null; coverUrl: string | null; description: string | null }
export type BookLibraryInput = { status: LibraryStatus; rating: number | null; favorite: boolean; startedAt: string | null; completedAt: string | null; personalNote: string | null }
export type ReadingSessionInput = { startedAt: string; durationMinutes: number; pagesRead: number; listenedMinutes: number; note: string | null }

export const getBooks = () => apiRequest<Book[]>('/api/books')
export const getBook = (id: number) => apiRequest<Book>(`/api/books/${id}`)
export const createBook = (input: BookInput) => apiRequest<Book>('/api/books', { method: 'POST', body: JSON.stringify(input) })
export const updateBook = (id: number, input: BookInput) => apiRequest<Book>(`/api/books/${id}`, { method: 'PUT', body: JSON.stringify(input) })
export const deleteBook = (id: number) => apiRequest<void>(`/api/books/${id}`, { method: 'DELETE' })
export const putBookLibrary = (id: number, input: BookLibraryInput) => apiRequest<Book>(`/api/books/${id}/library`, { method: 'PUT', body: JSON.stringify(input) })
export const removeBookLibrary = (id: number) => apiRequest<Book>(`/api/books/${id}/library`, { method: 'DELETE' })
export const putBookProgress = (id: number, currentPage: number | null, currentMinute: number | null) => apiRequest<Book>(`/api/books/${id}/progress`, { method: 'PUT', body: JSON.stringify({ currentPage, currentMinute }) })
export const createReadingSession = (id: number, input: ReadingSessionInput) => apiRequest<ReadingSession>(`/api/books/${id}/sessions`, { method: 'POST', body: JSON.stringify(input) })
export const updateReadingSession = (id: number, input: ReadingSessionInput) => apiRequest<ReadingSession>(`/api/books/sessions/${id}`, { method: 'PUT', body: JSON.stringify(input) })
export const deleteReadingSession = (id: number) => apiRequest<void>(`/api/books/sessions/${id}`, { method: 'DELETE' })
