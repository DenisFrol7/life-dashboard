import { useCallback, useEffect, useState } from 'react'
import { getApiErrorMessage } from '../api/client'
import { getTimeline, type TimelineItem as Item, type TimelineKind as Kind } from '../api/timeline'
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState'
import { CalendarDays, Check, ChevronLeft, ChevronRight, Film, Footprints, Gamepad2, Moon, NotebookPen, Repeat2, type LucideIcon } from 'lucide-react'

const today = new Date().toLocaleDateString('en-CA')
const labels: Record<Kind, string> = { activity: 'Активность', sleep: 'Сон', habit: 'Привычка', calendar: 'Календарь', media: 'Просмотр', game: 'Игра', blog: 'Блог' }
const icons: Record<Kind, LucideIcon> = { activity: Footprints, sleep: Moon, habit: Repeat2, calendar: CalendarDays, media: Film, game: Gamepad2, blog: NotebookPen }
const asDate = (value: string) => new Date(`${value}T12:00:00`)
const duration = (minutes: number) => `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`

export function TimelinePage() {
  const [date, setDate] = useState(today)
  const [items, setItems] = useState<Item[]>([])
  const [filters, setFilters] = useState<Kind[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setItems(await getTimeline(date)) }
    catch (reason) { setError(getApiErrorMessage(reason, 'Не удалось собрать ленту дня.')) }
    finally { setLoading(false) }
  }, [date])
  useEffect(() => { void load() }, [load])

  const visible = filters.length ? items.filter((item) => filters.includes(item.kind)) : items
  const toggle = (kind: Kind) => setFilters((current) => current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind])
  const shift = (days: number) => { const next = asDate(date); next.setDate(next.getDate() + days); setDate(next.toLocaleDateString('en-CA')) }

  return <div className="timeline-page">
    <section className="timeline-toolbar"><div><button aria-label="Предыдущий день" onClick={() => shift(-1)}><ChevronLeft /></button><input max={today} type="date" value={date} onChange={(event) => setDate(event.target.value)} /><button aria-label="Следующий день" disabled={date >= today} onClick={() => shift(1)}><ChevronRight /></button></div>{date !== today && <button className="today-button" onClick={() => setDate(today)}>Сегодня</button>}</section>
    <section className="timeline-filters">{(Object.keys(labels) as Kind[]).map((kind) => { const Icon = icons[kind]; return <button className={filters.includes(kind) ? `active ${kind}` : kind} key={kind} onClick={() => toggle(kind)}><span><Icon /></span>{labels[kind]}</button> })}</section>
    <section className="timeline-layout">
      <aside className="day-summary"><p className="eyebrow">Итоги дня</p><strong>{items.length}</strong><span>событий в ленте</span><dl>{(Object.keys(labels) as Kind[]).map((kind) => <div key={kind}><dt>{labels[kind]}</dt><dd>{items.filter((item) => item.kind === kind).length}</dd></div>)}</dl><div className="games-later"><span><Gamepad2 /></span><p><strong>Игровое время</strong>{duration(items.reduce((sum, item) => sum + (item.kind === 'game' ? item.durationMinutes ?? 0 : 0), 0))}</p></div></aside>
      <div className="timeline-feed">{loading
        ? <LoadingState message="Собираем события дня…" />
        : error
          ? <ErrorState title="Не удалось загрузить журнал" message={error} onRetry={() => void load()} />
          : visible.length === 0
            ? <EmptyState title="Спокойный день" message="За выбранную дату событий не найдено." />
            : visible.map((item) => { const Icon = icons[item.kind]; return <article className={item.kind} key={item.id}><div className="timeline-time">{item.time ?? 'За день'}</div><span className="timeline-icon"><Icon /></span><div className="timeline-copy"><small>{labels[item.kind]}</small><h3>{item.title}</h3><p>{item.detail}</p></div>{item.value && <strong className="timeline-value">{item.value}</strong>}{item.completed && <span className="timeline-done"><Check /></span>}</article> })}</div>
    </section>
  </div>
}
