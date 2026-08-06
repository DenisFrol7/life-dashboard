import { useEffect, useState } from 'react'
import { getDashboard, type Dashboard } from '../api/dashboard'

const formatDistance = (meters: number | null) => meters == null ? '—' : `${(meters / 1000).toFixed(1)} км`
const formatSleep = (minutes: number) => `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`

export function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDashboard().then(setData).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'Backend недоступен')
    })
  }, [])

  if (error) return <div className="notice error"><strong>Не удалось загрузить Dashboard</strong><span>{error}</span></div>
  if (!data) return <div className="loading"><span />Загружаем дневную сводку…</div>

  const date = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'full' }).format(new Date(`${data.date}T12:00:00`))
  const mediaTotal = data.media.currentMovies + data.media.currentSeries + data.media.currentAnime + data.media.currentGames

  return (
    <div className="page-stack">
      <section className="welcome-card">
        <div><p className="eyebrow">Сегодня, {date}</p><h2>Добрый день!</h2><p>Вот что происходит в вашей жизни сегодня.</p></div>
        <div className="progress-ring" style={{ '--progress': `${data.habits.completionPercent * 3.6}deg` } as React.CSSProperties}>
          <span>{Math.round(data.habits.completionPercent)}%</span><small>привычек</small>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Дневные показатели">
        <Metric icon="↗" tone="mint" label="Шаги" value={data.activity.steps?.toLocaleString('ru-RU') ?? '—'} note={formatDistance(data.activity.distanceMeters)} />
        <Metric icon="☾" tone="violet" label="Сон" value={formatSleep(data.sleep.durationMinutes)} note={data.sleep.qualityRating ? `Качество ${data.sleep.qualityRating}/10` : 'Нет оценки'} />
        <Metric icon="✓" tone="amber" label="Привычки" value={`${data.habits.completed} / ${data.habits.scheduled}`} note={data.habits.skipped ? `Пропущено: ${data.habits.skipped}` : 'Без пропусков'} />
        <Metric icon="□" tone="blue" label="Планы" value={String(data.calendar.scheduled)} note={`Задач: ${data.calendar.pendingTasks}`} />
        <Metric icon="◆" tone="violet" label="Игровое время" value={formatSleep(data.gaming.durationMinutes)} note={`Сессий: ${data.gaming.sessions}`} />
      </section>

      <section className="content-grid">
        <article className="panel">
          <div className="panel-heading"><div><p className="eyebrow">Расписание</p><h3>На сегодня</h3></div><span className="pill">{data.calendar.scheduled}</span></div>
          <div className="list-row"><span className="list-icon blue">□</span><div><strong>События</strong><small>Запланировано на день</small></div><b>{data.calendar.events}</b></div>
          <div className="list-row"><span className="list-icon amber">✓</span><div><strong>Задачи</strong><small>Выполнено {data.calendar.completedTasks}</small></div><b>{data.calendar.pendingTasks}</b></div>
          <div className="list-row"><span className="list-icon violet">!</span><div><strong>Напоминания</strong><small>Не забудьте проверить</small></div><b>{data.calendar.reminders}</b></div>
        </article>

        <article className="panel">
          <div className="panel-heading"><div><p className="eyebrow">Медиатека</p><h3>Сейчас в процессе</h3></div><span className="pill">{mediaTotal}</span></div>
          <MediaRow label="Фильмы" value={data.media.currentMovies} color="coral" />
          <MediaRow label="Сериалы" value={data.media.currentSeries} paused={data.media.pausedSeries} color="blue" />
          <MediaRow label="Аниме" value={data.media.currentAnime} paused={data.media.pausedAnime} color="violet" />
          <MediaRow label="Игры" value={data.media.currentGames} color="mint" />
        </article>

        <article className="panel compact-panel">
          <p className="eyebrow">Журнал</p><div className="journal-count">{data.journalEntries}</div><h3>Записей сегодня</h3><p className="muted">Сохраните мысли и итоги дня.</p>
        </article>
      </section>
    </div>
  )
}

function Metric({ icon, tone, label, value, note }: { icon: string; tone: string; label: string; value: string; note: string }) {
  return <article className="metric-card"><span className={`metric-icon ${tone}`}>{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div></article>
}

function MediaRow({ label, value, paused, color }: { label: string; value: number; paused?: number; color: string }) {
  return <div className="media-row"><span className={`media-dot ${color}`} /><strong>{label}</strong><span>{value} активно{paused ? ` · ${paused} на паузе` : ''}</span></div>
}
