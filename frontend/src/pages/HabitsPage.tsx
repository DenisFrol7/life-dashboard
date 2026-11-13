import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  createHabit, deleteHabit, deleteHabitEntry, getHabitEntries, getHabitEntriesForDate, getHabits, putHabitEntry, updateHabit,
  type Habit, type HabitEntry, type HabitInput, type HabitStatus,
} from '../api/habits'
import { useToast } from '../components/ToastContext'
import { useToday } from '../hooks/useToday'
import { useLatestRequest } from '../hooks/useLatestRequest'
import { useFormMutation } from '../hooks/useFormMutation'
import { usePageMutation } from '../hooks/usePageMutation'
import { localDate } from '../utils/localDay'
import { Check, History, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import './HabitsPage.css'

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const statusLabels: Record<HabitStatus, string> = { ACTIVE: 'Активные', PAUSED: 'На паузе', ARCHIVED: 'Архив' }
const sourceLabels = { MANUAL: 'Вручную', DAILY_ACTIVITY_STEPS: 'Из активности: шаги', DAILY_ACTIVITY_DISTANCE: 'Из активности: дистанция', SLEEP_DURATION: 'Из сна' }
const formatAutomatedValue = (habit: Habit, entry?: HabitEntry) => {
  if (entry?.value == null) return 'нет данных'
  if (habit.dataSource === 'SLEEP_DURATION') {
    const minutes = Math.round(entry.value)
    const hours = Math.floor(minutes / 60)
    const remainder = minutes % 60
    return hours ? `${hours} ч${remainder ? ` ${remainder} мин` : ''}` : `${remainder} мин`
  }
  return `${entry.value} ${habit.unit ?? ''}`.trim()
}

const emptyHabit = (date: string): HabitInput => ({
  name: '', description: null, trackingType: 'BOOLEAN', dataSource: 'MANUAL', targetValue: 1,
  unit: null, scheduleType: 'DAILY', startDate: date, endDate: null, status: 'ACTIVE', scheduleDays: [],
})
const formatHistoryValue = (habit: Habit, entry: HabitEntry) => {
  if (entry.skipped) return 'Пропущено'
  if (habit.trackingType === 'BOOLEAN') return entry.value === 1 ? 'Выполнено' : 'Не выполнено'
  if (habit.trackingType === 'DURATION' && habit.dataSource !== 'SLEEP_DURATION') return `${entry.value ?? '—'} ${habit.unit ?? 'мин'}`
  return formatAutomatedValue(habit, entry)
}

export function HabitsPage() {
  const today = useToday()
  const requests = useLatestRequest()
  const [status, setStatus] = useState<HabitStatus>('ACTIVE')
  const [habits, setHabits] = useState<Habit[]>([])
  const [entries, setEntries] = useState<Record<number, HabitEntry | undefined>>({})
  const [editing, setEditing] = useState<Habit | 'new' | null>(null)
  const [history, setHistory] = useState<Habit | null>(null)
  const dialogTriggerRef = useRef<HTMLButtonElement | null>(null)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const focusAfterRefreshRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    await requests.run(() => Promise.all([getHabits(status), getHabitEntriesForDate(today)]), {
      onStart: () => { setLoading(true); setError(null) },
      onSuccess: ([result, datedEntries]) => {
        setHabits(result)
        setEntries(Object.fromEntries(datedEntries.map((item) => [item.habitId, item.entry])))
      },
      onError: (reason) => setError(reason instanceof Error ? reason.message : 'Не удалось загрузить привычки'),
      onFinish: () => setLoading(false),
    })
  }, [status, today, requests])

  useEffect(() => { void load(); return () => requests.invalidate() }, [load, requests])

  const actions = usePageMutation(`${today}:${status}`, load, Boolean(editing) || Boolean(history) || loading)
  const openForm = (habit: Habit | 'new', trigger: HTMLButtonElement) => { dialogTriggerRef.current = trigger; setEditing(habit) }
  const openHistory = (habit: Habit, trigger: HTMLButtonElement) => { dialogTriggerRef.current = trigger; setHistory(habit) }
  useEffect(() => {
    if (!focusAfterRefreshRef.current || loading || editing || actions.pending) return
    focusAfterRefreshRef.current = false
    const trigger = dialogTriggerRef.current?.isConnected ? dialogTriggerRef.current : addButtonRef.current
    trigger?.focus({ preventScroll: true })
  }, [loading, editing, actions.pending])
  const saved = () => { focusAfterRefreshRef.current = true; setEditing(null); void actions.refresh() }
  const toggleBoolean = (habit: Habit) => actions.run('save', async () => {
    const entry = entries[habit.id]
    if (entry?.entryDate === today && !entry.skipped && entry.value === 1) await deleteHabitEntry(habit.id, today)
    else await putHabitEntry(habit.id, today, 1)
    return true
  }, 'Не удалось сохранить отметку')
  const saveValue = (habit: Habit, value: number) => actions.run('save', async () => {
    await putHabitEntry(habit.id, today, value)
    return true
  }, 'Не удалось сохранить значение')
  const remove = (habit: Habit) => actions.run('delete', async () => {
    if (!window.confirm(`Удалить привычку «${habit.name}» вместе с историей?`)) return false
    await deleteHabit(habit.id)
    return true
  }, 'Не удалось удалить привычку', 'Привычка удалена')

  return (
    <div className="habits-page">
      <section className="habits-toolbar">
        <div className="habits-filter-tabs" role="group" aria-label="Статус привычек">
          {(Object.keys(statusLabels) as HabitStatus[]).map((value) =>
            <button type="button" className={status === value ? 'active' : ''} aria-pressed={status === value} key={value} onClick={() => setStatus(value)}>{statusLabels[value]}</button>)}
        </div>
        <button type="button" ref={addButtonRef} disabled={actions.disabled} className="primary-button icon-button habits-add-button" onClick={event => openForm('new', event.currentTarget)}><Plus aria-hidden="true" />Новая привычка</button>
      </section>

      {actions.pending && <p className="muted" role="status">Обновляем данные…</p>}{(error || actions.error) && <div className="notice error habit-error" role="alert"><strong>Ошибка</strong><span>{error ?? actions.error}</span></div>}
      {loading && habits.length === 0 ? <div className="loading" role="status"><span />Загружаем привычки…</div> : habits.length === 0 ? (
        <section className="habits-empty"><span><Check aria-hidden="true" /></span><h2>{error ? 'Не удалось загрузить привычки' : 'Здесь пока пусто'}</h2><p>{error ? 'Попробуйте загрузить список ещё раз.' : status === 'ACTIVE' ? 'Создайте первую привычку и начните отмечать прогресс.' : status === 'PAUSED' ? 'Привычек на паузе пока нет.' : 'В архиве пока нет привычек.'}</p>{error && <button type="button" className="secondary-button" onClick={() => void load()}>Повторить загрузку</button>}</section>
      ) : (
        <section className="habit-list" aria-label={statusLabels[status]} aria-busy={loading}>
          {habits.map((habit) => <HabitCard key={`${habit.id}:${today}`} habit={habit} entry={entries[habit.id]?.entryDate === today ? entries[habit.id] : undefined} disabled={actions.disabled}
            onToggle={() => void toggleBoolean(habit)} onValue={(value) => saveValue(habit, value)}
            onEdit={trigger => openForm(habit, trigger)} onHistory={trigger => openHistory(habit, trigger)} onDelete={() => void remove(habit)} />)}
        </section>
      )}

      {editing && <HabitForm habit={editing === 'new' ? undefined : editing} returnFocusTo={dialogTriggerRef.current} onClose={() => setEditing(null)} onSaved={saved} />}
      {history && <HabitHistory habit={history} returnFocusTo={dialogTriggerRef.current} onClose={() => setHistory(null)} />}
    </div>
  )
}

function HabitCard({ habit, entry, disabled, onToggle, onValue, onEdit, onHistory, onDelete }: {
  habit: Habit; entry?: HabitEntry; disabled: boolean; onToggle: () => void; onValue: (value: number) => Promise<boolean>; onEdit: (trigger: HTMLButtonElement) => void; onHistory: (trigger: HTMLButtonElement) => void; onDelete: () => void
}) {
  const [value, setValue] = useState(entry?.value?.toString() ?? '')
  const dirty = useRef(false)
  const revision = useRef(0)
  useEffect(() => { if (!dirty.current) setValue(entry?.value?.toString() ?? '') }, [entry])
  const submitValue = async (event: FormEvent) => {
    event.preventDefault()
    if (disabled || value === '') return
    const submittedRevision = revision.current
    const saved = await onValue(Number(value))
    if (saved && revision.current === submittedRevision) dirty.current = false
  }
  const schedule = habit.scheduleType === 'DAILY' ? 'Каждый день' : habit.scheduleDays.map((day) => weekdays[day - 1]).join(', ')
  const automated = habit.dataSource !== 'MANUAL'
  const completed = Boolean(entry && !entry.skipped && (habit.trackingType !== 'BOOLEAN' || entry.value === 1))
  return (
    <article className={completed ? 'habit-card completed' : 'habit-card'}>
      <div className="habit-card-main">
        {habit.trackingType === 'BOOLEAN' && !automated ?
          <button type="button" className="habit-check" aria-label={`Выполнено: ${habit.name}`} aria-pressed={completed} disabled={disabled} onClick={onToggle}>{completed && <Check aria-hidden="true" />}</button> :
          <span className="habit-source-icon" aria-hidden="true">{automated ? <RefreshCw /> : '#'}</span>}
        <div className="habit-copy"><h3>{habit.name}</h3>{habit.description && <p>{habit.description}</p>}
          <div className="habit-meta"><span>{schedule}</span><span>{sourceLabels[habit.dataSource]}</span></div></div>
      </div>
      {habit.trackingType !== 'BOOLEAN' && !automated && <form className="habit-value-form" onSubmit={(event) => void submitValue(event)}>
        <label>Сегодня{habit.unit || habit.trackingType === 'DURATION' ? `, ${habit.unit ?? 'мин'}` : ''}<input type="number" inputMode="decimal" min="0" step="0.01" aria-label={`Значение за сегодня: ${habit.name}${habit.unit ? `, ${habit.unit}` : ''}`} value={value} onChange={(event) => { dirty.current = true; revision.current++; setValue(event.target.value) }} placeholder="0" /></label>
        <button disabled={disabled || value === ''}>Сохранить</button>
        {habit.targetValue != null && <small>Цель: {habit.targetValue} {habit.unit ?? (habit.trackingType === 'DURATION' ? 'мин' : '')}</small>}
      </form>}
      {automated && <div className="habit-automated-value">Сегодня: <strong>{formatAutomatedValue(habit, entry)}</strong></div>}
      <div className="habit-actions"><button type="button" disabled={disabled} onClick={event => onHistory(event.currentTarget)} aria-label={`История: ${habit.name}`}><History aria-hidden="true" /><span>История</span></button><button type="button" disabled={disabled} onClick={event => onEdit(event.currentTarget)} aria-label={`Изменить: ${habit.name}`}><Pencil aria-hidden="true" /><span>Изменить</span></button><button type="button" disabled={disabled} onClick={onDelete} aria-label={`Удалить: ${habit.name}`}><Trash2 aria-hidden="true" /><span>Удалить</span></button></div>
    </article>
  )
}

function HabitForm({ habit, returnFocusTo, onClose, onSaved }: { habit?: Habit; returnFocusTo: HTMLButtonElement | null; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast()
  const [form, setForm] = useState<HabitInput>(() => habit ? { ...habit } : emptyHabit(localDate()))
  const mutations = useFormMutation()
  const { saving, pending } = mutations
  const [error, setError] = useState<string | null>(null)
  const closeForm = () => { mutations.dispose(); onClose() }
  const set = <K extends keyof HabitInput>(key: K, value: HabitInput[K]) => setForm((current) => ({ ...current, [key]: value }))
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    setError(null)
    if (form.scheduleType === 'SELECTED_DAYS' && !form.scheduleDays.length) { setError('Выберите хотя бы один день недели.'); return }
    const input = { ...form, description: form.description || null, unit: form.unit || null, endDate: form.endDate || null,
      scheduleDays: form.scheduleType === 'DAILY' ? [] : form.scheduleDays }
    await mutations.run('save', () => habit ? updateHabit(habit.id, input) : createHabit(input), {
      onSuccess: () => { showToast(habit ? 'Привычка обновлена' : 'Привычка добавлена'); onSaved() },
      onError: (reason) => setError(reason instanceof Error ? reason.message : 'Не удалось сохранить привычку'),
    })
  }
  return <HabitDialog returnFocusTo={returnFocusTo} onClose={closeForm}>
    <form className="habits-form" onSubmit={(event) => void submit(event)}>
      <HabitDialogHeading title={habit ? 'Редактирование' : 'Новая привычка'} onClose={closeForm} />
      <div className="habits-dialog-body habits-form-body">
      {error && <div className="form-error" role="alert">{error}</div>}
      <label>Название<input required maxLength={200} value={form.name} onChange={(event) => set('name', event.target.value)} /></label>
      <label>Описание<textarea rows={2} value={form.description ?? ''} onChange={(event) => set('description', event.target.value)} /></label>
      <div className="habits-form-grid">
        <label>Тип учёта<select value={form.trackingType} onChange={(event) => set('trackingType', event.target.value as HabitInput['trackingType'])}><option value="BOOLEAN">Да / нет</option><option value="NUMBER">Число</option><option value="DURATION">Длительность</option></select></label>
        <label>Источник<select value={form.dataSource} onChange={(event) => set('dataSource', event.target.value as HabitInput['dataSource'])}>{Object.entries(sourceLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Цель<input type="number" inputMode="decimal" min="0" step="0.01" value={form.targetValue ?? ''} onChange={(event) => set('targetValue', event.target.value === '' ? null : Number(event.target.value))} /></label>
        <label>Единица<input maxLength={50} value={form.unit ?? ''} onChange={(event) => set('unit', event.target.value)} placeholder="раз, минут, страниц" /></label>
        <label>Начало<input required type="date" value={form.startDate} onChange={(event) => set('startDate', event.target.value)} /></label>
        <label>Окончание<input type="date" min={form.startDate || undefined} value={form.endDate ?? ''} onChange={(event) => set('endDate', event.target.value || null)} /></label>
        <label>Расписание<select value={form.scheduleType} onChange={(event) => set('scheduleType', event.target.value as HabitInput['scheduleType'])}><option value="DAILY">Каждый день</option><option value="SELECTED_DAYS">Выбранные дни</option></select></label>
        <label>Статус<select value={form.status} onChange={(event) => set('status', event.target.value as HabitStatus)}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </div>
      {form.scheduleType === 'SELECTED_DAYS' && <fieldset className="habits-weekday-picker"><legend>Дни недели</legend><div>{weekdays.map((day, index) => <label key={day}><input type="checkbox" checked={form.scheduleDays.includes(index + 1)} onChange={() => set('scheduleDays', form.scheduleDays.includes(index + 1) ? form.scheduleDays.filter((item) => item !== index + 1) : [...form.scheduleDays, index + 1])} /><span>{day}</span></label>)}</div></fieldset>}
      </div><footer className="habits-dialog-actions"><button type="button" className="secondary-button" onClick={closeForm}>Отмена</button><button className="primary-button" disabled={pending}>{saving ? 'Сохраняем…' : 'Сохранить'}</button></footer>
    </form>
  </HabitDialog>
}

function HabitHistory({ habit, returnFocusTo, onClose }: { habit: Habit; returnFocusTo: HTMLButtonElement | null; onClose: () => void }) {
  const requests = useLatestRequest()
  const [entries, setEntries] = useState<HabitEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(30)
  const load = useCallback(() => requests.run(() => getHabitEntries(habit.id), {
    onStart: () => { setLoading(true); setError(null) },
    onSuccess: result => setEntries([...result].sort((a, b) => b.entryDate.localeCompare(a.entryDate))),
    onError: reason => setError(reason instanceof Error ? reason.message : 'Не удалось загрузить историю'),
    onFinish: () => setLoading(false),
  }), [habit.id, requests])
  useEffect(() => { void load(); return () => requests.invalidate() }, [load, requests])
  return <HabitDialog returnFocusTo={returnFocusTo} onClose={onClose}>
    <section className="habits-history">
      <HabitDialogHeading title="История выполнения" onClose={onClose} />
      <div className="habits-dialog-body" role="region" aria-label="Записи выполнения" tabIndex={0} aria-busy={loading}>
        <p className="habits-history-name">{habit.name}</p>
        {loading ? <div className="loading" role="status"><span />Загружаем историю…</div> : error ? <div className="habits-history-error"><p className="form-error" role="alert">{error}</p><button type="button" className="secondary-button" onClick={() => void load()}>Повторить загрузку</button></div> : entries.length === 0 ? <p className="habits-history-empty">Отметок пока нет. Здесь появятся сохранённые записи выполнения.</p> : <>
          <ol className="habits-history-list">{entries.slice(0, visibleCount).map(entry => <li key={entry.id}>
            <time dateTime={entry.entryDate}>{new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${entry.entryDate}T12:00:00`))}</time>
            <strong>{formatHistoryValue(habit, entry)}</strong>
            {!entry.skipped && habit.trackingType !== 'BOOLEAN' && entry.targetValueSnapshot != null && <span>Цель на тот день: {entry.targetValueSnapshot} {habit.unit ?? (habit.trackingType === 'DURATION' ? 'мин' : '')}</span>}
            {entry.note && <p>{entry.note}</p>}
          </li>)}</ol>
          {entries.length > visibleCount && <button type="button" className="secondary-button habits-history-more" onClick={() => setVisibleCount(count => count + 30)}>Показать ещё</button>}
        </>}
      </div>
      <footer className="habits-dialog-actions habits-history-actions"><button type="button" className="secondary-button" onClick={onClose}>Закрыть</button></footer>
    </section>
  </HabitDialog>
}

function HabitDialogHeading({ title, onClose }: { title: string; onClose: () => void }) {
  return <header className="habits-dialog-heading"><div><p className="eyebrow">Привычки</p><h2 id="habits-dialog-title">{title}</h2></div><button type="button" className="habits-dialog-close" aria-label="Закрыть окно" autoFocus onClick={onClose}><X aria-hidden="true" /></button></header>
}

function HabitDialog({ children, returnFocusTo, onClose }: { children: ReactNode; returnFocusTo: HTMLButtonElement | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const viewport = window.visualViewport
    const syncSize = () => {
      dialog.style.setProperty('--habits-dialog-height', `${viewport?.height ?? window.innerHeight}px`)
      dialog.style.setProperty('--habits-dialog-offset', `${viewport?.offsetTop ?? 0}px`)
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
  return <dialog ref={dialogRef} className="habits-dialog" aria-labelledby="habits-dialog-title"
    onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) onClose() }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return
      const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)')
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }}>{children}</dialog>
}
