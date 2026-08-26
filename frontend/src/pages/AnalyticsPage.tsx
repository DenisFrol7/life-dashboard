import { useCallback, useEffect, useMemo, useState } from 'react'
import { getAnalytics, type Analytics, type AnalyticsDailyPoint, type AnalyticsOverview } from '../api/analytics'
import { getApiErrorMessage } from '../api/client'

type Period = 7 | 30 | 365
type ChartPoint = { label: string; steps: number; sleepMinutes: number; gameMinutes: number }
const localDate = (date: Date) => date.toLocaleDateString('en-CA')
const dateLabel = (date: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`))
const duration = (minutes: number) => `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`
const number = (value: number) => value.toLocaleString('ru-RU')

function periodDates(days: Period) { const end = new Date(); const start = new Date(); start.setDate(end.getDate() - days + 1); return { from: localDate(start), to: localDate(end) } }
function delta(current: number, previous: number) { if (previous === 0) return current === 0 ? null : 100; return Math.round((current - previous) / previous * 100) }

export function AnalyticsPage() {
  const initial = periodDates(30)
  const [period, setPeriod] = useState<Period | 'custom' | 'all'>(30)
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => { setLoading(true); setError(null); try { setAnalytics(await getAnalytics(from, to, period === 'all')) } catch (reason) { setError(getApiErrorMessage(reason, 'Не удалось загрузить статистику')) } finally { setLoading(false) } }, [from, to, period])
  useEffect(() => { void load() }, [load])
  const choosePeriod = (value: Period) => { const dates = periodDates(value); setPeriod(value); setFrom(dates.from); setTo(dates.to) }
  const chooseAllTime = () => { setPeriod('all'); setTo(localDate(new Date())) }
  const chart = useMemo(() => analytics ? chartPoints(analytics.daily) : [], [analytics])

  return <div className="analytics-page">
    <section className="analytics-toolbar"><div className="filter-tabs" aria-label="Период статистики">{([7, 30, 365] as Period[]).map(value => <button key={value} className={period === value ? 'active' : ''} onClick={() => choosePeriod(value)}>{value === 7 ? '7 дней' : value === 30 ? '30 дней' : 'Год'}</button>)}<button className={period === 'all' ? 'active' : ''} onClick={chooseAllTime}>Всё время</button></div><div className="analytics-dates"><label>С<input type="date" value={period === 'all' && analytics ? analytics.from : from} max={to} onChange={event => { setPeriod('custom'); setFrom(event.target.value) }} /></label><label>По<input type="date" value={period === 'all' && analytics ? analytics.to : to} min={period === 'all' && analytics ? analytics.from : from} onChange={event => { if (period === 'all' && analytics) setFrom(analytics.from); setPeriod('custom'); setTo(event.target.value) }} /></label></div></section>
    {error && <div className="notice error"><strong>Ошибка</strong><span>{error}</span></div>}
    {loading ? <div className="loading"><span />Собираем статистику…</div> : analytics && <>
      <section className="analytics-summary">
        <MetricCard label="Шаги" value={number(analytics.current.totalSteps)} detail={`${analytics.current.activeDays} активных дней · ${(analytics.current.distanceMeters / 1000).toFixed(1)} км`} change={delta(analytics.current.totalSteps, analytics.previous.totalSteps)} />
        <MetricCard label="Средний сон" value={duration(analytics.current.averageSleepMinutes)} detail={analytics.current.averageSleepQuality ? `Качество ${analytics.current.averageSleepQuality} из 5` : 'Без оценок качества'} change={delta(analytics.current.averageSleepMinutes, analytics.previous.averageSleepMinutes)} />
        <MetricCard label="Привычки" value={`${analytics.current.habitCompletionPercent}%`} detail={`${analytics.current.completedHabitEntries} из ${analytics.current.trackedHabitEntries} отметок`} change={delta(analytics.current.habitCompletionPercent, analytics.previous.habitCompletionPercent)} />
        <MetricCard label="Игровое время" value={duration(analytics.current.gameMinutes)} detail={`${analytics.current.gameSessions} сессий · +${analytics.current.unlockedAchievements} достиж.`} change={delta(analytics.current.gameMinutes, analytics.previous.gameMinutes)} />
      </section>
      <section className="analytics-chart-card"><div className="panel-heading"><div><p className="eyebrow">Динамика</p><h2>Шаги</h2></div><span>цель 7 000</span></div><BarChart points={chart} field="steps" goal={7000} /></section>
      <section className="analytics-lower-grid">
        <article className="analytics-chart-card"><div className="panel-heading"><div><p className="eyebrow">Восстановление</p><h2>Сон</h2></div></div><BarChart points={chart} field="sleepMinutes" goal={480} /></article>
        <article className="analytics-chart-card"><div className="panel-heading"><div><p className="eyebrow">Досуг</p><h2>Игровое время</h2></div></div><BarChart points={chart} field="gameMinutes" /></article>
      </section>
      <section className="analytics-detail-grid"><MediaStats data={analytics.current} /><ReadingStats data={analytics.current} /></section>
    </>}
  </div>
}

function MetricCard({ label, value, detail, change }: { label: string; value: string; detail: string; change: number | null }) { return <article className="analytics-metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small><em className={change != null && change < 0 ? 'negative' : ''}>{change == null ? 'Нет данных для сравнения' : `${change > 0 ? '+' : ''}${change}% к прошлому периоду`}</em></article> }
function BarChart({ points, field, goal }: { points: ChartPoint[]; field: keyof Pick<ChartPoint, 'steps' | 'sleepMinutes' | 'gameMinutes'>; goal?: number }) { const maximum = Math.max(goal ?? 0, ...points.map(point => point[field]), 1); return <div className="analytics-bars">{points.map(point => <div key={point.label} title={`${point.label}: ${field === 'steps' ? number(point[field]) : duration(point[field])}`}><span>{field === 'steps' ? (point[field] ? number(point[field]) : '') : (point[field] ? duration(point[field]) : '')}</span><i className={goal && point[field] >= goal ? 'goal' : ''} style={{ height: `${Math.max(point[field] ? 4 : 1, point[field] / maximum * 100)}%` }} /><small>{point.label}</small></div>)}</div> }
function MediaStats({ data }: { data: AnalyticsOverview }) { return <article className="analytics-detail-card"><p className="eyebrow">Медиатека</p><h2>Просмотрено</h2><dl><div><dt>Фильмы</dt><dd>{data.moviesWatched}</dd></div><div><dt>Эпизоды сериалов</dt><dd>{data.seriesEpisodesWatched}</dd></div><div><dt>Эпизоды аниме</dt><dd>{data.animeEpisodesWatched}</dd></div></dl></article> }
function ReadingStats({ data }: { data: AnalyticsOverview }) { return <article className="analytics-detail-card"><p className="eyebrow">Книги</p><h2>Чтение</h2><dl><div><dt>Прочитано страниц</dt><dd>{number(data.pagesRead)}</dd></div><div><dt>Время чтения</dt><dd>{duration(data.readingMinutes)}</dd></div></dl></article> }

function chartPoints(daily: AnalyticsDailyPoint[]): ChartPoint[] {
  if (daily.length <= 60) return daily.map(point => ({ label: dateLabel(point.date), steps: point.steps, sleepMinutes: point.sleepMinutes, gameMinutes: point.gameMinutes }))
  const months = new Map<string, ChartPoint & { days: number; sleepDays: number }>()
  daily.forEach(point => { const key = point.date.slice(0, 7); const current = months.get(key) ?? { label: new Intl.DateTimeFormat('ru-RU', { month: 'short', year: 'numeric' }).format(new Date(`${key}-15T12:00:00`)), steps: 0, sleepMinutes: 0, gameMinutes: 0, days: 0, sleepDays: 0 }; current.steps += point.steps; current.days++; current.gameMinutes += point.gameMinutes; if (point.sleepSessions) { current.sleepMinutes += point.sleepMinutes; current.sleepDays++ } months.set(key, current) })
  return [...months.values()].map(point => ({ label: point.label, steps: Math.round(point.steps / point.days), sleepMinutes: point.sleepDays ? Math.round(point.sleepMinutes / point.sleepDays) : 0, gameMinutes: point.gameMinutes }))
}
