import { apiRequest } from './client'

export async function checkBackend(signal: AbortSignal): Promise<void> {
  const response = await apiRequest<{ status: string } | null>('/api/health', { signal, cache: 'no-store' })
  if (response?.status !== 'UP') throw new Error('Backend недоступен')
}
