import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type RefObject } from 'react'
import { deleteActivity, getActivityRange, putActivity, type DailyActivity } from '../api/activity'
import { useToast } from '../components/ToastContext'
import { useDateSelection } from '../hooks/useDateSelection'
import { useLatestRequest } from '../hooks/useLatestRequest'
import { useFormMutation } from '../hooks/useFormMutation'
import { createActivityDraft } from '../utils/activityDraft'
import { localDate as isoDate } from '../utils/localDay'
import './ActivityPage.css'

const stepGoal = 7_000
const chartMaximum = 12_000
const chartTicks = [12_000, 9_000, 7_000, 5_000, 3_000, 1_000, 0]
const activeDayThreshold = 1_000
const shiftDate = (date: string, days: number) => {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + days)
  return isoDate(value)
}
const formatDate = (date: string, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('ru-RU', options ?? { day: 'numeric', month: 'short' }).format(new Date(`${date}T12:00:00`))

export function ActivityPage() {
  const { today, date: selectedDate, setDate: setSelectedDate, selectToday } = useDateSelection()
  const requests = useLatestRequest()
  const [period, setPeriod] = useState<7 | 30>(7)
  const [items, setItems] = useState<DailyActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  const load = useCallback(async () => {
    await requests.run(() => getActivityRange(shiftDate(today, -(period - 1)), today), {
      onStart: () => { setLoading(true); setError(null) },
      onSuccess: setItems,
      onError: (reason) => setError(reason instanceof Error ? reason.message : 'Не удалось загрузить активность'),
      onFinish: () => setLoading(false),
    })
  }, [period, today, requests])

  useEffect(() => { void load(); return () => requests.invalidate() }, [load, requests])
  const selected = items.find((item) => item.activityDate === selectedDate)
  const current = items.find((item) => item.activityDate === today)
  const totalSteps = items.reduce((sum, item) => sum + (item.steps ?? 0), 0)
  const totalDistance = items.reduce((sum, item) => sum + (item.distanceMeters ?? 0), 0)
  const activeDays = items.filter((item) => (item.steps ?? 0) >= activeDayThreshold).length
  const average = activeDays ? Math.round(totalSteps / activeDays) : 0
  const editDate = (date: string) => {
    setSelectedDate(date)
    formRef.current?.scrollIntoView({ block: 'start' })
    formRef.current?.focus({ preventScroll: true })
  }

  const chartData = useMemo(() => Array.from({ length: period }, (_, index) => {
    const date = shiftDate(today, index - period + 1)
    return { date, steps: items.find((item) => item.activityDate === date)?.steps ?? 0 }
  }), [items, period, today])
  return <div className="activity-page">
    <section className="activity-summary">
      <div className="activity-today">
        <p className="eyebrow">Сегодня</p>
        <strong>{(current?.steps ?? 0).toLocaleString('ru-RU')}</strong><span>шагов из {stepGoal.toLocaleString('ru-RU')}</span>
        <div className="activity-progress" role="progressbar" aria-label="Прогресс шагов за сегодня" aria-valuemin={0} aria-valuemax={stepGoal}
          aria-valuenow={Math.min(stepGoal, current?.steps ?? 0)} aria-valuetext={`${(current?.steps ?? 0).toLocaleString('ru-RU')} из ${stepGoal.toLocaleString('ru-RU')} шагов`}
          style={{ '--activity-progress': `${Math.min(100, (current?.steps ?? 0) / stepGoal * 100)}%` } as CSSProperties}><span /></div>
      </div>
      <dl><div><dt>Дистанция</dt><dd>{((current?.distanceMeters ?? 0) / 1000).toFixed(2)} км</dd></div><div><dt>Среднее</dt><dd>{average.toLocaleString('ru-RU')} шагов</dd></div><div><dt>Активных дней от 1 000 шагов</dt><dd>{activeDays} из {period}</dd></div></dl>
    </section>

    {error && <div className="notice error activity-error" role="alert"><strong>Ошибка</strong><span>{error}</span></div>}

    <section className="activity-grid">
      <article className="activity-panel chart-panel">
        <div className="panel-heading"><div><p className="eyebrow">Динамика</p><h3>Шаги по дням</h3></div><div className="period-switch" role="group" aria-label="Период активности"><button type="button" className={period === 7 ? 'active' : ''} aria-pressed={period === 7} onClick={() => setPeriod(7)}>7 дней</button><button type="button" className={period === 30 ? 'active' : ''} aria-pressed={period === 30} onClick={() => setPeriod(30)}>30 дней</button></div></div>
        {loading ? <div className="loading"><span />Загружаем историю…</div> : <ActivityChart items={chartData} period={period} selectedDate={selectedDate} onSelect={setSelectedDate} onEdit={() => editDate(selectedDate)} />}
        <div className="chart-goal"><span />Цель — {stepGoal.toLocaleString('ru-RU')} шагов в день</div>
      </article>

      <ActivityForm formRef={formRef} today={today} date={selectedDate} activity={selected} onDate={setSelectedDate} onToday={selectToday} onEdited={() => setSelectedDate(selectedDate)} onSaved={() => void load()} onDeleted={() => { selectToday(); void load() }} />
    </section>

    <section className="activity-panel history-panel">
      <div className="panel-heading"><div><p className="eyebrow">История</p><h3>Последние записи</h3></div><strong>{(totalDistance / 1000).toFixed(1)} км за период</strong></div>
      <div className="activity-table"><div className="activity-table-head"><span>Дата</span><span>Шаги</span><span>Дистанция</span><span>Заметка</span></div>
        {[...items].reverse().map((item) => <button type="button" key={item.id} aria-pressed={item.activityDate === selectedDate} onClick={() => editDate(item.activityDate)}>
          <span className="activity-row-date">{formatDate(item.activityDate, { day: 'numeric', month: 'long', weekday: 'short' })}<span className="activity-row-action">Изменить</span></span>
          <strong className="activity-row-steps"><small>Шаги</small>{item.steps?.toLocaleString('ru-RU') ?? '—'}</strong>
          <span className="activity-row-distance"><small>Дистанция</small>{item.distanceMeters == null ? '—' : `${(item.distanceMeters / 1000).toFixed(2)} км`}</span>
          <span className="activity-row-note" data-empty={!item.note}>{item.note ?? '—'}</span>
        </button>)}
        {!loading && items.length === 0 && <p className="table-empty">Записей за этот период пока нет.</p>}
      </div>
    </section>
  </div>
}

function ActivityChart({ items, period, selectedDate, onSelect, onEdit }: {
  items: { date: string; steps: number }[]
  period: 7 | 30
  selectedDate: string
  onSelect: (date: string) => void
  onEdit: () => void
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [scrollable, setScrollable] = useState(false)
  const selected = items.find(item => item.date === selectedDate)
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const measure = () => setScrollable(viewport.scrollWidth > viewport.clientWidth + 1)
    measure()
    viewport.scrollLeft = viewport.scrollWidth
    const observer = new ResizeObserver(measure)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [items.length])
  useEffect(() => {
    const viewport = viewportRef.current
    const button = viewport?.querySelectorAll('button')[items.findIndex(item => item.date === selectedDate)]
    if (!viewport || !button) return
    const bounds = viewport.getBoundingClientRect()
    const target = button.getBoundingClientRect()
    if (target.left < bounds.left) viewport.scrollLeft -= bounds.left - target.left
    else if (target.right > bounds.right) viewport.scrollLeft += target.right - bounds.right
  }, [items, selectedDate])

  return <div className="activity-chart" role="group" aria-label="Шаги по датам">
    <div className="activity-chart-readout">
      <output aria-live="polite" aria-atomic="true"><span>{formatDate(selectedDate)}</span><strong>{selected ? `${selected.steps.toLocaleString('ru-RU')} шагов` : 'Вне выбранного периода'}</strong></output>
      <button className="secondary-button" type="button" onClick={onEdit}>Внести данные</button>
    </div>
    <div className="activity-chart-plot">
      <div className="step-chart-scale" aria-hidden="true">
        {chartTicks.map(value => <span className={`${value === chartMaximum ? 'maximum ' : ''}${value === stepGoal ? 'goal' : ''}`.trim()}
          key={value} style={{ bottom: `${value / chartMaximum * 100}%` }}><b>{value.toLocaleString('ru-RU')}</b></span>)}
      </div>
      <div className="activity-chart-scroll" ref={viewportRef}>
        <div className="step-chart" style={{ '--activity-point-count': items.length } as CSSProperties}>
          {items.map(item => {
            const height = item.steps === 0 ? 0 : Math.max(2, Math.min(100, item.steps / chartMaximum * 100))
            const description = `${formatDate(item.date)}: ${item.steps.toLocaleString('ru-RU')} шагов`
            return <button type="button" className={item.date === selectedDate ? 'selected' : ''} key={item.date}
              onClick={() => onSelect(item.date)} aria-pressed={item.date === selectedDate} aria-label={description} title={description}>
              <i aria-hidden="true" className={`${item.steps >= stepGoal ? 'goal-reached ' : ''}${item.steps === 0 ? 'empty' : ''}`.trim()} style={{ height: `${height}%` }} />
              <small aria-hidden="true">{period === 7 ? formatDate(item.date, { weekday: 'short' }) : new Date(`${item.date}T12:00:00`).getDate()}</small>
            </button>
          })}
        </div>
      </div>
    </div>
    <p className="activity-chart-hint">{scrollable ? 'Листайте график и выбирайте дату для просмотра и ввода данных.' : 'Выберите дату на графике для просмотра и ввода данных.'}</p>
  </div>
}

function ActivityForm({ formRef, today, date, activity, onDate, onToday, onEdited, onSaved, onDeleted }: { formRef: RefObject<HTMLFormElement | null>; today: string; date: string; activity?: DailyActivity; onDate: (date: string) => void; onToday: () => void; onEdited: () => void; onSaved: () => void; onDeleted: () => void }) {
  const { showToast } = useToast()
  const [steps, setSteps] = useState('')
  const [distance, setDistance] = useState('')
  const [note, setNote] = useState('')
  const mutations = useFormMutation()
  const { saving, deleting, pending } = mutations
  const [error, setError] = useState<string | null>(null)
  const [draft] = useState(() => createActivityDraft(date))
  const callbacks = useRef({ onSaved, onDeleted })
  useLayoutEffect(() => { callbacks.current = { onSaved, onDeleted } }, [onSaved, onDeleted])
  const markEdited = () => { draft.edit(); onEdited() }
  useLayoutEffect(() => {
    draft.selectDate(date)
    if (draft.hasChanges) return
    setSteps(activity?.steps?.toString() ?? ''); setDistance(activity?.distanceMeters == null ? '' : (activity.distanceMeters / 1000).toString()); setNote(activity?.note ?? ''); setError(null)
  }, [activity, date, draft])
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    const snapshot = draft.snapshot()
    const input = { steps: steps === '' ? null : Number(steps), distanceMeters: distance === '' ? null : Math.round(Number(distance) * 1000), note: note || null }
    setError(null)
    await mutations.run('save', () => putActivity(snapshot.date, input), {
      onSuccess: () => {
        if (draft.accept(snapshot)) showToast('Активность сохранена')
        callbacks.current.onSaved()
      },
      onError: (reason) => {
        if (draft.isCurrent(snapshot)) setError(reason instanceof Error ? reason.message : 'Не удалось сохранить запись')
      },
    })
  }
  const remove = async () => {
    if (!activity || pending) return
    const snapshot = draft.snapshot()
    setError(null)
    await mutations.run('delete', async () => {
      if (!window.confirm(`Удалить активность за ${formatDate(snapshot.date)}?`)) return false
      await deleteActivity(snapshot.date)
      return true
    }, {
      onSuccess: (deleted) => {
        if (!deleted) return
        if (draft.accept(snapshot)) {
          showToast('Запись активности удалена')
          callbacks.current.onDeleted()
        } else callbacks.current.onSaved()
      },
      onError: (reason) => {
        if (draft.isCurrent(snapshot)) setError(reason instanceof Error ? reason.message : 'Не удалось удалить запись')
      },
    })
  }
  return <form ref={formRef} className="activity-panel activity-form" tabIndex={-1} aria-labelledby="activity-form-title" onSubmit={(event) => void submit(event)}>
    <div className="panel-heading"><div><p className="eyebrow">Данные за день</p><h3 id="activity-form-title">{date === today ? 'Сегодня' : formatDate(date, { day: 'numeric', month: 'long' })}</h3></div>{date !== today && <button type="button" className="secondary-button activity-today-button" onClick={onToday}>Сегодня</button>}</div>
    <label>Дата активности<input max={today} type="date" value={date} onClick={(event) => event.currentTarget.showPicker?.()} onChange={(event) => { if (event.target.value) onDate(event.target.value) }} /></label>
    {error && <div className="form-error" role="alert">{error}</div>}
    <label>Шаги<div className="activity-input-with-unit"><input min="0" step="1" type="number" inputMode="numeric" value={steps} onChange={(event) => { markEdited(); setSteps(event.target.value) }} placeholder="0" /><span>шагов</span></div></label>
    <label>Дистанция<div className="activity-input-with-unit"><input min="0" step="0.01" type="number" inputMode="decimal" value={distance} onChange={(event) => { markEdited(); setDistance(event.target.value) }} placeholder="0.00" /><span>км</span></div></label>
    <label>Заметка<textarea rows={3} value={note} onChange={(event) => { markEdited(); setNote(event.target.value) }} placeholder="Например, вечерняя прогулка" /></label>
    <div className="activity-form-actions">{activity && <button className="danger-button" type="button" disabled={pending} onClick={() => void remove()}>{deleting ? 'Удаляем…' : 'Удалить'}</button>}<button className="primary-button" disabled={pending}>{saving ? 'Сохраняем…' : 'Сохранить'}</button></div>
  </form>
}
