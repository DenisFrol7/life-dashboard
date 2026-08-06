import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  createHabit, deleteHabit, deleteHabitEntry, getHabitEntries, getHabits, putHabitEntry, updateHabit,
  type Habit, type HabitEntry, type HabitInput, type HabitStatus,
} from '../api/habits'

const today = new Date().toLocaleDateString('en-CA')
const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const statusLabels: Record<HabitStatus, string> = { ACTIVE: 'Активные', PAUSED: 'На паузе', ARCHIVED: 'Архив' }
const sourceLabels = { MANUAL: 'Вручную', DAILY_ACTIVITY_STEPS: 'Из активности: шаги', DAILY_ACTIVITY_DISTANCE: 'Из активности: дистанция', SLEEP_DURATION: 'Из сна' }

const emptyHabit: HabitInput = {
  name: '', description: null, trackingType: 'BOOLEAN', dataSource: 'MANUAL', targetValue: 1,
  unit: null, scheduleType: 'DAILY', startDate: today, endDate: null, status: 'ACTIVE', scheduleDays: [],
}

export function HabitsPage() {
  const [status, setStatus] = useState<HabitStatus>('ACTIVE')
  const [habits, setHabits] = useState<Habit[]>([])
  const [entries, setEntries] = useState<Record<number, HabitEntry | undefined>>({})
  const [editing, setEditing] = useState<Habit | 'new' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const result = await getHabits(status)
      setHabits(result)
      const pairs = await Promise.all(result.map(async (habit) => {
        const all = await getHabitEntries(habit.id)
        return [habit.id, all.find((entry) => entry.entryDate === today)] as const
      }))
      setEntries(Object.fromEntries(pairs))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось загрузить привычки')
    } finally { setLoading(false) }
  }, [status])

  useEffect(() => { void load() }, [load])

  const toggleBoolean = async (habit: Habit) => {
    try {
      if (entries[habit.id]) await deleteHabitEntry(habit.id, today)
      else await putHabitEntry(habit.id, today, 1)
      await load()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить отметку') }
  }

  const saveValue = async (habit: Habit, value: number) => {
    try { await putHabitEntry(habit.id, today, value); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить значение') }
  }

  const remove = async (habit: Habit) => {
    if (!window.confirm(`Удалить привычку «${habit.name}» вместе с историей?`)) return
    try { await deleteHabit(habit.id); await load() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось удалить привычку') }
  }

  return (
    <div className="habits-page">
      <section className="habits-toolbar">
        <div className="filter-tabs" aria-label="Статус привычек">
          {(Object.keys(statusLabels) as HabitStatus[]).map((value) =>
            <button className={status === value ? 'active' : ''} key={value} onClick={() => setStatus(value)}>{statusLabels[value]}</button>)}
        </div>
        <button className="primary-button" onClick={() => setEditing('new')}>+ Новая привычка</button>
      </section>

      {error && <div className="notice error habit-error"><strong>Ошибка</strong><span>{error}</span></div>}
      {loading ? <div className="loading"><span />Загружаем привычки…</div> : habits.length === 0 ? (
        <section className="habits-empty"><span>✓</span><h2>Здесь пока пусто</h2><p>Создайте первую привычку и начните отмечать прогресс.</p></section>
      ) : (
        <section className="habit-list">
          {habits.map((habit) => <HabitCard key={habit.id} habit={habit} entry={entries[habit.id]}
            onToggle={() => void toggleBoolean(habit)} onValue={(value) => void saveValue(habit, value)}
            onEdit={() => setEditing(habit)} onDelete={() => void remove(habit)} />)}
        </section>
      )}

      {editing && <HabitForm habit={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load() }} />}
    </div>
  )
}

function HabitCard({ habit, entry, onToggle, onValue, onEdit, onDelete }: {
  habit: Habit; entry?: HabitEntry; onToggle: () => void; onValue: (value: number) => void; onEdit: () => void; onDelete: () => void
}) {
  const [value, setValue] = useState(entry?.value?.toString() ?? '')
  useEffect(() => setValue(entry?.value?.toString() ?? ''), [entry])
  const schedule = habit.scheduleType === 'DAILY' ? 'Каждый день' : habit.scheduleDays.map((day) => weekdays[day - 1]).join(', ')
  const automated = habit.dataSource !== 'MANUAL'
  return (
    <article className={entry && !entry.skipped ? 'habit-card completed' : 'habit-card'}>
      <div className="habit-card-main">
        {habit.trackingType === 'BOOLEAN' && !automated ?
          <button className="habit-check" aria-label="Отметить выполнение" onClick={onToggle}>{entry ? '✓' : ''}</button> :
          <span className="habit-source-icon">{automated ? '↻' : '#'}</span>}
        <div className="habit-copy"><h3>{habit.name}</h3>{habit.description && <p>{habit.description}</p>}
          <div className="habit-meta"><span>{schedule}</span><span>{sourceLabels[habit.dataSource]}</span></div></div>
        <div className="habit-actions"><button onClick={onEdit} title="Редактировать">✎</button><button onClick={onDelete} title="Удалить">×</button></div>
      </div>
      {habit.trackingType !== 'BOOLEAN' && !automated && <form className="value-form" onSubmit={(event) => { event.preventDefault(); if (value !== '') onValue(Number(value)) }}>
        <input type="number" min="0" step="0.01" value={value} onChange={(event) => setValue(event.target.value)} placeholder="0" />
        <span>{habit.unit ?? (habit.trackingType === 'DURATION' ? 'мин' : '')}</span><button>Сохранить</button>
        {habit.targetValue != null && <small>Цель: {habit.targetValue} {habit.unit}</small>}
      </form>}
      {automated && <div className="automated-value">Сегодня: <strong>{entry?.value ?? 'нет данных'} {habit.unit}</strong></div>}
    </article>
  )
}

function HabitForm({ habit, onClose, onSaved }: { habit?: Habit; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<HabitInput>(habit ? { ...habit } : emptyHabit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof HabitInput>(key: K, value: HabitInput[K]) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null)
    const input = { ...form, description: form.description || null, unit: form.unit || null, endDate: form.endDate || null,
      scheduleDays: form.scheduleType === 'DAILY' ? [] : form.scheduleDays }
    try { if (habit) await updateHabit(habit.id, input); else await createHabit(input); onSaved() }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить привычку') }
    finally { setSaving(false) }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <form className="habit-form" onSubmit={(event) => void submit(event)}>
      <div className="form-heading"><div><p className="eyebrow">Привычки</p><h2>{habit ? 'Редактирование' : 'Новая привычка'}</h2></div><button type="button" onClick={onClose}>×</button></div>
      {error && <div className="form-error">{error}</div>}
      <label>Название<input required maxLength={200} value={form.name} onChange={(event) => set('name', event.target.value)} /></label>
      <label>Описание<textarea rows={2} value={form.description ?? ''} onChange={(event) => set('description', event.target.value)} /></label>
      <div className="form-grid">
        <label>Тип учёта<select value={form.trackingType} onChange={(event) => set('trackingType', event.target.value as HabitInput['trackingType'])}><option value="BOOLEAN">Да / нет</option><option value="NUMBER">Число</option><option value="DURATION">Длительность</option></select></label>
        <label>Источник<select value={form.dataSource} onChange={(event) => set('dataSource', event.target.value as HabitInput['dataSource'])}>{Object.entries(sourceLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Цель<input type="number" min="0" step="0.01" value={form.targetValue ?? ''} onChange={(event) => set('targetValue', event.target.value === '' ? null : Number(event.target.value))} /></label>
        <label>Единица<input maxLength={50} value={form.unit ?? ''} onChange={(event) => set('unit', event.target.value)} placeholder="раз, минут, страниц" /></label>
        <label>Начало<input required type="date" value={form.startDate} onChange={(event) => set('startDate', event.target.value)} /></label>
        <label>Окончание<input type="date" value={form.endDate ?? ''} onChange={(event) => set('endDate', event.target.value || null)} /></label>
        <label>Расписание<select value={form.scheduleType} onChange={(event) => set('scheduleType', event.target.value as HabitInput['scheduleType'])}><option value="DAILY">Каждый день</option><option value="SELECTED_DAYS">Выбранные дни</option></select></label>
        <label>Статус<select value={form.status} onChange={(event) => set('status', event.target.value as HabitStatus)}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </div>
      {form.scheduleType === 'SELECTED_DAYS' && <fieldset className="weekday-picker"><legend>Дни недели</legend>{weekdays.map((day, index) => <label key={day}><input type="checkbox" checked={form.scheduleDays.includes(index + 1)} onChange={() => set('scheduleDays', form.scheduleDays.includes(index + 1) ? form.scheduleDays.filter((item) => item !== index + 1) : [...form.scheduleDays, index + 1])} />{day}</label>)}</fieldset>}
      <div className="form-buttons"><button type="button" className="secondary-button" onClick={onClose}>Отмена</button><button className="primary-button" disabled={saving}>{saving ? 'Сохраняем…' : 'Сохранить'}</button></div>
    </form>
  </div>
}
