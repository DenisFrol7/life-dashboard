export const localDate = (date: Date = new Date()) =>
  `${date.getFullYear().toString().padStart(4, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`

export function millisecondsUntilNextDay(now: Date) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return Math.max(1, next.getTime() - now.getTime())
}

type DayWatcherOptions = {
  now?: () => Date
  schedule?: (callback: () => void, delay: number) => number
  cancel?: (timer: number) => void
  focusTarget?: EventTarget
  visibilityTarget?: EventTarget & { readonly visibilityState: string }
}

export function watchLocalDay(onDay: (date: string) => void, options: DayWatcherOptions = {}) {
  const now = options.now ?? (() => new Date())
  const schedule = options.schedule ?? ((callback, delay) => window.setTimeout(callback, delay))
  const cancel = options.cancel ?? ((timer) => window.clearTimeout(timer))
  const focusTarget = options.focusTarget ?? window
  const visibilityTarget = options.visibilityTarget ?? document
  let timer: number | undefined
  let stopped = false

  const update = () => {
    if (stopped) return
    if (timer !== undefined) cancel(timer)
    const current = now()
    onDay(localDate(current))
    // The minute check also handles a changed system clock or timezone while the tab stays open.
    timer = schedule(update, Math.min(millisecondsUntilNextDay(current), 60_000))
  }
  const onVisibility = () => {
    if (visibilityTarget.visibilityState === 'visible') update()
  }
  focusTarget.addEventListener('focus', update)
  visibilityTarget.addEventListener('visibilitychange', onVisibility)
  update()

  return () => {
    stopped = true
    if (timer !== undefined) cancel(timer)
    focusTarget.removeEventListener('focus', update)
    visibilityTarget.removeEventListener('visibilitychange', onVisibility)
  }
}
