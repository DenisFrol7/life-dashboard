import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { deleteActivity, getActivityRange, putActivity, type DailyActivity } from '../api/activity'

const stepGoal = 7_000
const activeDayThreshold = 1_000
const isoDate = (date: Date) => date.toLocaleDateString('en-CA')
const today = isoDate(new Date())
const shiftDate = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + days)
  return isoDate(value)
}
const formatDate = (date: string, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('ru-RU', options ?? { day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`))

export function ActivityPage() {
  const [period, setPeriod] = useState<7 | 30>(7)
  const [selectedDate, setSelectedDate] = useState(today)
  const [items, setItems] = useState<DailyActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setItems(await getActivityRange(shiftDate(today, -(period - 1)), today)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось загрузить активность') }
    finally { setLoading(false) }
  }, [period])

  useEffect(() => { void load() }, [load])
  const selected = items.find((item) => item.activityDate === selectedDate)
  const current = items.find((item) => item.activityDate === today)
  const totalSteps = items.reduce((sum, item) => sum + (item.steps ?? 0), 0)
  const totalDistance = items.reduce((sum, item) => sum + (item.distanceMeters ?? 0), 0)
  const activeDays = items.filter((item) => (item.steps ?? 0) >= activeDayThreshold).length
  const average = activeDays ? Math.round(totalSteps / activeDays) : 0

  const chartData = useMemo(() => Array.from({ length: period }, (_, index) => {
    const date = shiftDate(today, index - period + 1)
    return { date, steps: items.find((item) => item.activityDate === date)?.steps ?? 0 }
  }), [items, period])
  const maxSteps = Math.max(stepGoal, ...chartData.map((item) => item.steps))

  return <div className="activity-page">
    <section className="activity-summary">
      <div><p className="eyebrow">Сегодня</p><strong>{(current?.steps ?? 0).toLocaleString('ru-RU')}</strong><span>шагов из {stepGoal.toLocaleString('ru-RU')}</span></div>
      <div className="activity-progress" style={{ '--activity-progress': `${Math.min(100, (current?.steps ?? 0) / stepGoal * 100)}%` } as React.CSSProperties}><span /></div>
      <dl><div><dt>Дистанция</dt><dd>{((current?.distanceMeters ?? 0) / 1000).toFixed(2)} км</dd></div><div><dt>Среднее</dt><dd>{average.toLocaleString('ru-RU')} шагов</dd></div><div><dt>Активных дней от 1 000 шагов</dt><dd>{activeDays} из {period}</dd></div></dl>
    </section>

    {error && <div className="notice error activity-error"><strong>Ошибка</strong><span>{error}</span></div>}

    <section className="activity-grid">
      <article className="activity-panel chart-panel">
        <div className="panel-heading"><div><p className="eyebrow">Динамика</p><h3>Шаги по дням</h3></div><div className="period-switch"><button className={period === 7 ? 'active' : ''} onClick={() => setPeriod(7)}>7 дней</button><button className={period === 30 ? 'active' : ''} onClick={() => setPeriod(30)}>30 дней</button></div></div>
        {loading ? <div className="loading"><span />Загружаем историю…</div> : <div className={`step-chart period-${period}`}>
          {chartData.map((item) => <button className={item.date === selectedDate ? 'selected' : ''} key={item.date} onClick={() => setSelectedDate(item.date)} title={`${formatDate(item.date)}: ${item.steps.toLocaleString('ru-RU')} шагов`}>
            <span className="bar-value">{period === 7 && item.steps ? item.steps.toLocaleString('ru-RU') : ''}</span><i style={{ height: `${Math.max(2, item.steps / maxSteps * 100)}%` }} /><small>{period === 7 ? formatDate(item.date, { weekday: 'short' }) : new Date(`${item.date}T12:00:00`).getDate()}</small>
          </button>)}
        </div>}
        <div className="chart-goal"><span />Цель — {stepGoal.toLocaleString('ru-RU')} шагов в день</div>
      </article>

      <ActivityForm date={selectedDate} activity={selected} onDate={setSelectedDate} onSaved={() => void load()} onDeleted={() => { setSelectedDate(today); void load() }} />
    </section>

    <section className="activity-panel history-panel">
      <div className="panel-heading"><div><p className="eyebrow">История</p><h3>Последние записи</h3></div><strong>{(totalDistance / 1000).toFixed(1)} км за период</strong></div>
      <div className="activity-table"><div className="activity-table-head"><span>Дата</span><span>Шаги</span><span>Дистанция</span><span>Заметка</span></div>
        {[...items].reverse().map((item) => <button key={item.id} onClick={() => setSelectedDate(item.activityDate)}><span>{formatDate(item.activityDate, { day: 'numeric', month: 'long', weekday: 'short' })}</span><strong>{item.steps?.toLocaleString('ru-RU') ?? '—'}</strong><span>{item.distanceMeters == null ? '—' : `${(item.distanceMeters / 1000).toFixed(2)} км`}</span><span>{item.note ?? '—'}</span></button>)}
        {!loading && items.length === 0 && <p className="table-empty">Записей за этот период пока нет.</p>}
      </div>
    </section>
  </div>
}

function ActivityForm({ date, activity, onDate, onSaved, onDeleted }: { date: string; activity?: DailyActivity; onDate: (date: string) => void; onSaved: () => void; onDeleted: () => void }) {
  const [steps, setSteps] = useState('')
  const [distance, setDistance] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setSteps(activity?.steps?.toString() ?? ''); setDistance(activity?.distanceMeters == null ? '' : (activity.distanceMeters / 1000).toString()); setNote(activity?.note ?? ''); setError(null) }, [activity, date])
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError(null); try { await putActivity(date, { steps: steps === '' ? null : Number(steps), distanceMeters: distance === '' ? null : Math.round(Number(distance) * 1000), note: note || null }); onSaved() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить запись') } finally { setSaving(false) } }
  const remove = async () => { if (!activity || !window.confirm(`Удалить активность за ${formatDate(date)}?`)) return; try { await deleteActivity(date); onDeleted() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось удалить запись') } }
  return <form className="activity-panel activity-form" onSubmit={(event) => void submit(event)}>
    <div className="panel-heading"><div><p className="eyebrow">Данные за день</p><h3>{date === today ? 'Сегодня' : formatDate(date, { day: 'numeric', month: 'long' })}</h3></div><input aria-label="Дата активности" max={today} type="date" value={date} onChange={(event) => onDate(event.target.value)} /></div>
    {error && <div className="form-error">{error}</div>}
    <label>Шаги<div className="input-with-unit"><input min="0" step="1" type="number" value={steps} onChange={(event) => setSteps(event.target.value)} placeholder="0" /><span>шагов</span></div></label>
    <label>Дистанция<div className="input-with-unit"><input min="0" step="0.01" type="number" value={distance} onChange={(event) => setDistance(event.target.value)} placeholder="0.00" /><span>км</span></div></label>
    <label>Заметка<textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Например, вечерняя прогулка" /></label>
    <div className="activity-form-actions">{activity && <button className="danger-button" type="button" onClick={() => void remove()}>Удалить</button>}<button className="primary-button" disabled={saving}>{saving ? 'Сохраняем…' : 'Сохранить'}</button></div>
  </form>
}
