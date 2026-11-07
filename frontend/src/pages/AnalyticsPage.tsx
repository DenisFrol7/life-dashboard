import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { getAnalytics, type Analytics, type AnalyticsDailyPoint, type AnalyticsOverview } from '../api/analytics'
import { getApiErrorMessage } from '../api/client'
import { useToday } from '../hooks/useToday'
import { useLatestRequest } from '../hooks/useLatestRequest'
import { localDate } from '../utils/localDay'
import './AnalyticsPage.css'

type Period = 7 | 30 | 365
type ChartPoint = { key: string; label: string; tooltipLabel: string; steps: number; sleepMinutes: number; gameMinutes: number }
const dateLabel = (date: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`))
const dayLabel = (date: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric' }).format(new Date(`${date}T12:00:00`))
const duration = (minutes: number) => `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`
const number = (value: number) => value.toLocaleString('ru-RU')

function periodDates(days: Period, today: string) { const start = new Date(`${today}T12:00:00`); start.setDate(start.getDate() - days + 1); return { from: localDate(start), to: today } }
function delta(current: number, previous: number) { if (previous === 0) return current === 0 ? null : 100; return Math.round((current - previous) / previous * 100) }

export function AnalyticsPage() {
  const today = useToday()
  const requests = useLatestRequest()
  const [period, setPeriod] = useState<Period | 'custom' | 'all'>(30)
  const [custom, setCustom] = useState(() => periodDates(30, today))
  const range = typeof period === 'number' ? periodDates(period, today) : period === 'all' ? { from: custom.from, to: today } : custom
  const { from, to } = range
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => requests.run(() => getAnalytics(from, to, period === 'all'), {
    onStart: () => { setLoading(true); setError(null) },
    onSuccess: setAnalytics,
    onError: (reason) => setError(getApiErrorMessage(reason, 'Не удалось загрузить статистику')),
    onFinish: () => setLoading(false),
  }), [from, to, period, requests])
  useEffect(() => { void load(); return () => requests.invalidate() }, [load, requests])
  const choosePeriod = (value: Period) => setPeriod(value)
  const chooseAllTime = () => setPeriod('all')
  const chooseFrom = (value: string) => { setCustom({ from: value, to: period === 'all' && analytics ? analytics.to : to }); setPeriod('custom') }
  const chooseTo = (value: string) => { setCustom({ from: period === 'all' && analytics ? analytics.from : from, to: value }); setPeriod('custom') }
  const chart = useMemo(() => analytics ? chartPoints(analytics.daily) : [], [analytics])

  return <div className="analytics-page">
    <section className="analytics-toolbar">
      <div className="filter-tabs" role="group" aria-label="Период статистики">
        {([7, 30, 365] as Period[]).map(value => <button type="button" key={value}
          className={period === value ? 'active' : ''} aria-pressed={period === value}
          onClick={() => choosePeriod(value)}>{value === 7 ? '7 дней' : value === 30 ? '30 дней' : 'Год'}</button>)}
        <button type="button" className={period === 'all' ? 'active' : ''} aria-pressed={period === 'all'}
          onClick={chooseAllTime}>Всё время</button>
      </div>
      <div className="analytics-dates">
        <label>С<input type="date" value={period === 'all' && analytics ? analytics.from : from} max={to} onChange={event => chooseFrom(event.target.value)} /></label>
        <label>По<input type="date" value={period === 'all' && analytics ? analytics.to : to} min={period === 'all' && analytics ? analytics.from : from} onChange={event => chooseTo(event.target.value)} /></label>
      </div>
    </section>
    {error && <div className="notice error"><strong>Ошибка</strong><span>{error}</span></div>}
    {loading ? <div className="loading"><span />Собираем статистику…</div> : analytics && <>
      <section className="analytics-summary">
        <MetricCard label="Шаги" value={number(analytics.current.totalSteps)} detail={`${analytics.current.activeDays} активных дней · ${(analytics.current.distanceMeters / 1000).toFixed(1)} км`} change={delta(analytics.current.totalSteps, analytics.previous.totalSteps)} />
        <MetricCard label="Средний сон" value={duration(analytics.current.averageSleepMinutes)} detail={analytics.current.averageSleepQuality ? `Качество ${analytics.current.averageSleepQuality} из 5` : 'Без оценок качества'} change={delta(analytics.current.averageSleepMinutes, analytics.previous.averageSleepMinutes)} />
        <MetricCard label="Привычки" value={`${analytics.current.habitCompletionPercent}%`} detail={`${analytics.current.completedHabitEntries} из ${analytics.current.trackedHabitEntries} отметок`} change={delta(analytics.current.habitCompletionPercent, analytics.previous.habitCompletionPercent)} />
        <MetricCard label="Игровое время" value={duration(analytics.current.gameMinutes)} detail={`${analytics.current.gameSessions} сессий · +${analytics.current.unlockedAchievements} достиж.`} change={delta(analytics.current.gameMinutes, analytics.previous.gameMinutes)} />
      </section>
      <section className="analytics-chart-card"><div className="panel-heading"><div><p className="eyebrow">Динамика</p><h2>Шаги</h2></div><span>цель 7 000</span></div><BarChart points={chart} field="steps" label="Шаги" goal={7000} /></section>
      <section className="analytics-lower-grid">
        <article className="analytics-chart-card"><div className="panel-heading"><div><p className="eyebrow">Восстановление</p><h2>Сон</h2></div></div><BarChart points={chart} field="sleepMinutes" label="Сон" goal={480} /></article>
        <article className="analytics-chart-card"><div className="panel-heading"><div><p className="eyebrow">Досуг</p><h2>Игровое время</h2></div></div><BarChart points={chart} field="gameMinutes" label="Игровое время" /></article>
      </section>
      <section className="analytics-detail-grid"><MediaStats data={analytics.current} /><ReadingStats data={analytics.current} /></section>
    </>}
  </div>
}

function MetricCard({ label, value, detail, change }: { label: string; value: string; detail: string; change: number | null }) { return <article className="analytics-metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small><em className={change != null && change < 0 ? 'negative' : ''}>{change == null ? 'Нет данных для сравнения' : `${change > 0 ? '+' : ''}${change}% к прошлому периоду`}</em></article> }
function BarChart({ points, field, label, goal }: {
  points: ChartPoint[]
  field: keyof Pick<ChartPoint, 'steps' | 'sleepMinutes' | 'gameMinutes'>
  label: string
  goal?: number
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [scrollable, setScrollable] = useState(false)
  const selected = points.find(point => point.key === selectedKey) ?? points.at(-1)
  const maximum = Math.max(goal ?? 0, ...points.map(point => point[field]), 1)
  const formatValue = (value: number) => field === 'steps' ? number(value) : duration(value)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const measure = () => setScrollable(viewport.scrollWidth > viewport.clientWidth + 1)
    measure()
    // Start with the latest dates, matching the initially selected value.
    viewport.scrollLeft = viewport.scrollWidth
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [points.length])

  if (!selected) return <p className="analytics-chart-empty">За выбранный период нет данных.</p>

  return <div className="analytics-chart" role="group" aria-label={`${label} по датам`}>
    <output className="analytics-chart-readout" aria-live="polite" aria-atomic="true">
      <span>{selected.tooltipLabel}</span><strong>{formatValue(selected[field])}</strong>
    </output>
    <div className="analytics-chart-scroll" ref={viewportRef}>
      <div className="analytics-bars" data-monthly={points[0]?.key.length === 7}
        style={{ '--analytics-point-count': points.length } as CSSProperties}>
        {points.map(point => {
          const height = Math.max(point[field] ? 4 : 1, point[field] / maximum * 100)
          const description = `${point.tooltipLabel}: ${formatValue(point[field])}`
          return <button type="button" key={point.key} title={description} aria-label={description}
            aria-pressed={selected.key === point.key} onClick={() => setSelectedKey(point.key)}
            onFocus={() => setSelectedKey(point.key)}>
            <span className="analytics-bar-track" aria-hidden="true">
              <i className={goal && point[field] >= goal ? 'goal' : ''} style={{ height: `${height}%` }} />
            </span>
            <small aria-hidden="true">{point.label}</small>
          </button>
        })}
      </div>
    </div>
    <p className="analytics-chart-hint">{scrollable ? 'Листайте график и выбирайте дату для подробностей.' : 'Выберите дату на графике для подробностей.'}</p>
  </div>
}
function MediaStats({ data }: { data: AnalyticsOverview }) { return <article className="analytics-detail-card"><p className="eyebrow">Медиатека</p><h2>Просмотрено</h2><dl><div><dt>Фильмы</dt><dd>{data.moviesWatched}</dd></div><div><dt>Эпизоды сериалов</dt><dd>{data.seriesEpisodesWatched}</dd></div><div><dt>Эпизоды аниме</dt><dd>{data.animeEpisodesWatched}</dd></div></dl></article> }
function ReadingStats({ data }: { data: AnalyticsOverview }) { return <article className="analytics-detail-card"><p className="eyebrow">Книги</p><h2>Чтение</h2><dl><div><dt>Прочитано страниц</dt><dd>{number(data.pagesRead)}</dd></div><div><dt>Время чтения</dt><dd>{duration(data.readingMinutes)}</dd></div></dl></article> }

function chartPoints(daily: AnalyticsDailyPoint[]): ChartPoint[] {
  if (daily.length <= 60) return daily.map(point => ({ key: point.date, label: dayLabel(point.date), tooltipLabel: dateLabel(point.date), steps: point.steps, sleepMinutes: point.sleepMinutes, gameMinutes: point.gameMinutes }))
  const months = new Map<string, ChartPoint & { days: number; sleepDays: number }>()
  daily.forEach(point => { const key = point.date.slice(0, 7); const label = new Intl.DateTimeFormat('ru-RU', { month: 'short', year: 'numeric' }).format(new Date(`${key}-15T12:00:00`)); const current = months.get(key) ?? { key, label, tooltipLabel: label, steps: 0, sleepMinutes: 0, gameMinutes: 0, days: 0, sleepDays: 0 }; current.steps += point.steps; current.days++; current.gameMinutes += point.gameMinutes; if (point.sleepSessions) { current.sleepMinutes += point.sleepMinutes; current.sleepDays++ } months.set(key, current) })
  return [...months.values()].map(point => ({ key: point.key, label: point.label, tooltipLabel: point.tooltipLabel, steps: Math.round(point.steps / point.days), sleepMinutes: point.sleepDays ? Math.round(point.sleepMinutes / point.sleepDays) : 0, gameMinutes: point.gameMinutes }))
}
