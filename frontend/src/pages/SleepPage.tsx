import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { createSleepSession, deleteSleepSession, getSleepSessions, updateSleepSession, type SleepSession, type SleepSessionInput } from '../api/sleep'
import { useToast } from '../components/ToastContext'

const sleepGoalMinutes = 8 * 60
const localDate = (value: string | Date) => new Date(value).toLocaleDateString('en-CA')
const today = localDate(new Date())
const formatDuration = (minutes: number) => `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`
const sleepMinutes = (session: SleepSession) => Math.max(0, Math.round((new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime()) / 60_000) - (session.awakeMinutes ?? 0))
const formatTime = (value: string) => new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
const formatDate = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' }).format(new Date(value))

export function SleepPage() {
  const { showToast } = useToast()
  const [sessions, setSessions] = useState<SleepSession[]>([])
  const [editing, setEditing] = useState<SleepSession | 'new' | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const from = new Date(); from.setDate(from.getDate() - 30); from.setHours(0, 0, 0, 0)
    const to = new Date(); to.setDate(to.getDate() + 1); to.setHours(0, 0, 0, 0)
    try { setSessions(await getSleepSessions(from.toISOString(), to.toISOString())) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось загрузить данные сна') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const todaySessions = sessions.filter((session) => localDate(session.endedAt) === today)
  const todayMinutes = todaySessions.reduce((sum, session) => sum + sleepMinutes(session), 0)
  const rated = sessions.filter((session) => session.qualityRating != null)
  const averageQuality = rated.length ? rated.reduce((sum, session) => sum + (session.qualityRating ?? 0), 0) / rated.length : 0
  const averageDuration = sessions.length ? Math.round(sessions.reduce((sum, session) => sum + sleepMinutes(session), 0) / sessions.length) : 0

  const week = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(); date.setDate(date.getDate() + index - 6)
    const key = localDate(date)
    const daily = sessions.filter((session) => localDate(session.endedAt) === key)
    return { key, label: new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(date), minutes: daily.reduce((sum, session) => sum + sleepMinutes(session), 0) }
  }), [sessions])

  const remove = async (session: SleepSession) => {
    if (!window.confirm(`Удалить сессию сна за ${formatDate(session.endedAt)}?`)) return
    try { await deleteSleepSession(session.id); showToast('Сессия сна удалена'); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось удалить сессию') }
  }

  return <div className="sleep-page">
    <section className="sleep-hero">
      <div><p className="eyebrow">Последняя ночь</p><strong>{formatDuration(todayMinutes)}</strong><span>цель — {formatDuration(sleepGoalMinutes)}</span></div>
      <div className="sleep-goal-ring" style={{ '--sleep-progress': `${Math.min(360, todayMinutes / sleepGoalMinutes * 360)}deg` } as React.CSSProperties}><span>{Math.round(todayMinutes / sleepGoalMinutes * 100)}%</span></div>
      <dl><div><dt>Средняя длительность</dt><dd>{formatDuration(averageDuration)}</dd></div><div><dt>Средняя оценка</dt><dd>{averageQuality ? `${averageQuality.toFixed(1)} из 5` : '—'}</dd></div><div><dt>Сессий за 30 дней</dt><dd>{sessions.length}</dd></div></dl>
      <button className="primary-button" onClick={() => setEditing('new')}>+ Добавить сон</button>
    </section>
    {error && <div className="notice error sleep-error"><strong>Ошибка</strong><span>{error}</span></div>}
    <section className="sleep-grid">
      <article className="sleep-panel sleep-chart-panel">
        <div className="panel-heading"><div><p className="eyebrow">Неделя</p><h3>Продолжительность сна</h3></div><span className="sleep-legend"><i />цель 8 часов</span></div>
        {loading ? <div className="loading"><span />Загружаем историю…</div> : <div className="sleep-chart">
          {week.map((day) => <div key={day.key}><span>{day.minutes ? formatDuration(day.minutes) : '—'}</span><i style={{ height: `${Math.max(2, Math.min(100, day.minutes / 600 * 100))}%` }} className={day.minutes >= sleepGoalMinutes ? 'goal-reached' : ''} /><small>{day.label}</small></div>)}
        </div>}
      </article>
      <article className="sleep-panel sleep-breakdown">
        <div className="panel-heading"><div><p className="eyebrow">Структура</p><h3>Фазы последней сессии</h3></div></div>
        <SleepPhases session={todaySessions.at(-1)} />
      </article>
    </section>
    <section className="sleep-panel sleep-history">
      <div className="panel-heading"><div><p className="eyebrow">История</p><h3>Сессии сна</h3></div></div>
      <div className="sleep-table"><div className="sleep-table-head"><span>Пробуждение</span><span>Период</span><span>Сон</span><span>Качество</span><span>Заметка</span><span /></div>
        {[...sessions].reverse().map((session) => <div key={session.id}><span>{formatDate(session.endedAt)}</span><span>{formatTime(session.startedAt)} — {formatTime(session.endedAt)}</span><strong>{formatDuration(sleepMinutes(session))}</strong><span className="quality-stars">{'●'.repeat(session.qualityRating ?? 0)}{'○'.repeat(5 - (session.qualityRating ?? 0))}</span><span>{session.note ?? '—'}</span><span><button onClick={() => setEditing(session)} title="Редактировать">✎</button><button onClick={() => void remove(session)} title="Удалить">×</button></span></div>)}
        {!loading && sessions.length === 0 && <p className="table-empty">Сессий сна пока нет.</p>}
      </div>
    </section>
    {editing && <SleepForm session={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load() }} />}
  </div>
}

function SleepPhases({ session }: { session?: SleepSession }) {
  if (!session) return <div className="sleep-empty">Добавьте данные сна, чтобы увидеть распределение фаз.</div>
  const phases = [{ label: 'Глубокий', value: session.deepSleepMinutes, color: 'deep' }, { label: 'Лёгкий', value: session.lightSleepMinutes, color: 'light' }, { label: 'REM', value: session.remSleepMinutes, color: 'rem' }, { label: 'Бодрствование', value: session.awakeMinutes, color: 'awake' }]
  const total = phases.reduce((sum, phase) => sum + (phase.value ?? 0), 0)
  return <>{total > 0 && <div className="phase-bar">{phases.map((phase) => phase.value ? <i className={phase.color} key={phase.label} style={{ width: `${phase.value / total * 100}%` }} /> : null)}</div>}<div className="phase-list">{phases.map((phase) => <div key={phase.label}><i className={phase.color} /><span>{phase.label}</span><strong>{phase.value == null ? '—' : `${phase.value} мин`}</strong></div>)}</div></>
}

function toLocalInput(instant: string) { const date = new Date(instant); const offset = date.getTimezoneOffset() * 60_000; return new Date(date.getTime() - offset).toISOString().slice(0, 16) }
function defaultTimes() { const end = new Date(); end.setHours(7, 0, 0, 0); const start = new Date(end); start.setDate(start.getDate() - 1); start.setHours(23, 0, 0, 0); return { start: toLocalInput(start.toISOString()), end: toLocalInput(end.toISOString()) } }

function SleepForm({ session, onClose, onSaved }: { session?: SleepSession; onClose: () => void; onSaved: () => void }) {
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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const numberOrNull = (value: string) => value === '' ? null : Number(value)
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError(null); const input: SleepSessionInput = { startedAt: new Date(start).toISOString(), endedAt: new Date(end).toISOString(), deepSleepMinutes: numberOrNull(deep), lightSleepMinutes: numberOrNull(light), remSleepMinutes: numberOrNull(rem), awakeMinutes: numberOrNull(awake), qualityRating: numberOrNull(quality), note: note || null }; try { if (session) await updateSleepSession(session.id, input); else await createSleepSession(input); showToast(session ? 'Сессия сна обновлена' : 'Сессия сна добавлена'); onSaved() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить сессию') } finally { setSaving(false) } }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="habit-form sleep-form" onSubmit={(event) => void submit(event)}>
    <div className="form-heading"><div><p className="eyebrow">Сон</p><h2>{session ? 'Редактирование' : 'Новая сессия'}</h2></div><button type="button" onClick={onClose}>×</button></div>
    {error && <div className="form-error">{error}</div>}
    <div className="form-grid"><label>Заснул<input required type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>Проснулся<input required type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} /></label><label>Глубокий сон, мин<input min="0" type="number" value={deep} onChange={(event) => setDeep(event.target.value)} /></label><label>Лёгкий сон, мин<input min="0" type="number" value={light} onChange={(event) => setLight(event.target.value)} /></label><label>REM, мин<input min="0" type="number" value={rem} onChange={(event) => setRem(event.target.value)} /></label><label>Бодрствование, мин<input min="0" type="number" value={awake} onChange={(event) => setAwake(event.target.value)} /></label></div>
    <label>Качество сна<select value={quality} onChange={(event) => setQuality(event.target.value)}><option value="">Без оценки</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} из 5</option>)}</select></label>
    <label>Заметка<textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></label>
    <div className="form-buttons"><button className="secondary-button" type="button" onClick={onClose}>Отмена</button><button className="primary-button" disabled={saving}>{saving ? 'Сохраняем…' : 'Сохранить'}</button></div>
  </form></div>
}
