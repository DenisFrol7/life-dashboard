export type MutationCallbacks<T> = {
  onSuccess: (value: T) => void
  onError: (reason: unknown) => void
}

type MutationLifecycle<T> = MutationCallbacks<T> & {
  onStart?: () => void
  onFinish?: () => void
}

export function createFormMutation() {
  let active = true
  let generation = 0
  let running = false

  return {
    async run<T>(operation: () => Promise<T>, callbacks: MutationLifecycle<T>): Promise<void> {
      // Lock synchronously: React has not necessarily rendered a disabled button yet.
      if (!active || running) return
      running = true
      const startedGeneration = generation
      const isCurrent = () => active && generation === startedGeneration
      try {
        callbacks.onStart?.()
        const result = await operation()
        if (isCurrent()) callbacks.onSuccess(result)
      } catch (reason) {
        if (isCurrent()) callbacks.onError(reason)
      } finally {
        running = false
        if (isCurrent()) callbacks.onFinish?.()
      }
    },
    dispose() {
      active = false
      generation++
    },
    activate() {
      active = true
    },
  }
}
