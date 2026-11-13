import { useCallback, useEffect, useState } from 'react'
import { getApiErrorMessage } from '../api/client'
import { getTimeline, type TimelineItem as Item, type TimelineKind as Kind } from '../api/timeline'
import { EmptyState, ErrorState, LoadingState } from '../components/AsyncState'
import { useDateSelection } from '../hooks/useDateSelection'
import { useLatestRequest } from '../hooks/useLatestRequest'
import { localDate } from '../utils/localDay'
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Film, Footprints, Gamepad2, Moon, NotebookPen, Repeat2, type LucideIcon } from 'lucide-react'
import './TimelinePage.css'

const labels: Record<Kind, string> = { activity: 'Активность', sleep: 'Сон', habit: 'Привычка', calendar: 'Календарь', media: 'Просмотр', game: 'Игра', blog: 'Блог' }
const icons: Record<Kind, LucideIcon> = { activity: Footprints, sleep: Moon, habit: Repeat2, calendar: CalendarDays, media: Film, game: Gamepad2, blog: NotebookPen }
const asDate = (value: string) => new Date(`${value}T12:00:00`)
const duration = (minutes: number) => `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`

export function TimelinePage() {
  const { today, date, setDate, selectToday } = useDateSelection()
  const requests = useLatestRequest()
  const [items, setItems] = useState<Item[]>([])
  const [filters, setFilters] = useState<Kind[]>([])
  const [summaryExpanded, setSummaryExpanded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    await requests.run(() => getTimeline(date), {
      onStart: () => { setLoading(true); setError(null) },
      onSuccess: setItems,
      onError: (reason) => setError(getApiErrorMessage(reason, 'Не удалось собрать ленту дня.')),
      onFinish: () => setLoading(false),
    })
  }, [date, requests])
  useEffect(() => { void load(); return () => requests.invalidate() }, [load, requests])

  const visible = filters.length ? items.filter((item) => filters.includes(item.kind)) : items
  const toggle = (kind: Kind) => setFilters((current) => current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind])
  const shift = (days: number) => { const next = asDate(date); next.setDate(next.getDate() + days); setDate(localDate(next)) }
  const ready = !loading && !error
  const formattedDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(asDate(date))

  return <div className="timeline-page">
    <section className="timeline-toolbar" aria-label="Дата журнала"><div className="timeline-date-navigation"><button type="button" aria-label="Предыдущий день" onClick={() => shift(-1)}><ChevronLeft aria-hidden="true" /></button><input aria-label="Дата событий" max={today} type="date" value={date} onChange={event => { const next = event.target.value; if (next && next <= today && event.target.validity.valid) setDate(next) }} /><button type="button" aria-label="Следующий день" disabled={date >= today} onClick={() => shift(1)}><ChevronRight aria-hidden="true" /></button></div>{date !== today && <button type="button" className="timeline-today-button" onClick={selectToday}>Сегодня</button>}</section>
    <section className="timeline-filters" role="group" aria-label="Типы событий">
      <button type="button" className={filters.length === 0 ? 'active' : ''} aria-pressed={filters.length === 0} onClick={() => setFilters([])}>Все</button>
      {(Object.keys(labels) as Kind[]).map((kind) => { const Icon = icons[kind]; return <button type="button" className={filters.includes(kind) ? `active ${kind}` : kind} aria-pressed={filters.includes(kind)} key={kind} onClick={() => toggle(kind)}><span><Icon aria-hidden="true" /></span>{labels[kind]}</button> })}
    </section>
    <section className="timeline-layout">
      <aside className="timeline-summary" aria-labelledby="timeline-summary-title" aria-busy={loading}>
        <p className="eyebrow" id="timeline-summary-title">Итоги дня</p>
        <div className="timeline-summary-overview"><div className="timeline-summary-total"><strong>{ready ? items.length : '—'}</strong><span>событий за день</span></div><div className="timeline-game-time"><Gamepad2 aria-hidden="true" /><div><span>Игровое время</span><strong>{ready ? duration(items.reduce((sum, item) => sum + (item.kind === 'game' ? item.durationMinutes ?? 0 : 0), 0)) : '—'}</strong></div></div></div>
        <button type="button" className="timeline-summary-toggle" aria-expanded={summaryExpanded} aria-controls="timeline-summary-counts" onClick={() => setSummaryExpanded(expanded => !expanded)}>По разделам<ChevronDown aria-hidden="true" /></button>
        <dl className="timeline-summary-counts" id="timeline-summary-counts" data-expanded={summaryExpanded}>{(Object.keys(labels) as Kind[]).map(kind => <div key={kind}><dt>{labels[kind]}</dt><dd>{ready ? items.filter(item => item.kind === kind).length : '—'}</dd></div>)}</dl>
      </aside>
      <div className="timeline-events">
        <div className="timeline-feed-heading"><h2>{formattedDate}</h2><output aria-live="polite" aria-atomic="true">{ready ? filters.length ? `Показано: ${visible.length} из ${items.length}` : `Показано: ${items.length}` : loading ? 'Загружаем события…' : 'События не загружены'}</output></div>
        <div className="timeline-feed" aria-busy={loading}>{loading
        ? <LoadingState message="Собираем события дня…" />
        : error
          ? <ErrorState title="Не удалось загрузить журнал" message={error} onRetry={() => void load()} />
          : visible.length === 0
            ? <div className="timeline-empty-state"><EmptyState title={filters.length && items.length ? 'Нет событий выбранных типов' : 'Спокойный день'} message={filters.length && items.length ? 'Выберите другие типы событий или покажите всю ленту.' : 'За выбранную дату событий не найдено.'} />{filters.length > 0 && <button type="button" className="secondary-button timeline-reset-filters" onClick={() => setFilters([])}>Показать все события</button>}</div>
            : visible.map(item => { const Icon = icons[item.kind]; return <article className={item.kind} key={item.id}><span className="timeline-time">{item.time ?? 'За день'}</span><span className="timeline-icon" aria-hidden="true"><Icon /></span><div className="timeline-copy"><small>{labels[item.kind]}</small><h3>{item.title}</h3>{item.detail && <p>{item.detail}</p>}</div>{(item.value || item.completed) && <div className="timeline-result">{item.value && <strong className="timeline-value">{item.value}</strong>}{item.completed && <span className="timeline-done" role="img" aria-label="Выполнено"><Check aria-hidden="true" /></span>}</div>}</article> })}</div>
      </div>
    </section>
  </div>
}
