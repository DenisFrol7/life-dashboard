import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Link } from 'react-router'
import { getDashboard, type Dashboard } from '../api/dashboard'

const formatDistance = (meters: number | null) => meters == null ? 'Нет данных' : `${(meters / 1000).toFixed(1)} км`
const formatDuration = (minutes: number) => minutes > 0 ? `${Math.floor(minutes / 60)} ч ${minutes % 60} мин` : 'Нет данных'

export function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getDashboard().then(setData).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : 'Backend недоступен')
    })
  }, [])

  if (error) return <div className="notice error"><strong>Не удалось загрузить обзор</strong><span>{error}</span></div>
  if (!data) return <div className="loading"><span />Загружаем сводку дня…</div>

  const date = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'full' }).format(new Date(`${data.date}T12:00:00`))
  const mediaTotal = data.media.currentMovies + data.media.currentSeries + data.media.currentAnime + data.media.currentGames

  return (
    <div className="page-stack dashboard-page">
      <section className="welcome-card">
        <div className="dashboard-welcome-copy">
          <p className="eyebrow">Сегодня, {date}</p>
          <h2>Добрый день!</h2>
          <p>Короткая сводка активности, планов и отдыха за сегодняшний день.</p>
          <Link className="dashboard-text-link" to="/journal">Открыть журнал активности →</Link>
        </div>
        <div className="progress-ring" style={{ '--progress': `${data.habits.completionPercent * 3.6}deg` } as CSSProperties}>
          <span>{Math.round(data.habits.completionPercent)}%</span><small>привычек</small>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Показатели за сегодня">
        <Metric to="/activity" icon="↗" tone="mint" label="Шаги" value={data.activity.steps?.toLocaleString('ru-RU') ?? '—'} note={formatDistance(data.activity.distanceMeters)} />
        <Metric to="/sleep" icon="☾" tone="violet" label="Сон" value={formatDuration(data.sleep.durationMinutes)} note={data.sleep.qualityRating ? `Качество ${data.sleep.qualityRating}/10` : 'Нет оценки'} />
        <Metric to="/habits" icon="✓" tone="amber" label="Привычки" value={`${data.habits.completed} из ${data.habits.scheduled}`} note={data.habits.skipped ? `Пропущено: ${data.habits.skipped}` : 'Без пропусков'} />
        <Metric to="/games" icon="◇" tone="blue" label="Игровое время" value={formatDuration(data.gaming.durationMinutes)} note={`${data.gaming.sessions} ${sessionWord(data.gaming.sessions)}`} />
      </section>

      <section className="dashboard-main-grid">
        <article className="panel dashboard-schedule">
          <PanelHeading eyebrow="Расписание" title="Сегодня" count={data.calendar.scheduled} to="/calendar" />
          <ScheduleRow icon="□" tone="blue" title="События" note="Запланировано на сегодня" value={data.calendar.events} />
          <ScheduleRow icon="✓" tone="amber" title="Задачи" note={`Выполнено: ${data.calendar.completedTasks}`} value={data.calendar.pendingTasks} suffix="осталось" />
          <ScheduleRow icon="!" tone="violet" title="Напоминания" note="Требуют внимания сегодня" value={data.calendar.reminders} />
        </article>

        <article className="panel dashboard-media">
          <PanelHeading eyebrow="Медиатека" title="Сейчас в процессе" count={mediaTotal} />
          <MediaRow to="/movies" label="Фильмы" value={data.media.currentMovies} color="coral" />
          <MediaRow to="/series" label="Сериалы" value={data.media.currentSeries} paused={data.media.pausedSeries} color="blue" />
          <MediaRow to="/anime" label="Аниме" value={data.media.currentAnime} paused={data.media.pausedAnime} color="violet" />
          <MediaRow to="/games" label="Игры" value={data.media.currentGames} color="mint" />
        </article>
      </section>

      <section className="dashboard-shortcuts">
        <DashboardShortcut to="/journal" eyebrow="Активность дня" title="Журнал активности" text="Просмотры, тренировки, привычки и игровые сессии в одной хронологии." action="Открыть ленту" />
        <DashboardShortcut to="/blog" eyebrow="Мысли и заметки" title="Блог" text={data.journalEntries ? `Сегодня добавлено записей: ${data.journalEntries}.` : 'Сегодня записей пока нет.'} action="Перейти к записям" accent />
      </section>
    </div>
  )
}

function Metric({ to, icon, tone, label, value, note }: { to: string; icon: string; tone: string; label: string; value: string; note: string }) {
  return <Link className="metric-card dashboard-card-link" to={to}><span className={`metric-icon ${tone}`}>{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{note}</p></div><span className="dashboard-arrow">→</span></Link>
}

function PanelHeading({ eyebrow, title, count, to }: { eyebrow: string; title: string; count: number; to?: string }) {
  return <div className="panel-heading"><div><p className="eyebrow">{eyebrow}</p><h3>{title}</h3></div><div className="dashboard-heading-actions"><span className="pill">{count}</span>{to && <Link to={to}>Открыть →</Link>}</div></div>
}

function ScheduleRow({ icon, tone, title, note, value, suffix }: { icon: string; tone: string; title: string; note: string; value: number; suffix?: string }) {
  return <div className="list-row"><span className={`list-icon ${tone}`}>{icon}</span><div><strong>{title}</strong><small>{note}</small></div><b>{value}{suffix && <small>{suffix}</small>}</b></div>
}

function MediaRow({ to, label, value, paused, color }: { to: string; label: string; value: number; paused?: number; color: string }) {
  return <Link className="media-row" to={to}><span className={`media-dot ${color}`} /><strong>{label}</strong><span>{value} активно{paused ? ` · ${paused} на паузе` : ''}</span><b>→</b></Link>
}

function DashboardShortcut({ to, eyebrow, title, text, action, accent = false }: { to: string; eyebrow: string; title: string; text: string; action: string; accent?: boolean }) {
  return <Link className={`dashboard-shortcut${accent ? ' accent' : ''}`} to={to}><div><p className="eyebrow">{eyebrow}</p><h3>{title}</h3><p>{text}</p></div><span>{action} →</span></Link>
}

function sessionWord(count: number): ReactNode {
  const mod100 = count % 100
  const mod10 = count % 10
  if (mod100 >= 11 && mod100 <= 14) return 'сессий'
  if (mod10 === 1) return 'сессия'
  if (mod10 >= 2 && mod10 <= 4) return 'сессии'
  return 'сессий'
}
