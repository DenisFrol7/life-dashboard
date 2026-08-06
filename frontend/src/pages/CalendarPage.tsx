import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { completeOccurrence, createCalendarEvent, deleteCalendarEvent, deleteOccurrence, getCalendarEvents, getOccurrences, updateCalendarEvent, type CalendarEvent, type CalendarEventInput, type EventType, type Occurrence } from '../api/calendar'

const iso = (date: Date) => date.toLocaleDateString('en-CA')
const today = iso(new Date())
const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const eventLabels: Record<EventType, string> = { EVENT: 'Событие', TASK: 'Задача', REMINDER: 'Напоминание' }
const scheduleLabels = { ONCE: 'Один раз', DAILY: 'Каждый день', WEEKLY: 'Каждую неделю', SELECTED_DAYS: 'Выбранные дни' }

const emptyEvent = (date: string): CalendarEventInput => ({ title: '', description: null, eventType: 'EVENT', scheduleType: 'ONCE', startDate: date, repeatUntil: null, startTime: '09:00', endTime: '10:00', allDay: false, location: null, status: 'ACTIVE', scheduleDays: [] })
const dateFromIso = (value: string) => new Date(`${value}T12:00:00`)
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
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12))
  const [selectedDate, setSelectedDate] = useState(today)
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [occurrences, setOccurrences] = useState<Record<number, Occurrence[]>>({})
  const [editing, setEditing] = useState<CalendarEvent | 'new' | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { const result = await getCalendarEvents(); setEvents(result); const pairs = await Promise.all(result.map(async (event) => [event.id, await getOccurrences(event.id)] as const)); setOccurrences(Object.fromEntries(pairs)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось загрузить календарь') }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const cells = useMemo(() => monthCells(month), [month])
  const selectedEvents = events.filter((event) => occursOn(event, selectedDate))
  const occurrenceFor = (event: CalendarEvent, date: string) => occurrences[event.id]?.find((item) => item.occurrenceDate === date)
  const changeMonth = (delta: number) => { const next = new Date(month); next.setMonth(next.getMonth() + delta); setMonth(next); setSelectedDate(iso(new Date(next.getFullYear(), next.getMonth(), 1, 12))) }
  const toggleTask = async (event: CalendarEvent) => { try { if (occurrenceFor(event, selectedDate)) await deleteOccurrence(event.id, selectedDate); else await completeOccurrence(event.id, selectedDate); await load() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось изменить задачу') } }
  const remove = async (event: CalendarEvent) => { if (!window.confirm(`Удалить «${event.title}»${event.scheduleType === 'ONCE' ? '' : ' и все повторения'}?`)) return; try { await deleteCalendarEvent(event.id); await load() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось удалить запись') } }

  return <div className="calendar-page">
    <section className="calendar-toolbar"><div><button onClick={() => changeMonth(-1)}>‹</button><h2>{new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(month)}</h2><button onClick={() => changeMonth(1)}>›</button><button className="today-button" onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1, 12)); setSelectedDate(today) }}>Сегодня</button></div><button className="primary-button" onClick={() => setEditing('new')}>+ Добавить</button></section>
    {error && <div className="notice error calendar-error"><strong>Ошибка</strong><span>{error}</span></div>}
    <section className="calendar-layout">
      <article className="month-calendar">
        <div className="weekday-row">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
        <div className="month-grid">{cells.map((date) => { const key = iso(date); const daily = events.filter((event) => occursOn(event, key)); return <button className={`${date.getMonth() === month.getMonth() ? '' : 'outside'} ${key === today ? 'today' : ''} ${key === selectedDate ? 'selected' : ''}`} key={key} onClick={() => setSelectedDate(key)}><span>{date.getDate()}</span><div>{daily.slice(0, 3).map((event) => <i className={event.eventType.toLowerCase()} key={event.id} title={event.title}>{event.title}</i>)}{daily.length > 3 && <small>+{daily.length - 3}</small>}</div></button> })}</div>
      </article>
      <aside className="day-agenda">
        <div className="agenda-heading"><p className="eyebrow">Выбранный день</p><h3>{new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' }).format(dateFromIso(selectedDate))}</h3><span>{selectedEvents.length} записей</span></div>
        {loading ? <div className="loading"><span /></div> : selectedEvents.length === 0 ? <div className="agenda-empty"><span>□</span><p>На этот день ничего не запланировано.</p><button onClick={() => setEditing('new')}>Добавить запись</button></div> : <div className="agenda-list">{selectedEvents.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '')).map((event) => { const occurrence = occurrenceFor(event, selectedDate); return <article className={`${event.eventType.toLowerCase()} ${occurrence?.status === 'COMPLETED' ? 'completed' : ''}`} key={event.id}>
          {event.eventType === 'TASK' ? <button className="agenda-check" onClick={() => void toggleTask(event)}>{occurrence?.status === 'COMPLETED' ? '✓' : ''}</button> : <span className="agenda-type-dot" />}
          <div><small>{event.allDay ? 'Весь день' : event.startTime?.slice(0, 5) ?? 'Без времени'} · {eventLabels[event.eventType]}</small><strong>{event.title}</strong>{event.location && <p>⌖ {event.location}</p>}</div>
          <div className="agenda-actions"><button onClick={() => setEditing(event)}>✎</button><button onClick={() => void remove(event)}>×</button></div>
        </article>})}</div>}
      </aside>
    </section>
    {editing && <CalendarForm event={editing === 'new' ? undefined : editing} initialDate={selectedDate} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load() }} />}
  </div>
}

function CalendarForm({ event, initialDate, onClose, onSaved }: { event?: CalendarEvent; initialDate: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<CalendarEventInput>(event ? { ...event } : emptyEvent(initialDate))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof CalendarEventInput>(key: K, value: CalendarEventInput[K]) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (submitEvent: FormEvent) => { submitEvent.preventDefault(); setSaving(true); setError(null); const input = { ...form, description: form.description || null, location: form.location || null, repeatUntil: form.scheduleType === 'ONCE' ? null : form.repeatUntil || null, startTime: form.allDay ? null : form.startTime || null, endTime: form.allDay ? null : form.endTime || null, scheduleDays: form.scheduleType === 'SELECTED_DAYS' ? form.scheduleDays : [] }; try { if (event) await updateCalendarEvent(event.id, input); else await createCalendarEvent(input); onSaved() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить запись') } finally { setSaving(false) } }
  return <div className="modal-backdrop" onMouseDown={(mouseEvent) => { if (mouseEvent.target === mouseEvent.currentTarget) onClose() }}><form className="habit-form calendar-form" onSubmit={(submitEvent) => void submit(submitEvent)}>
    <div className="form-heading"><div><p className="eyebrow">Календарь</p><h2>{event ? 'Редактирование' : 'Новая запись'}</h2></div><button type="button" onClick={onClose}>×</button></div>{error && <div className="form-error">{error}</div>}
    <label>Название<input required maxLength={300} value={form.title} onChange={(inputEvent) => set('title', inputEvent.target.value)} /></label>
    <div className="form-grid"><label>Тип<select value={form.eventType} onChange={(inputEvent) => set('eventType', inputEvent.target.value as EventType)}>{Object.entries(eventLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Повторение<select value={form.scheduleType} onChange={(inputEvent) => set('scheduleType', inputEvent.target.value as CalendarEventInput['scheduleType'])}>{Object.entries(scheduleLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Начало<input required type="date" value={form.startDate} onChange={(inputEvent) => set('startDate', inputEvent.target.value)} /></label>{form.scheduleType !== 'ONCE' && <label>Повторять до<input type="date" min={form.startDate} value={form.repeatUntil ?? ''} onChange={(inputEvent) => set('repeatUntil', inputEvent.target.value || null)} /></label>}</div>
    {form.scheduleType === 'SELECTED_DAYS' && <fieldset className="weekday-picker"><legend>Дни недели</legend>{weekdays.map((day, index) => <label key={day}><input type="checkbox" checked={form.scheduleDays.includes(index + 1)} onChange={() => set('scheduleDays', form.scheduleDays.includes(index + 1) ? form.scheduleDays.filter((item) => item !== index + 1) : [...form.scheduleDays, index + 1])} />{day}</label>)}</fieldset>}
    <label className="all-day-check"><input type="checkbox" checked={form.allDay} onChange={(inputEvent) => set('allDay', inputEvent.target.checked)} />Весь день</label>
    {!form.allDay && <div className="form-grid"><label>Начало<input type="time" value={form.startTime?.slice(0, 5) ?? ''} onChange={(inputEvent) => set('startTime', inputEvent.target.value || null)} /></label><label>Окончание<input type="time" value={form.endTime?.slice(0, 5) ?? ''} onChange={(inputEvent) => set('endTime', inputEvent.target.value || null)} /></label></div>}
    <label>Место<input maxLength={500} value={form.location ?? ''} onChange={(inputEvent) => set('location', inputEvent.target.value)} /></label><label>Описание<textarea rows={3} value={form.description ?? ''} onChange={(inputEvent) => set('description', inputEvent.target.value)} /></label>
    <div className="form-buttons"><button className="secondary-button" type="button" onClick={onClose}>Отмена</button><button className="primary-button" disabled={saving}>{saving ? 'Сохраняем…' : 'Сохранить'}</button></div>
  </form></div>
}
