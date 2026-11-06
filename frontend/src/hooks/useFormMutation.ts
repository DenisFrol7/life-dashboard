import { useEffect, useState } from 'react'
import { createFormMutation, type MutationCallbacks } from '../utils/formMutation'

export function useFormMutation() {
  const [mutations] = useState(createFormMutation)
  const [action, setAction] = useState<'save' | 'delete' | null>(null)
  useEffect(() => {
    mutations.activate()
    return () => mutations.dispose()
  }, [mutations])

  return {
    saving: action === 'save',
    deleting: action === 'delete',
    pending: action !== null,
    run<T>(kind: 'save' | 'delete', operation: () => Promise<T>, callbacks: MutationCallbacks<T>) {
      return mutations.run(operation, {
        ...callbacks,
        onStart: () => setAction(kind),
        onFinish: () => setAction(null),
      })
    },
    dispose: () => mutations.dispose(),
  }
}
