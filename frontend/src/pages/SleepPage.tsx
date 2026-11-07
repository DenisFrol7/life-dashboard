import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { createSleepSession, deleteSleepSession, getSleepSessions, updateSleepSession, type SleepSession, type SleepSessionInput } from '../api/sleep'
import { useToast } from '../components/ToastContext'
import { useToday } from '../hooks/useToday'
import { useLatestRequest } from '../hooks/useLatestRequest'
import { useFormMutation } from '../hooks/useFormMutation'
import { usePageMutation } from '../hooks/usePageMutation'
import { localDate as dateOnly } from '../utils/localDay'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import './SleepPage.css'

type SleepChartPoint = { key: string; label: string; minutes: number; sessions: number }

const sleepGoalMinutes = 8 * 60
const sleepChartMaximumMinutes = 10 * 60
const sleepChartTicks = [10 * 60, 8 * 60, 6 * 60, 4 * 60, 2 * 60, 0]
const localDate = (value: string | Date) => dateOnly(new Date(value))
const formatDuration = (minutes: number) => `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`
const sleepMinutes = (session: SleepSession) => Math.max(0, Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60_000) - (session.awakeMinutes ?? 0))
const formatTime = (value: string) => new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
const formatDate = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' }).format(new Date(value))

export function SleepPage() {
  const today = useToday()
  const requests = useLatestRequest()
  const [period, setPeriod] = useState<7 | 30>(7)
  const [sessions, setSessions] = useState<SleepSession[]>([])
  const [editing, setEditing] = useState<SleepSession | 'new' | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const formTriggerRef = useRef<HTMLButtonElement | null>(null)
  const focusAfterRefreshRef = useRef(false)

  const load = useCallback(async () => {
    const from = new Date(`${today}T00:00:00`); from.setDate(from.getDate() - (period - 1))
    const to = new Date(`${today}T00:00:00`); to.setDate(to.getDate() + 1)
    await requests.run(() => getSleepSessions(from.toISOString(), to.toISOString()), {
      onStart: () => { setLoading(true); setError(null) },
      onSuccess: setSessions,
      onError: (reason) => setError(reason instanceof Error ? reason.message : 'Не удалось загрузить данные сна'),
      onFinish: () => setLoading(false),
    })
  }, [period, today, requests])
  useEffect(() => { void load(); return () => requests.invalidate() }, [load, requests])

  const todaySessions = sessions.filter((session) => localDate(session.endedAt) === today)
  const todayMinutes = todaySessions.reduce((sum, session) => sum + sleepMinutes(session), 0)
  const rated = sessions.filter((session) => session.qualityRating != null)
  const averageQuality = rated.length ? rated.reduce((sum, session) => sum + (session.qualityRating ?? 0), 0) / rated.length : 0
  const averageDuration = sessions.length ? Math.round(sessions.reduce((sum, session) => sum + sleepMinutes(session), 0) / sessions.length) : 0

  const chartData = useMemo(() => Array.from({ length: period }, (_, index) => {
    const date = new Date(`${today}T12:00:00`); date.setDate(date.getDate() + index - period + 1)
    const key = localDate(date)
    const daily = sessions.filter((session) => localDate(session.endedAt) === key)
    const label = period === 7 ? new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(date) : date.getDate().toString()
    return { key, label, minutes: daily.reduce((sum, session) => sum + sleepMinutes(session), 0), sessions: daily.length }
  }), [sessions, period, today])

  const actions = usePageMutation(`${today}:${period}`, load, Boolean(editing) || loading)
  useEffect(() => {
    if (!focusAfterRefreshRef.current || loading || editing || actions.pending) return
    focusAfterRefreshRef.current = false
    if (formTriggerRef.current?.isConnected) formTriggerRef.current.focus({ preventScroll: true })
  }, [loading, editing, actions.pending])
  const remove = (session: SleepSession) => actions.run('delete', async () => {
    if (!window.confirm(`Удалить сессию сна за ${formatDate(session.endedAt)}?`)) return false
    await deleteSleepSession(session.id)
    return true
  }, 'Не удалось удалить сессию', 'Сессия сна удалена')
  const openForm = (session: SleepSession | 'new', trigger: HTMLButtonElement) => {
    formTriggerRef.current = trigger
    setEditing(session)
  }
  const saved = () => {
    focusAfterRefreshRef.current = true
    setEditing(null)
    void actions.refresh()
  }

  return <div className="sleep-page">
    <section className="sleep-hero">
      <div className="sleep-today"><p className="eyebrow">Последняя ночь</p><strong>{formatDuration(todayMinutes)}</strong><span>цель — {formatDuration(sleepGoalMinutes)}</span></div>
      <div className="sleep-goal-ring" role="progressbar" aria-label="Цель сна за сегодня" aria-valuemin={0} aria-valuemax={sleepGoalMinutes}
        aria-valuenow={Math.min(sleepGoalMinutes, todayMinutes)} aria-valuetext={`${formatDuration(todayMinutes)} из ${formatDuration(sleepGoalMinutes)}`}
        style={{ '--sleep-progress': `${Math.min(360, todayMinutes / sleepGoalMinutes * 360)}deg` } as CSSProperties}><span>{Math.round(todayMinutes / sleepGoalMinutes * 100)}%</span></div>
      <dl><div><dt>Средняя длительность</dt><dd>{formatDuration(averageDuration)}</dd></div><div><dt>Средняя оценка</dt><dd>{averageQuality ? `${averageQuality.toFixed(1)} из 5` : '—'}</dd></div><div><dt>Сессий за {period} дней</dt><dd>{sessions.length}</dd></div></dl>
      <button type="button" disabled={actions.disabled} className="primary-button icon-button" onClick={event => openForm('new', event.currentTarget)}><Plus />Добавить сон</button>
    </section>
    {actions.pending && <p className="muted" role="status">Обновляем данные…</p>}{(error || actions.error) && <div className="notice error sleep-error" role="alert"><strong>Ошибка</strong><span>{error ?? actions.error}</span></div>}
    <section className="sleep-grid">
      <article className="sleep-panel sleep-chart-panel">
        <div className="panel-heading"><div><p className="eyebrow">Период</p><h3>Продолжительность сна</h3></div><div className="period-switch" role="group" aria-label="Период сна"><button type="button" className={period === 7 ? 'active' : ''} aria-pressed={period === 7} onClick={() => setPeriod(7)}>7 дней</button><button type="button" className={period === 30 ? 'active' : ''} aria-pressed={period === 30} onClick={() => setPeriod(30)}>30 дней</button></div></div>
        {loading ? <div className="loading"><span />Загружаем историю…</div> : <SleepChart points={chartData} />}
      </article>
      <article className="sleep-panel sleep-breakdown">
        <div className="panel-heading"><div><p className="eyebrow">Структура</p><h3>Фазы последней сессии</h3></div></div>
        <SleepPhases session={todaySessions.at(-1)} />
      </article>
    </section>
    <section className="sleep-panel sleep-history">
      <div className="panel-heading"><div><p className="eyebrow">История</p><h3>Сессии сна</h3></div></div>
      <div className="sleep-table"><div className="sleep-table-head"><span>Пробуждение</span><span>Период</span><span>Сон</span><span>Качество</span><span>Заметка</span><span /></div>
        {[...sessions].reverse().map((session) => <article className="sleep-session-card" key={session.id}>
          <span className="sleep-session-date">{formatDate(session.endedAt)}</span>
          <span className="sleep-session-period"><small className="sleep-session-label">Период</small>{formatTime(session.startedAt)} — {formatTime(session.endedAt)}</span>
          <strong className="sleep-session-duration"><small className="sleep-session-label">Сон</small>{formatDuration(sleepMinutes(session))}</strong>
          <span className="sleep-session-quality"><small className="sleep-session-label">Качество</small>{session.qualityRating == null ? 'Без оценки' : <span className="sleep-quality-stars" aria-label={`${session.qualityRating} из 5`}>{'●'.repeat(session.qualityRating)}{'○'.repeat(5 - session.qualityRating)}</span>}</span>
          <span className="sleep-session-note" data-empty={!session.note}>{session.note ?? '—'}</span>
          <span className="sleep-session-actions"><button type="button" disabled={actions.disabled} onClick={event => openForm(session, event.currentTarget)} aria-label={`Изменить сессию сна за ${formatDate(session.endedAt)}`} title="Изменить"><Pencil aria-hidden="true" /><span>Изменить</span></button><button type="button" disabled={actions.disabled} onClick={() => void remove(session)} aria-label={`Удалить сессию сна за ${formatDate(session.endedAt)}`} title="Удалить"><Trash2 aria-hidden="true" /><span>Удалить</span></button></span>
        </article>)}
        {!loading && sessions.length === 0 && <p className="table-empty">Сессий сна пока нет.</p>}
      </div>
    </section>
    {editing && <SleepForm session={editing === 'new' ? undefined : editing} returnFocusTo={formTriggerRef.current} onClose={() => setEditing(null)} onSaved={saved} />}
  </div>
}

function SleepChart({ points }: { points: SleepChartPoint[] }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [scrollable, setScrollable] = useState(false)
  const selected = points.find(point => point.key === selectedKey) ?? points.at(-1)
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const measure = () => setScrollable(viewport.scrollWidth > viewport.clientWidth + 1)
    measure()
    viewport.scrollLeft = viewport.scrollWidth
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [points.length])

  return <div className="sleep-chart-container" role="group" aria-label="Длительность сна по датам">
    {selected && <output className="sleep-chart-readout" aria-live="polite" aria-atomic="true"><span>{formatDate(`${selected.key}T12:00:00`)}</span><strong>{selected.sessions ? formatDuration(selected.minutes) : 'Нет записей'}</strong></output>}
    <div className="sleep-chart-plot">
      <div className="sleep-chart-scale" aria-hidden="true">
        {sleepChartTicks.map(value => <span className={`${value === sleepChartMaximumMinutes ? 'maximum ' : ''}${value === sleepGoalMinutes ? 'goal' : ''}`.trim()}
          key={value} style={{ bottom: `${value / sleepChartMaximumMinutes * 100}%` }}>{value > 0 && <b>{value / 60} ч</b>}</span>)}
      </div>
      <div className="sleep-chart-scroll" ref={viewportRef}>
        <div className="sleep-chart" style={{ '--sleep-point-count': points.length } as CSSProperties}>
          {points.map(day => {
            const height = day.minutes === 0 ? 0 : Math.max(2, Math.min(100, day.minutes / sleepChartMaximumMinutes * 100))
            const description = `${formatDate(`${day.key}T12:00:00`)}: ${day.sessions ? formatDuration(day.minutes) : 'Нет записей'}`
            return <button type="button" className="sleep-chart-day" key={day.key} title={description} aria-label={description}
              aria-pressed={day.key === selected?.key} onClick={() => setSelectedKey(day.key)} onFocus={() => setSelectedKey(day.key)}>
              <i aria-hidden="true" style={{ height: `${height}%` }} className={`${day.minutes >= sleepGoalMinutes ? 'goal-reached ' : ''}${day.minutes === 0 ? 'empty' : ''}`.trim()} />
              <small aria-hidden="true">{day.label}</small>
            </button>
          })}
        </div>
      </div>
    </div>
    <p className="sleep-chart-hint">{scrollable ? 'Листайте график и выбирайте дату для подробностей.' : 'Выберите дату на графике для подробностей.'}</p>
    <p className="sleep-chart-goal"><span />Цель — {formatDuration(sleepGoalMinutes)} в день</p>
  </div>
}

function SleepPhases({ session }: { session?: SleepSession }) {
  if (!session) return <div className="sleep-empty">Добавьте данные сна, чтобы увидеть распределение фаз.</div>
  const phases = [{ label: 'Глубокий', value: session.deepSleepMinutes, color: 'deep' }, { label: 'Лёгкий', value: session.lightSleepMinutes, color: 'light' }, { label: 'REM', value: session.remSleepMinutes, color: 'rem' }, { label: 'Бодрствование', value: session.awakeMinutes, color: 'awake' }]
  const total = phases.reduce((sum, phase) => sum + (phase.value ?? 0), 0)
  return <>{total > 0 && <div className="sleep-phase-bar" aria-hidden="true">{phases.map((phase) => phase.value ? <i className={phase.color} key={phase.label} style={{ width: `${phase.value / total * 100}%` }} /> : null)}</div>}<div className="sleep-phase-list">{phases.map((phase) => <div key={phase.label}><i className={phase.color} aria-hidden="true" /><span>{phase.label}</span><strong>{phase.value == null ? '—' : `${phase.value} мин`}</strong></div>)}</div></>
}

function toLocalInput(instant: string) { const date = new Date(instant); const offset = date.getTimezoneOffset() * 60_000; return new Date(date.getTime() - offset).toISOString().slice(0, 16) }
function defaultTimes() { const end = new Date(); end.setHours(7, 0, 0, 0); const start = new Date(end); start.setDate(start.getDate() - 1); start.setHours(23, 0, 0, 0); return { start: toLocalInput(start.toISOString()), end: toLocalInput(end.toISOString()) } }

function SleepForm({ session, returnFocusTo, onClose, onSaved }: { session?: SleepSession; returnFocusTo: HTMLButtonElement | null; onClose: () => void; onSaved: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { showToast } = useToast()
  const defaults = defaultTimes()
  const [start, setStart] = useState(session ? toLocalInput(session.startedAt) : defaults.start)
  const [end, setEnd] = useState(session ? toLocalInput(session.endedAt) : defaults.end)
  const [deep, setDeep] = useState(session?.deepSleepMinutes?.toString() ?? '')
  const [light, setLight] = useState(session?.lightSleepMinutes?.toString() ?? '')
  const [rem, setRem] = useState(session?.remSleepMinutes?.toString() ?? '')
  const [awake, setAwake] = useState(session?.awakeMinutes?.toString() ?? '')
  const [quality, setQuality] = useState(session?.qualityRating?.toString() ?? '')
  const [note, setNote] = useState(session?.note ?? '')
  const mutations = useFormMutation()
  const { saving, pending } = mutations
  const [error, setError] = useState<string | null>(null)
  const closeForm = () => { mutations.dispose(); onClose() }
  const numberOrNull = (value: string) => value === '' ? null : Number(value)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const viewport = window.visualViewport
    const syncSize = () => {
      dialog.style.setProperty('--sleep-dialog-height', `${viewport?.height ?? window.innerHeight}px`)
      dialog.style.setProperty('--sleep-dialog-offset', `${viewport?.offsetTop ?? 0}px`)
    }
    syncSize()
    dialog.showModal()
    viewport?.addEventListener('resize', syncSize)
    viewport?.addEventListener('scroll', syncSize)
    window.addEventListener('resize', syncSize)
    return () => {
      viewport?.removeEventListener('resize', syncSize)
      viewport?.removeEventListener('scroll', syncSize)
      window.removeEventListener('resize', syncSize)
      dialog.close()
      if (returnFocusTo?.isConnected) returnFocusTo.focus({ preventScroll: true })
    }
  }, [returnFocusTo])
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    setError(null)
    if (new Date(end).getTime() <= new Date(start).getTime()) {
      setError('Время пробуждения должно быть позже времени засыпания.')
      return
    }
    await mutations.run('save', () => {
      const input: SleepSessionInput = { startedAt: new Date(start).toISOString(), endedAt: new Date(end).toISOString(), deepSleepMinutes: numberOrNull(deep), lightSleepMinutes: numberOrNull(light), remSleepMinutes: numberOrNull(rem), awakeMinutes: numberOrNull(awake), qualityRating: numberOrNull(quality), note: note || null }
      return session ? updateSleepSession(session.id, input) : createSleepSession(input)
    }, {
      onSuccess: () => { showToast(session ? 'Сессия сна обновлена' : 'Сессия сна добавлена'); onSaved() },
      onError: (reason) => setError(reason instanceof Error ? reason.message : 'Не удалось сохранить сессию'),
    })
  }
  return <dialog ref={dialogRef} className="sleep-dialog" aria-labelledby="sleep-form-title"
    onCancel={event => { event.preventDefault(); closeForm() }}
    onClick={event => { if (event.target === event.currentTarget) closeForm() }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return
      const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}>
    <form className="sleep-form" onSubmit={(event) => void submit(event)}>
      <header className="sleep-form-heading"><div><p className="eyebrow">Сон</p><h2 id="sleep-form-title">{session ? 'Редактирование' : 'Новая сессия'}</h2></div><button type="button" className="sleep-form-close" aria-label="Закрыть форму" autoFocus onClick={closeForm}><X aria-hidden="true" /></button></header>
      <div className="sleep-form-body">
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="sleep-form-grid sleep-form-times"><label>Заснул<input required type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>Проснулся<input required type="datetime-local" min={start || undefined} value={end} onChange={(event) => setEnd(event.target.value)} /></label></div>
        <h3>Фазы сна</h3><p className="sleep-form-hint">Можно оставить пустыми, если данных о фазах нет.</p>
        <div className="sleep-form-grid"><label>Глубокий сон, мин<input min="0" step="1" type="number" inputMode="numeric" value={deep} onChange={(event) => setDeep(event.target.value)} /></label><label>Лёгкий сон, мин<input min="0" step="1" type="number" inputMode="numeric" value={light} onChange={(event) => setLight(event.target.value)} /></label><label>REM, мин<input min="0" step="1" type="number" inputMode="numeric" value={rem} onChange={(event) => setRem(event.target.value)} /></label><label>Бодрствование, мин<input min="0" step="1" type="number" inputMode="numeric" value={awake} onChange={(event) => setAwake(event.target.value)} /></label></div>
        <label>Качество сна<select value={quality} onChange={(event) => setQuality(event.target.value)}><option value="">Без оценки</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} из 5</option>)}</select></label>
        <label>Заметка<textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></label>
      </div>
      <footer className="sleep-form-actions"><button className="secondary-button" type="button" onClick={closeForm}>Отмена</button><button className="primary-button" disabled={pending}>{saving ? 'Сохраняем…' : 'Сохранить'}</button></footer>
    </form>
  </dialog>
}
