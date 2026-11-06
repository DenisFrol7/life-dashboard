export type BackendStatus = 'checking' | 'connected' | 'unavailable'

type StatusWatcherOptions = {
  schedule?: (callback: () => void, delay: number) => number
  cancel?: (timer: number) => void
  events?: EventTarget
  visibility?: EventTarget & { readonly visibilityState: string }
}

type PendingCheck = { controller: AbortController; timeout?: number }

export function watchBackendStatus(
  probe: (signal: AbortSignal) => Promise<void>,
  onStatus: (status: BackendStatus) => void,
  options: StatusWatcherOptions = {},
) {
  const schedule = options.schedule ?? ((callback, delay) => window.setTimeout(callback, delay))
  const cancel = options.cancel ?? ((timer) => window.clearTimeout(timer))
  const events = options.events ?? window
  const visibility = options.visibility ?? document
  let timer: number | undefined
  let pending: PendingCheck | undefined
  let stopped = false

  const clearTimers = () => {
    if (timer !== undefined) cancel(timer)
    if (pending?.timeout !== undefined) cancel(pending.timeout)
    timer = undefined
  }
  const cancelCheck = () => {
    clearTimers()
    const previous = pending
    pending = undefined
    previous?.controller.abort()
  }
  const finish = (request: PendingCheck, status: BackendStatus) => {
    if (stopped || pending !== request) return
    clearTimers()
    pending = undefined
    onStatus(status)
    if (visibility.visibilityState === 'visible') timer = schedule(check, 30_000)
  }
  const check = () => {
    if (stopped || pending || visibility.visibilityState !== 'visible') return
    clearTimers()
    const request: PendingCheck = { controller: new AbortController() }
    pending = request
    request.timeout = schedule(() => {
      finish(request, 'unavailable')
      request.controller.abort()
    }, 5_000)
    try {
      void probe(request.controller.signal).then(
        () => finish(request, 'connected'),
        () => finish(request, 'unavailable'),
      )
    } catch {
      finish(request, 'unavailable')
    }
  }
  const onVisibility = () => {
    if (stopped) return
    if (visibility.visibilityState !== 'visible') cancelCheck()
    else {
      onStatus('checking')
      check()
    }
  }

  events.addEventListener('focus', check)
  // Browser connectivity hints do not establish whether a local backend is reachable.
  events.addEventListener('online', check)
  events.addEventListener('offline', check)
  visibility.addEventListener('visibilitychange', onVisibility)
  onStatus('checking')
  check()

  return () => {
    stopped = true
    cancelCheck()
    events.removeEventListener('focus', check)
    events.removeEventListener('online', check)
    events.removeEventListener('offline', check)
    visibility.removeEventListener('visibilitychange', onVisibility)
  }
}
