import { useState } from 'react'
import { clearSeasonWatches, watchEpisode, type Season } from '../api/series'
import { useFormMutation } from './useFormMutation'

export function useViewingActions(onChanged: () => void, formOpen: boolean) {
  const mutations = useFormMutation()
  const [error, setError] = useState<string | null>(null)
  const disabled = mutations.pending || formOpen

  return {
    disabled,
    pending: mutations.pending,
    deleting: mutations.deleting,
    error,
    async markEpisode(id: number) {
      if (disabled) return
      setError(null)
      await mutations.run('save', () => watchEpisode(id), {
        onSuccess: onChanged,
        onError: (reason) => setError(reason instanceof Error ? reason.message : 'Не удалось отметить эпизод'),
      })
    },
    async clearSeason(season: Season) {
      if (disabled) return
      setError(null)
      await mutations.run('delete', async () => {
        if (!window.confirm(`Снять все отметки просмотра с сезона ${season.seasonNumber}?`)) return false
        await clearSeasonWatches(season.id)
        return true
      }, {
        onSuccess: (cleared) => { if (cleared) onChanged() },
        onError: (reason) => setError(reason instanceof Error ? reason.message : 'Не удалось снять отметки'),
      })
    },
  }
}
