type RequestCallbacks<T> = {
  onStart?: () => void
  onSuccess: (value: T) => void
  onError: (reason: unknown) => void
  onFinish?: () => void
}

export function createLatestRequest() {
  let version = 0
  let active = true

  return {
    async run<T>(request: () => Promise<T>, callbacks: RequestCallbacks<T>): Promise<void> {
      if (!active) return
      const requestVersion = ++version
      const isCurrent = () => active && requestVersion === version
      callbacks.onStart?.()
      try {
        const value = await request()
        if (isCurrent()) callbacks.onSuccess(value)
      } catch (reason) {
        if (isCurrent()) callbacks.onError(reason)
      } finally {
        if (isCurrent()) callbacks.onFinish?.()
      }
    },
    invalidate() {
      version++
    },
    dispose() {
      active = false
      version++
    },
    activate() {
      active = true
    },
  }
}
