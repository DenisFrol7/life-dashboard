import { useState, type FormEvent } from 'react'
import { createReadingSession, deleteReadingSession, putBookProgress, updateReadingSession, type Book, type ReadingSession } from '../api/books'
import { getApiErrorMessage } from '../api/client'
import { useFormMutation } from '../hooks/useFormMutation'
import { SeriesFormDialog } from './SeriesFormDialog'

type Callbacks = { onClose: () => void; onSaved: () => void; returnFocusTo?: HTMLElement | null }
const localDateTime = (value: string) => {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : ''
}

export function BookProgressForm({ book, returnFocusTo, onClose, onSaved }: Callbacks & { book: Book }) {
  const audio = book.bookFormat === 'AUDIOBOOK'
  const total = audio ? book.durationMinutes : book.pageCount
  const [value, setValue] = useState(String((audio ? book.currentMinute : book.currentPage) ?? 0))
  const [error, setError] = useState<string | null>(null)
  const mutations = useFormMutation()
  const { saving, pending } = mutations
  const closeForm = () => { mutations.dispose(); onClose() }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    setError(null)
    const position = Number(value)
    if (!value.trim() || !Number.isSafeInteger(position) || position < 0 || (total != null && position > total)) {
      setError(audio ? 'Укажите целую минуту от нуля до длительности аудиокниги.' : 'Укажите целую страницу от нуля до объёма книги.')
      return
    }
    await mutations.run('save', () => putBookProgress(book.id, audio ? null : position, audio ? position : null), {
      onSuccess: onSaved,
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось обновить прогресс')),
    })
  }
  return <SeriesFormDialog title={audio ? 'Прогресс прослушивания' : 'Прогресс чтения'} eyebrow="Прогресс" context={book.title} returnFocusTo={returnFocusTo} pending={pending} error={error} onClose={closeForm} onSubmit={event => void submit(event)} actions={<>
    <button type="button" className="secondary-button" onClick={closeForm}>Отмена</button><button className="primary-button" disabled={pending}>{saving ? 'Сохраняем…' : 'Сохранить'}</button>
  </>}>
    <label>{audio ? 'Текущая позиция, минут' : 'Текущая страница'}<input required min="0" max={total ?? undefined} step="1" type="number" inputMode="numeric" value={value} onChange={event => setValue(event.target.value)} /></label>
    <p className="series-editor-hint">{total != null ? `Всего: ${total} ${audio ? 'минут' : 'страниц'}.` : audio ? 'Длительность аудиокниги не указана.' : 'Объём книги не указан.'} Изменение позиции не создаёт сеанс в истории.</p>
  </SeriesFormDialog>
}

export function BookSessionForm({ book, session, returnFocusTo, onClose, onSaved }: Callbacks & { book: Book; session?: ReadingSession }) {
  const audio = book.bookFormat === 'AUDIOBOOK'
  const total = audio ? book.durationMinutes : book.pageCount
  const current = (audio ? book.currentMinute : book.currentPage) ?? 0
  const previous = (audio ? session?.listenedMinutes : session?.pagesRead) ?? 0
  const maximum = total != null ? Math.max(0, total - current + previous) : undefined
  const [initialStartedAt] = useState(() => session?.startedAt ?? new Date().toISOString())
  const [startedAt, setStartedAt] = useState(() => localDateTime(initialStartedAt))
  const [minutes, setMinutes] = useState(String(session?.durationMinutes ?? 30))
  const [amount, setAmount] = useState(String(previous))
  const [note, setNote] = useState(session?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const mutations = useFormMutation()
  const { saving, deleting, pending } = mutations
  const closeForm = () => { mutations.dispose(); onClose() }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    setError(null)
    if (!startedAt || !Number.isFinite(Date.parse(startedAt))) { setError('Укажите дату и время начала сеанса.'); return }
    const durationMinutes = Number(minutes), progressAmount = Number(amount)
    if (!minutes.trim() || !Number.isSafeInteger(durationMinutes) || durationMinutes < 1) { setError('Укажите продолжительность сеанса в целых минутах, не меньше одной.'); return }
    if (!amount.trim() || !Number.isSafeInteger(progressAmount) || progressAmount < 0 || (maximum != null && progressAmount > maximum)) {
      setError(audio ? 'Укажите целое количество прослушанных минут в пределах оставшейся длительности.' : 'Укажите целое количество прочитанных страниц в пределах оставшегося объёма.')
      return
    }
    // Preserve the original instant, including seconds and its offset, unless the date field was changed.
    const instant = startedAt === localDateTime(initialStartedAt) ? initialStartedAt : new Date(startedAt).toISOString()
    const input = { startedAt: instant, durationMinutes, pagesRead: audio ? 0 : progressAmount, listenedMinutes: audio ? progressAmount : 0, note: note.trim() || null }
    await mutations.run('save', () => session ? updateReadingSession(session.id, input) : createReadingSession(book.id, input), {
      onSuccess: onSaved,
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось сохранить сеанс')),
    })
  }
  const remove = async () => {
    if (!session || pending) return
    setError(null)
    await mutations.run('delete', async () => {
      if (!window.confirm(audio ? 'Удалить сеанс прослушивания?' : 'Удалить сеанс чтения?')) return false
      await deleteReadingSession(session.id)
      return true
    }, {
      onSuccess: deleted => { if (deleted) onSaved() },
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось удалить сеанс')),
    })
  }
  return <SeriesFormDialog title={session ? 'Редактирование сеанса' : 'Новый сеанс'} eyebrow={audio ? 'Прослушивание' : 'Чтение'} context={book.title} returnFocusTo={returnFocusTo} pending={pending} error={error} onClose={closeForm} onSubmit={event => void submit(event)} actions={<>
    {session && <button type="button" className="movie-dialog-delete" disabled={pending} onClick={() => void remove()}>{deleting ? 'Удаляем…' : 'Удалить сеанс'}</button>}
    <button type="button" className="secondary-button" onClick={closeForm}>Отмена</button><button className="primary-button" disabled={pending}>{saving ? 'Сохраняем…' : 'Сохранить'}</button>
  </>}>
    <label>Начало<input required type="datetime-local" value={startedAt} onChange={event => setStartedAt(event.target.value)} /></label>
    <div className="series-editor-grid"><label>Продолжительность, минут<input required min="1" step="1" type="number" inputMode="numeric" value={minutes} onChange={event => setMinutes(event.target.value)} /></label><label>{audio ? 'Прослушано, минут' : 'Прочитано страниц'}<input required min="0" max={maximum} step="1" type="number" inputMode="numeric" value={amount} onChange={event => setAmount(event.target.value)} /></label></div>
    {maximum != null && <p className="series-editor-hint">{session ? 'Максимум для этого сеанса' : 'Можно добавить'}: {maximum} {audio ? 'минут' : 'страниц'}.</p>}
    <label>Заметка<textarea rows={3} maxLength={5000} value={note} onChange={event => setNote(event.target.value)} /></label>
    <p className="series-editor-hint">После сохранения прогресс {audio ? 'прослушивания' : 'чтения'} изменится автоматически.</p>
  </SeriesFormDialog>
}
