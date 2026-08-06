import { useCallback, useEffect, useState } from 'react'
import { getActivityRange } from '../api/activity'
import { getCalendarEvents, getOccurrences, type CalendarEvent } from '../api/calendar'
import { getHabits, getHabitEntries } from '../api/habits'
import { getJournalEntries } from '../api/journal'
import { getMediaTimeline } from '../api/mediaTimeline'
import { getSleepSessions } from '../api/sleep'
import { getGameSessions } from '../api/games'

type Kind = 'activity' | 'sleep' | 'habit' | 'calendar' | 'media' | 'game' | 'blog'
type Item = { id: string; kind: Kind; time: string | null; title: string; detail: string; value?: string; durationMinutes?: number; completed?: boolean }
const today = new Date().toLocaleDateString('en-CA')
const labels: Record<Kind, string> = { activity: 'Активность', sleep: 'Сон', habit: 'Привычка', calendar: 'Календарь', media: 'Просмотр', game: 'Игра', blog: 'Блог' }
const icons: Record<Kind, string> = { activity: '↗', sleep: '☾', habit: '✓', calendar: '□', media: '▶', game: '◆', blog: '✎' }
const calendarLabels = { EVENT: 'Событие', TASK: 'Задача', REMINDER: 'Напоминание' }
const asDate = (value: string) => new Date(`${value}T12:00:00`)
const occursOn = (event: CalendarEvent, date: string) => {
  if (date < event.startDate || event.repeatUntil && date > event.repeatUntil) return false
  const day = asDate(date).getDay() || 7
  if (event.scheduleType === 'ONCE') return date === event.startDate
  if (event.scheduleType === 'DAILY') return true
  if (event.scheduleType === 'SELECTED_DAYS') return event.scheduleDays.includes(day)
  return Math.round((asDate(date).getTime() - asDate(event.startDate).getTime()) / 86_400_000) % 7 === 0
}
const dayRange = (date: string) => { const from = new Date(`${date}T00:00:00`); const to = new Date(from); to.setDate(to.getDate() + 1); return { from: from.toISOString(), to: to.toISOString() } }
const duration = (minutes: number) => `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`

export function TimelinePage() {
  const [date, setDate] = useState(today)
  const [items, setItems] = useState<Item[]>([])
  const [filters, setFilters] = useState<Kind[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const range = dayRange(date)
      const [activity, sleep, habits, calendar, blog, media, gameSessions] = await Promise.all([
        getActivityRange(date, date), getSleepSessions(range.from, range.to), getHabits('ACTIVE'),
        getCalendarEvents(), getJournalEntries({ from: date, to: date }), getMediaTimeline(date),
        getGameSessions(range.from, range.to),
      ])
      const habitData = await Promise.all(habits.map(async (habit) => ({ habit, entries: await getHabitEntries(habit.id) })))
      const calendarData = await Promise.all(calendar.map(async (event) => ({ event, occurrences: await getOccurrences(event.id) })))
      const result: Item[] = []
      activity.forEach((entry) => result.push({ id: `activity-${entry.id}`, kind: 'activity', time: null, title: 'Дневная активность', detail: `${entry.steps?.toLocaleString('ru-RU') ?? '—'} шагов · ${entry.distanceMeters == null ? '—' : `${(entry.distanceMeters / 1000).toFixed(2)} км`}`, value: entry.note ?? undefined }))
      sleep.forEach((session) => { const minutes = Math.max(0, Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60_000) - (session.awakeMinutes ?? 0)); result.push({ id: `sleep-${session.id}`, kind: 'sleep', time: new Date(session.endedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), title: `Сон — ${duration(minutes)}`, detail: `Заснул в ${new Date(session.startedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}${session.qualityRating ? ` · качество ${session.qualityRating}/5` : ''}` }) })
      habitData.forEach(({ habit, entries }) => { const entry = entries.find((item) => item.entryDate === date); if (entry) result.push({ id: `habit-${entry.id}`, kind: 'habit', time: null, title: habit.name, detail: entry.skipped ? 'Пропущено' : habit.trackingType === 'BOOLEAN' ? 'Выполнено' : `${entry.value ?? 0} ${habit.unit ?? ''}`, completed: !entry.skipped }) })
      calendarData.forEach(({ event, occurrences }) => { if (!occursOn(event, date)) return; const occurrence = occurrences.find((item) => item.occurrenceDate === date); if (occurrence?.status === 'CANCELLED' || occurrence?.status === 'SKIPPED') return; result.push({ id: `calendar-${event.id}`, kind: 'calendar', time: event.startTime?.slice(0, 5) ?? null, title: event.title, detail: `${calendarLabels[event.eventType]}${event.location ? ` · ${event.location}` : ''}`, completed: occurrence?.status === 'COMPLETED' }) })
      media.forEach((entry) => result.push({ id: entry.id, kind: 'media', time: new Date(entry.occurredAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), title: entry.title, detail: entry.detail, value: entry.durationMinutes ? duration(entry.durationMinutes) : undefined }))
      gameSessions.forEach((session) => { const progress = [session.unlockedAchievements ? `${session.unlockedAchievements} достиж.` : '', session.earnedGamerscore ? `${session.earnedGamerscore} G` : ''].filter(Boolean).join(' · '); result.push({ id: `game-${session.id}`, kind: 'game', time: new Date(session.startedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }), title: session.title, detail: [progress, session.note].filter(Boolean).join(' · ') || 'Игровая сессия', value: duration(session.durationMinutes), durationMinutes: session.durationMinutes }) })
      blog.forEach((entry) => result.push({ id: `blog-${entry.id}`, kind: 'blog', time: null, title: entry.title ?? 'Запись без заголовка', detail: entry.content.length > 100 ? `${entry.content.slice(0, 100)}…` : entry.content }))
      result.sort((a, b) => (a.time ?? '23:59').localeCompare(b.time ?? '23:59'))
      setItems(result)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось собрать ленту дня') }
    finally { setLoading(false) }
  }, [date])
  useEffect(() => { void load() }, [load])

  const visible = filters.length ? items.filter((item) => filters.includes(item.kind)) : items
  const toggle = (kind: Kind) => setFilters((current) => current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind])
  const shift = (days: number) => { const next = asDate(date); next.setDate(next.getDate() + days); setDate(next.toLocaleDateString('en-CA')) }
  return <div className="timeline-page">
    <section className="timeline-toolbar"><div><button onClick={() => shift(-1)}>‹</button><input max={today} type="date" value={date} onChange={(event) => setDate(event.target.value)} /><button disabled={date >= today} onClick={() => shift(1)}>›</button></div>{date !== today && <button className="today-button" onClick={() => setDate(today)}>Сегодня</button>}</section>
    <section className="timeline-filters">{(Object.keys(labels) as Kind[]).map((kind) => <button className={filters.includes(kind) ? `active ${kind}` : kind} key={kind} onClick={() => toggle(kind)}><span>{icons[kind]}</span>{labels[kind]}</button>)}</section>
    {error && <div className="notice error timeline-error"><strong>Ошибка</strong><span>{error}</span></div>}
    <section className="timeline-layout"><aside className="day-summary"><p className="eyebrow">Итоги дня</p><strong>{items.length}</strong><span>событий в ленте</span><dl>{(Object.keys(labels) as Kind[]).map((kind) => <div key={kind}><dt>{labels[kind]}</dt><dd>{items.filter((item) => item.kind === kind).length}</dd></div>)}</dl><div className="games-later"><span>◆</span><p><strong>Игровое время</strong>{duration(items.reduce((sum, item) => sum + (item.kind === 'game' ? item.durationMinutes ?? 0 : 0), 0))}</p></div></aside>
      <div className="timeline-feed">{loading ? <div className="loading"><span />Собираем события дня…</div> : visible.length === 0 ? <div className="timeline-empty"><span>○</span><h2>Спокойный день</h2><p>За выбранную дату событий не найдено.</p></div> : visible.map((item) => <article className={item.kind} key={item.id}><div className="timeline-time">{item.time ?? 'За день'}</div><span className="timeline-icon">{icons[item.kind]}</span><div className="timeline-copy"><small>{labels[item.kind]}</small><h3>{item.title}</h3><p>{item.detail}</p></div>{item.value && <strong className="timeline-value">{item.value}</strong>}{item.completed && <span className="timeline-done">✓</span>}</article>)}</div>
    </section>
  </div>
}
