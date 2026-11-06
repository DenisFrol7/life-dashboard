import { useLayoutEffect, useRef, useState } from 'react'
import { useToast } from '../components/ToastContext'
import { useCurrentCallback } from './useCurrentCallback'
import { useFormMutation } from './useFormMutation'

export function usePageMutation(context: string, onChanged: () => Promise<void>, blocked: boolean) {
  const mutations = useFormMutation()
  const refresh = useCurrentCallback(onChanged)
  const { showToast } = useToast()
  const [error, setError] = useState<string | null>(null)
  const scope = useRef({ context })
  useLayoutEffect(() => {
    if (scope.current.context !== context) {
      scope.current = { context }
      setError(null)
    }
  }, [context])
  const disabled = mutations.pending || blocked

  return {
    disabled,
    pending: mutations.pending,
    error,
    refresh,
    async run(kind: 'save' | 'delete', operation: () => Promise<boolean>, fallback: string, successMessage?: string) {
      if (disabled) return false
      const submittedScope = scope.current
      let changed = false
      setError(null)
      await mutations.run(kind, operation, {
        onSuccess: (result) => {
          changed = result
          if (!result) return
          if (scope.current === submittedScope && successMessage) showToast(successMessage)
          void refresh()
        },
        onError: (reason) => {
          if (scope.current === submittedScope) setError(reason instanceof Error ? reason.message : fallback)
        },
      })
      return changed
    },
  }
}
