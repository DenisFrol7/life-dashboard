import { useRef, useState, type FormEvent } from 'react'
import { createGameLibrary, createGamePlaythrough, deleteGameLibrary, deleteGamePlaythrough, putGameProfile, putXboxProgress, updateGameLibrary, updateGamePlaythrough, type GameLibrary, type GameLibraryInput, type GamePlaythrough, type Reference } from '../api/games'
import type { LibraryStatus } from '../api/movies'
import { getApiErrorMessage } from '../api/client'
import { useFormMutation } from '../hooks/useFormMutation'
import { SeriesFormDialog } from './SeriesFormDialog'

const statusLabels: Record<LibraryStatus, string> = { NOT_STARTED: 'Не начата', PLANNED: 'В планах', IN_PROGRESS: 'Играю', COMPLETED: 'Пройдена', PAUSED: 'На паузе', DROPPED: 'Брошена' }
const supportsXboxProgress = (entry: GameLibrary) => entry.platform.code.startsWith('XBOX_') || entry.platform.code === 'ORIGINAL_XBOX'
  || entry.platform.code === 'PC' && ['MICROSOFT_STORE', 'GAME_PASS'].includes(entry.source.code)

export function LibraryEntryModal({ contentId, gameTitle, entry, platforms, sources, onClose, onSaved }: {
  contentId: number; gameTitle: string; entry?: GameLibrary; platforms: Reference[]; sources: Reference[]
  onClose: (changedId?: number) => void; onSaved: (id: number) => void
}) {
  const [input, setInput] = useState<GameLibraryInput>(() => ({
    platformId: entry?.platform.id ?? platforms[0]?.id ?? 0,
    sourceId: entry?.source.id ?? sources.find(item => item.type !== 'SUBSCRIPTION')?.id ?? sources[0]?.id ?? 0,
    accessType: entry?.accessType ?? 'OWNED', edition: entry?.edition ?? null, acquiredAt: entry?.acquiredAt ?? null,
    note: entry?.note ?? null, legacyPlaytimeMinutes: entry?.legacyPlaytimeMinutes ?? 0,
    status: entry?.status ?? 'NOT_STARTED', startedAt: entry?.startedAt ?? null, completedAt: entry?.completedAt ?? null,
  }))
  const [hours, setHours] = useState(String(Math.floor(input.legacyPlaytimeMinutes / 60)))
  const [minutes, setMinutes] = useState(String(input.legacyPlaytimeMinutes % 60))
  const [error, setError] = useState<string | null>(null)
  const savedCopyRef = useRef<GameLibrary | null>(null)
  const mutations = useFormMutation()
  const { pending, saving, deleting } = mutations
  const compatibleSources = sources.filter(item => input.accessType === 'SUBSCRIPTION' ? item.type === 'SUBSCRIPTION' : item.type !== 'SUBSCRIPTION')
  const change = <K extends keyof GameLibraryInput>(key: K, value: GameLibraryInput[K]) => setInput(current => ({ ...current, [key]: value }))
  const close = () => { if (!pending) { mutations.dispose(); onClose(savedCopyRef.current?.id) } }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    setError(null)
    const wholeHours = Number(hours), remainingMinutes = Number(minutes)
    const legacyPlaytimeMinutes = wholeHours * 60 + remainingMinutes
    if (!hours.trim() || !minutes.trim() || !Number.isSafeInteger(wholeHours) || wholeHours < 0 || !Number.isSafeInteger(remainingMinutes) || remainingMinutes < 0 || remainingMinutes > 59 || !Number.isSafeInteger(legacyPlaytimeMinutes)) {
      setError('Укажите часы целым неотрицательным числом и минуты от 0 до 59.')
      return
    }
    if (!platforms.some(item => item.id === input.platformId) || !compatibleSources.some(item => item.id === input.sourceId)) {
      setError('Выберите платформу и подходящий источник игры.')
      return
    }
    const payload = { ...input, legacyPlaytimeMinutes }
    await mutations.run('save', async () => {
      const id = entry?.id ?? savedCopyRef.current?.id
      const saved = id != null ? await updateGameLibrary(id, payload) : await createGameLibrary(contentId, payload)
      savedCopyRef.current = saved
      await putGameProfile(contentId, { status: saved.status, rating: saved.rating, favorite: saved.favorite, startedAt: saved.startedAt, completedAt: saved.completedAt, personalNote: saved.personalNote })
      if (!entry && supportsXboxProgress(saved)) await putXboxProgress(saved.id, { totalAchievements: 0, unlockedAchievements: 0, totalGamerscore: 0, earnedGamerscore: 0 })
      return saved.id
    }, {
      onSuccess: onSaved,
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось сохранить запись библиотеки')),
    })
  }
  const remove = async () => {
    if (!entry || pending) return
    setError(null)
    await mutations.run('delete', async () => {
      if (!window.confirm(`Удалить запись «${entry.source.name} · ${entry.platform.name}»? Игровые сессии этой копии также будут удалены.`)) return false
      await deleteGameLibrary(entry.id)
      return true
    }, {
      onSuccess: removed => { if (removed) onSaved(entry.id) },
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось удалить запись библиотеки')),
    })
  }
  return <SeriesFormDialog title={entry ? 'Редактирование копии' : 'Добавить копию игры'} eyebrow="Моя библиотека" context={gameTitle} pending={pending} closeDisabled={pending}
    error={error} onClose={close} onSubmit={event => void submit(event)} actions={<>
      {entry && <button type="button" className="movie-dialog-delete" disabled={pending} onClick={() => void remove()}>{deleting ? 'Удаляем…' : 'Удалить копию'}</button>}
      <button type="button" className="secondary-button" disabled={pending} onClick={close}>Отмена</button><button type="submit" className="primary-button" disabled={pending}>{saving ? 'Сохраняем…' : 'Сохранить'}</button>
    </>}>
    <div className="series-editor-grid">
      <label>Платформа<select required value={input.platformId || ''} onChange={event => change('platformId', Number(event.target.value))}><option value="" disabled>Выберите платформу</option>{platforms.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Тип доступа<select value={input.accessType} onChange={event => {
        const accessType = event.target.value as GameLibraryInput['accessType']
        const source = sources.find(item => accessType === 'SUBSCRIPTION' ? item.type === 'SUBSCRIPTION' : item.type !== 'SUBSCRIPTION')
        setInput(current => ({ ...current, accessType, sourceId: source?.id ?? 0 }))
      }}><option value="OWNED">Куплена</option><option value="SUBSCRIPTION">Подписка</option></select></label>
      <label>Магазин или источник<select required value={input.sourceId || ''} onChange={event => change('sourceId', Number(event.target.value))}><option value="" disabled>Выберите источник</option>{compatibleSources.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label>Издание<input value={input.edition ?? ''} placeholder="Standard Edition" onChange={event => change('edition', event.target.value || null)} /></label>
      <label>Статус этой копии<select value={input.status} onChange={event => {
        const status = event.target.value as LibraryStatus
        setInput(current => ({ ...current, status, completedAt: status === 'COMPLETED' ? current.completedAt ?? new Date().toISOString() : null }))
      }}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Дата прохождения этой копии<input type="date" disabled={input.status !== 'COMPLETED'} value={input.completedAt?.slice(0, 10) ?? ''} onChange={event => change('completedAt', event.target.value ? new Date(`${event.target.value}T12:00:00`).toISOString() : null)} /></label>
    </div>
    <fieldset className="series-editor-section"><legend>Время до начала учёта</legend><div className="series-editor-grid">
      <label>Часы<input required min={0} step={1} type="number" inputMode="numeric" value={hours} onChange={event => setHours(event.target.value)} /></label>
      <label>Минуты<input required min={0} max={59} step={1} type="number" inputMode="numeric" value={minutes} onChange={event => setMinutes(event.target.value)} /></label>
    </div><p className="series-editor-hint">Время, сыгранное в этой копии до начала учёта в приложении.</p></fieldset>
  </SeriesFormDialog>
}

export function PlaythroughModal({ libraryId, gameTitle, copyLabel, playthrough, onClose, onSaved }: {
  libraryId: number; gameTitle: string; copyLabel: string; playthrough?: GamePlaythrough; onClose: () => void; onSaved: () => void
}) {
  const [initialCompletedAt] = useState(() => playthrough?.completedAt ?? new Date().toISOString())
  const [date, setDate] = useState(initialCompletedAt.slice(0, 10))
  const [note, setNote] = useState(playthrough?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const mutations = useFormMutation()
  const { pending, saving, deleting } = mutations
  const close = () => { if (!pending) { mutations.dispose(); onClose() } }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    setError(null)
    const value = new Date(`${date}T12:00:00`)
    if (!date || !Number.isFinite(value.getTime())) { setError('Укажите дату прохождения.'); return }
    const completedAt = date === initialCompletedAt.slice(0, 10) ? initialCompletedAt : value.toISOString()
    const input = { completedAt, note: note || null }
    await mutations.run('save', () => playthrough ? updateGamePlaythrough(playthrough.id, input) : createGamePlaythrough(libraryId, input), {
      onSuccess: onSaved,
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось сохранить прохождение')),
    })
  }
  const remove = async () => {
    if (!playthrough || pending) return
    setError(null)
    await mutations.run('delete', async () => {
      if (!window.confirm('Удалить эту запись из истории прохождений?')) return false
      await deleteGamePlaythrough(playthrough.id)
      return true
    }, {
      onSuccess: removed => { if (removed) onSaved() },
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось удалить прохождение')),
    })
  }
  return <SeriesFormDialog title={playthrough ? 'Изменить прохождение' : 'Добавить прохождение'} eyebrow="История игры" context={gameTitle} pending={pending} closeDisabled={pending}
    error={error} onClose={close} onSubmit={event => void submit(event)} actions={<>
      {playthrough && <button type="button" className="movie-dialog-delete" disabled={pending} onClick={() => void remove()}>{deleting ? 'Удаляем…' : 'Удалить прохождение'}</button>}
      <button type="button" className="secondary-button" disabled={pending} onClick={close}>Отмена</button><button type="submit" className="primary-button" disabled={pending}>{saving ? 'Сохраняем…' : 'Сохранить'}</button>
    </>}>
    <p className="series-editor-hint">{copyLabel}</p>
    <label>Дата прохождения<input required type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
    <label>Заметка<textarea maxLength={5000} rows={4} value={note} onChange={event => setNote(event.target.value)} /></label>
  </SeriesFormDialog>
}
