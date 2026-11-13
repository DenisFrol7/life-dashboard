import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { completeOccurrence, createCalendarEvent, deleteCalendarEvent, deleteOccurrence, getCalendarEvents, getOccurrencesForRange, updateCalendarEvent, type CalendarEvent, type CalendarEventInput, type EventType, type Occurrence } from '../api/calendar'
import { useToast } from '../components/ToastContext'
import { useDateSelection } from '../hooks/useDateSelection'
import { useLatestRequest } from '../hooks/useLatestRequest'
import { useFormMutation } from '../hooks/useFormMutation'
import { usePageMutation } from '../hooks/usePageMutation'
import { localDate as iso } from '../utils/localDay'
import { CalendarPlus, Check, ChevronLeft, ChevronRight, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react'
import './CalendarPage.css'

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const eventLabels: Record<EventType, string> = { EVENT: 'Событие', TASK: 'Задача', REMINDER: 'Напоминание' }
const scheduleLabels = { ONCE: 'Один раз', DAILY: 'Каждый день', WEEKLY: 'Каждую неделю', SELECTED_DAYS: 'Выбранные дни' }

const emptyEvent = (date: string): CalendarEventInput => ({ title: '', description: null, eventType: 'EVENT', scheduleType: 'ONCE', startDate: date, repeatUntil: null, startTime: '09:00', endTime: '10:00', allDay: false, location: null, status: 'ACTIVE', scheduleDays: [] })
const dateFromIso = (value: string) => new Date(`${value}T12:00:00`)
const fullDate = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }).format(dateFromIso(value))
const recordCount = (count: number) => `${count} ${count % 10 === 1 && count % 100 !== 11 ? 'запись' : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14) ? 'записи' : 'записей'}`
const occursOn = (event: CalendarEvent, date: string) => {
  if (event.status !== 'ACTIVE' || date < event.startDate || event.repeatUntil && date > event.repeatUntil) return false
  const day = dateFromIso(date).getDay() || 7
  if (event.scheduleType === 'ONCE') return date === event.startDate
  if (event.scheduleType === 'DAILY') return true
  if (event.scheduleType === 'SELECTED_DAYS') return event.scheduleDays.includes(day)
  const difference = Math.round((dateFromIso(date).getTime() - dateFromIso(event.startDate).getTime()) / 86_400_000)
  return difference % 7 === 0
}
const monthCells = (month: Date) => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1, 12)
  const start = new Date(first); start.setDate(1 - ((first.getDay() || 7) - 1))
  return Array.from({ length: 42 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); return date })
}

export function CalendarPage() {
  const { today, date: selectedDate, setDate: setSelectedDate, selectToday } = useDateSelection()
  const requests = useLatestRequest()
  const [browsedMonth, setMonth] = useState<Date | null>(null)
  const selectedMonth = selectedDate.slice(0, 7)
  const month = useMemo(() => browsedMonth ?? new Date(`${selectedMonth}-01T12:00:00`), [browsedMonth, selectedMonth])
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [occurrences, setOccurrences] = useState<Record<number, Occurrence[]>>({})
  const [editing, setEditing] = useState<CalendarEvent | 'new' | null>(null)
  const formTriggerRef = useRef<HTMLButtonElement | null>(null)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const focusAfterRefreshRef = useRef(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const cells = monthCells(month)
    await requests.run(() => Promise.all([getCalendarEvents(), getOccurrencesForRange(iso(cells[0]), iso(cells.at(-1)!))]), {
      onStart: () => { setLoading(true); setError(null) },
      onSuccess: ([result, rangeOccurrences]) => {
        setEvents(result)
        const grouped: Record<number, Occurrence[]> = {}
        for (const item of rangeOccurrences) (grouped[item.eventId] ??= []).push(item.occurrence)
        setOccurrences(grouped)
      },
      onError: (reason) => setError(reason instanceof Error ? reason.message : 'Не удалось загрузить календарь'),
      onFinish: () => setLoading(false),
    })
  }, [month, requests])
  useEffect(() => { void load(); return () => requests.invalidate() }, [load, requests, today])

  const cells = useMemo(() => monthCells(month), [month])
  const selectedEvents = events.filter((event) => occursOn(event, selectedDate))
  const occurrenceFor = (event: CalendarEvent, date: string) => occurrences[event.id]?.find((item) => item.occurrenceDate === date)
  const selectDate = (date: string) => { setMonth(month); setSelectedDate(date) }
  const showToday = () => { setMonth(null); selectToday() }
  const changeMonth = (delta: number) => { const next = new Date(month); next.setMonth(next.getMonth() + delta); setMonth(next); setSelectedDate(iso(new Date(next.getFullYear(), next.getMonth(), 1, 12))) }
  const actions = usePageMutation(`${iso(month)}:${selectedDate}`, load, Boolean(editing) || loading)
  const openForm = (event: CalendarEvent | 'new', trigger: HTMLButtonElement) => { formTriggerRef.current = trigger; setEditing(event) }
  useEffect(() => {
    if (!focusAfterRefreshRef.current || loading || editing || actions.pending) return
    focusAfterRefreshRef.current = false
    const trigger = formTriggerRef.current?.isConnected ? formTriggerRef.current : addButtonRef.current
    trigger?.focus({ preventScroll: true })
  }, [loading, editing, actions.pending])
  const saved = () => { focusAfterRefreshRef.current = true; setEditing(null); void actions.refresh() }
  const toggleTask = (event: CalendarEvent) => actions.run('save', async () => {
    if (occurrenceFor(event, selectedDate)) await deleteOccurrence(event.id, selectedDate)
    else await completeOccurrence(event.id, selectedDate)
    return true
  }, 'Не удалось изменить задачу')
  const remove = (event: CalendarEvent) => actions.run('delete', async () => {
    if (!window.confirm(`Удалить «${event.title}»${event.scheduleType === 'ONCE' ? '' : ' и все повторения'}?`)) return false
    await deleteCalendarEvent(event.id)
    return true
  }, 'Не удалось удалить запись', 'Запись календаря удалена')

  return <div className="calendar-page">
    <section className="calendar-toolbar" aria-label="Управление календарём">
      <div className="calendar-month-navigation"><button type="button" aria-label="Предыдущий месяц" onClick={() => changeMonth(-1)}><ChevronLeft aria-hidden="true" /></button><h2 id="calendar-month-title" aria-live="polite">{new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(month)}</h2><button type="button" aria-label="Следующий месяц" onClick={() => changeMonth(1)}><ChevronRight aria-hidden="true" /></button></div>
      <button type="button" className="calendar-today-button" onClick={showToday}>Сегодня</button>
      <button type="button" ref={addButtonRef} disabled={actions.disabled} className="primary-button icon-button calendar-add-button" onClick={event => openForm('new', event.currentTarget)}><Plus aria-hidden="true" />Добавить</button>
    </section>
    {actions.pending && <p className="muted" role="status">Обновляем данные…</p>}{(error || actions.error) && <div className="notice error calendar-error" role="alert"><strong>Ошибка</strong><span>{error ?? actions.error}</span></div>}
    <section className="calendar-layout">
      <article className="calendar-month" aria-labelledby="calendar-month-title" aria-busy={loading}>
        <div className="calendar-weekdays" aria-hidden="true">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-month-grid">{cells.map((date) => {
          const key = iso(date), daily = events.filter((event) => occursOn(event, key))
          return <button type="button" className={`${date.getMonth() === month.getMonth() ? '' : 'outside'} ${key === today ? 'today' : ''} ${key === selectedDate ? 'selected' : ''}`.trim()} key={key}
            aria-label={`${fullDate(key)}: ${recordCount(daily.length)}`} aria-pressed={key === selectedDate} aria-current={key === today ? 'date' : undefined} onClick={() => selectDate(key)}>
            <span className="calendar-day-number" aria-hidden="true">{date.getDate()}</span><span className="calendar-day-events" aria-hidden="true">{daily.slice(0, 3).map((event) => <i className={event.eventType.toLowerCase()} key={event.id} title={event.title}>{event.title}</i>)}{daily.length > 3 && <small>+{daily.length - 3}</small>}</span>
          </button>
        })}</div>
        <div className="calendar-legend" aria-label="Типы записей">{Object.entries(eventLabels).map(([type, label]) => <span key={type}><i className={type.toLowerCase()} aria-hidden="true" />{label}</span>)}</div>
      </article>
      <aside className="calendar-agenda" aria-labelledby="calendar-agenda-title" aria-busy={loading}>
        <div className="calendar-agenda-heading" aria-live="polite" aria-atomic="true"><p className="eyebrow">Выбранный день</p><h3 id="calendar-agenda-title">{new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' }).format(dateFromIso(selectedDate))}</h3><span>{recordCount(selectedEvents.length)}</span></div>
        {loading ? <div className="loading" role="status"><span />Загружаем записи…</div> : selectedEvents.length === 0 ? <div className="calendar-agenda-empty"><span><CalendarPlus aria-hidden="true" /></span><p>{error ? 'Не удалось получить записи на этот день.' : 'На этот день ничего не запланировано.'}</p><button type="button" disabled={actions.disabled} className="icon-button" onClick={event => openForm('new', event.currentTarget)}><Plus aria-hidden="true" />Добавить запись</button></div> : <div className="calendar-agenda-list">{selectedEvents.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '')).map((event) => { const occurrence = occurrenceFor(event, selectedDate); return <article className={`${event.eventType.toLowerCase()} ${occurrence?.status === 'COMPLETED' ? 'completed' : ''}`} key={event.id}>
          {event.eventType === 'TASK' ? <button type="button" disabled={actions.disabled} className="calendar-agenda-check" aria-label={`Выполнено: ${event.title}`} aria-pressed={occurrence?.status === 'COMPLETED'} onClick={() => void toggleTask(event)}>{occurrence?.status === 'COMPLETED' && <Check aria-hidden="true" />}</button> : <span className="calendar-agenda-type-dot" aria-hidden="true" />}
          <div className="calendar-agenda-content"><small>{event.allDay ? 'Весь день' : event.startTime ? `${event.startTime.slice(0, 5)}${event.endTime ? ` — ${event.endTime.slice(0, 5)}` : ''}` : 'Без времени'} · {eventLabels[event.eventType]}</small><strong>{event.title}</strong>{event.location && <p><MapPin aria-hidden="true" />{event.location}</p>}</div>
          <div className="calendar-agenda-actions"><button type="button" disabled={actions.disabled} aria-label={`Изменить: ${event.title}`} onClick={mouseEvent => openForm(event, mouseEvent.currentTarget)}><Pencil aria-hidden="true" /><span>Изменить</span></button><button type="button" disabled={actions.disabled} aria-label={`Удалить: ${event.title}`} onClick={() => void remove(event)}><Trash2 aria-hidden="true" /><span>Удалить</span></button></div>
        </article>})}</div>}
      </aside>
    </section>
    {editing && <CalendarForm event={editing === 'new' ? undefined : editing} initialDate={selectedDate} returnFocusTo={formTriggerRef.current} onClose={() => setEditing(null)} onSaved={saved} />}
  </div>
}

function CalendarForm({ event, initialDate, returnFocusTo, onClose, onSaved }: { event?: CalendarEvent; initialDate: string; returnFocusTo: HTMLButtonElement | null; onClose: () => void; onSaved: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { showToast } = useToast()
  const [form, setForm] = useState<CalendarEventInput>(event ? { ...event } : emptyEvent(initialDate))
  const mutations = useFormMutation()
  const { saving, pending } = mutations
  const [error, setError] = useState<string | null>(null)
  const closeForm = () => { mutations.dispose(); onClose() }
  const set = <K extends keyof CalendarEventInput>(key: K, value: CalendarEventInput[K]) => setForm((current) => ({ ...current, [key]: value }))
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const viewport = window.visualViewport
    const syncSize = () => {
      dialog.style.setProperty('--calendar-dialog-height', `${viewport?.height ?? window.innerHeight}px`)
      dialog.style.setProperty('--calendar-dialog-offset', `${viewport?.offsetTop ?? 0}px`)
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
  const submit = async (submitEvent: FormEvent) => {
    submitEvent.preventDefault()
    if (pending) return
    setError(null)
    if (form.scheduleType === 'SELECTED_DAYS' && !form.scheduleDays.length) { setError('Выберите хотя бы один день недели.'); return }
    if (!form.allDay && form.startTime && form.endTime && form.endTime.padEnd(8, ':00') <= form.startTime.padEnd(8, ':00')) { setError('Окончание должно быть позже начала.'); return }
    const input = { ...form, description: form.description || null, location: form.location || null, repeatUntil: form.scheduleType === 'ONCE' ? null : form.repeatUntil || null, startTime: form.allDay ? null : form.startTime || null, endTime: form.allDay ? null : form.endTime || null, scheduleDays: form.scheduleType === 'SELECTED_DAYS' ? form.scheduleDays : [] }
    await mutations.run('save', () => event ? updateCalendarEvent(event.id, input) : createCalendarEvent(input), {
      onSuccess: () => { showToast(event ? 'Запись календаря обновлена' : 'Запись календаря добавлена'); onSaved() },
      onError: (reason) => setError(reason instanceof Error ? reason.message : 'Не удалось сохранить запись'),
    })
  }
  return <dialog ref={dialogRef} className="calendar-dialog" aria-labelledby="calendar-form-title"
    onCancel={event => { event.preventDefault(); closeForm() }} onClick={event => { if (event.target === event.currentTarget) closeForm() }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return
      const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}><form className="calendar-form" onSubmit={(submitEvent) => void submit(submitEvent)}>
    <header className="calendar-form-heading"><div><p className="eyebrow">Календарь</p><h2 id="calendar-form-title">{event ? 'Редактирование' : 'Новая запись'}</h2></div><button type="button" className="calendar-form-close" aria-label="Закрыть форму" autoFocus onClick={closeForm}><X aria-hidden="true" /></button></header>
    <div className="calendar-form-body">{error && <div className="form-error" role="alert">{error}</div>}
    <label>Название<input required maxLength={300} value={form.title} onChange={(inputEvent) => set('title', inputEvent.target.value)} /></label>
    <div className="calendar-form-grid"><label>Тип<select value={form.eventType} onChange={(inputEvent) => set('eventType', inputEvent.target.value as EventType)}>{Object.entries(eventLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Повторение<select value={form.scheduleType} onChange={(inputEvent) => set('scheduleType', inputEvent.target.value as CalendarEventInput['scheduleType'])}>{Object.entries(scheduleLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Дата начала<input required type="date" value={form.startDate} onChange={(inputEvent) => set('startDate', inputEvent.target.value)} /></label>{form.scheduleType !== 'ONCE' && <label>Повторять до<input type="date" min={form.startDate} value={form.repeatUntil ?? ''} onChange={(inputEvent) => set('repeatUntil', inputEvent.target.value || null)} /></label>}</div>
    {form.scheduleType === 'SELECTED_DAYS' && <fieldset className="calendar-weekday-picker"><legend>Дни недели</legend><div>{weekdays.map((day, index) => <label key={day}><input type="checkbox" checked={form.scheduleDays.includes(index + 1)} onChange={() => set('scheduleDays', form.scheduleDays.includes(index + 1) ? form.scheduleDays.filter((item) => item !== index + 1) : [...form.scheduleDays, index + 1])} /><span>{day}</span></label>)}</div></fieldset>}
    <label className="calendar-all-day-check"><input type="checkbox" checked={form.allDay} onChange={(inputEvent) => set('allDay', inputEvent.target.checked)} />Весь день</label>
    {!form.allDay && <div className="calendar-form-grid"><label>Время начала<input type="time" value={form.startTime?.slice(0, 5) ?? ''} onChange={(inputEvent) => set('startTime', inputEvent.target.value || null)} /></label><label>Время окончания<input type="time" value={form.endTime?.slice(0, 5) ?? ''} onChange={(inputEvent) => set('endTime', inputEvent.target.value || null)} /></label></div>}
    <label>Место<input maxLength={500} value={form.location ?? ''} onChange={(inputEvent) => set('location', inputEvent.target.value)} /></label><label>Описание<textarea rows={3} value={form.description ?? ''} onChange={(inputEvent) => set('description', inputEvent.target.value)} /></label>
    </div><footer className="calendar-form-actions"><button className="secondary-button" type="button" onClick={closeForm}>Отмена</button><button className="primary-button" disabled={pending}>{saving ? 'Сохраняем…' : 'Сохранить'}</button></footer>
  </form></dialog>
}
