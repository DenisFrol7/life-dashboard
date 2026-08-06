import { apiRequest } from './client'

export type Tag = { id: number; name: string; slug: string }
export type JournalEntry = { id: number; entryDate: string; title: string | null; content: string; pinned: boolean; tags: Tag[] }
export type JournalEntryInput = Pick<JournalEntry, 'entryDate' | 'title' | 'content' | 'pinned'>
export type JournalFilters = { from?: string; to?: string; pinned?: boolean; tag?: string }

export const getJournalEntries = (filters: JournalFilters = {}) => {
  const query = new URLSearchParams()
  if (filters.from) query.set('from', filters.from)
  if (filters.to) query.set('to', filters.to)
  if (filters.pinned != null) query.set('pinned', String(filters.pinned))
  if (filters.tag) query.set('tag', filters.tag)
  return apiRequest<JournalEntry[]>(`/api/journal${query.size ? `?${query}` : ''}`)
}
export const createJournalEntry = (input: JournalEntryInput) => apiRequest<JournalEntry>('/api/journal', { method: 'POST', body: JSON.stringify(input) })
export const updateJournalEntry = (id: number, input: JournalEntryInput) => apiRequest<JournalEntry>(`/api/journal/${id}`, { method: 'PUT', body: JSON.stringify(input) })
export const deleteJournalEntry = (id: number) => apiRequest<void>(`/api/journal/${id}`, { method: 'DELETE' })
export const addJournalTag = (entryId: number, tagId: number) => apiRequest<JournalEntry>(`/api/journal/${entryId}/tags/${tagId}`, { method: 'PUT' })
export const removeJournalTag = (entryId: number, tagId: number) => apiRequest<void>(`/api/journal/${entryId}/tags/${tagId}`, { method: 'DELETE' })
export const getTags = () => apiRequest<Tag[]>('/api/tags')
export const createTag = (name: string, slug: string) => apiRequest<Tag>('/api/tags', { method: 'POST', body: JSON.stringify({ name, slug }) })
