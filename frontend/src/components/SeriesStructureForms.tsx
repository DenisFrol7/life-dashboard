import { useRef, useState, type FormEvent } from 'react'
import { createEpisode, createEpisodes, createSeason, deleteEpisode, deleteSeason, updateEpisode, updateEpisodeWatch, updateSeason, watchEpisode, watchSeason, type Episode, type Season } from '../api/series'
import type { Watch } from '../api/movies'
import { useFormMutation } from '../hooks/useFormMutation'
import { SeriesFormDialog } from './SeriesFormDialog'

type Callbacks = { onClose: () => void; onSaved: () => void; returnFocusTo?: HTMLElement | null }
const optionalNumber = (value: string) => value ? Number(value) : null
const dateInstant = (value: string) => value ? new Date(`${value}T12:00:00`).toISOString() : null

function FormActions({ pending, saving, deleting, onClose, onDelete, deleteLabel = 'Удалить', saveLabel = 'Сохранить', savingLabel = 'Сохраняем…' }: { pending: boolean; saving: boolean; deleting?: boolean; onClose: () => void; onDelete?: () => void; deleteLabel?: string; saveLabel?: string; savingLabel?: string }) {
  return <>{onDelete && <button className="movie-dialog-delete" type="button" disabled={pending} onClick={onDelete}>{deleting ? 'Удаляем…' : deleteLabel}</button>}<button className="secondary-button" type="button" onClick={onClose}>Отмена</button><button className="primary-button" disabled={pending}>{saving ? savingLabel : saveLabel}</button></>
}

export function SeasonForm({ series, season, returnFocusTo, onClose, onSaved }: Callbacks & { series: { id: number; title: string }; season?: Season }) {
  const savedSeasonRef = useRef(season)
  const [number, setNumber] = useState(String(season?.seasonNumber ?? 1))
  const [title, setTitle] = useState(season?.title ?? '')
  const [year, setYear] = useState(season?.releaseYear?.toString() ?? '')
  const [episodeCount, setEpisodeCount] = useState('0')
  const [episodeMinutes, setEpisodeMinutes] = useState('')
  const [markWatched, setMarkWatched] = useState(false)
  const [watchedAt, setWatchedAt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const mutations = useFormMutation()
  const { saving, deleting, pending } = mutations
  const closeForm = () => { mutations.dispose(); onClose() }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    setError(null)
    await mutations.run('save', async () => {
      const input = { seasonNumber: Number(number), title: title || null, releaseYear: optionalNumber(year) }
      const bulkInput = { count: Number(episodeCount), durationMinutes: optionalNumber(episodeMinutes), markWatched, watchedAt: markWatched ? dateInstant(watchedAt) : null }
      if (savedSeasonRef.current) await updateSeason(savedSeasonRef.current.id, input)
      else savedSeasonRef.current = await createSeason(series.id, input)
      if (!season && bulkInput.count > 0) await createEpisodes(savedSeasonRef.current.id, bulkInput)
    }, {
      onSuccess: onSaved,
      onError: reason => setError(reason instanceof Error ? reason.message : 'Не удалось сохранить сезон'),
    })
  }
  const remove = async () => {
    if (!season || pending) return
    setError(null)
    await mutations.run('delete', async () => {
      if (!window.confirm(`Удалить сезон ${season.seasonNumber} вместе со всеми эпизодами и историей просмотров?`)) return false
      await deleteSeason(season.id)
      return true
    }, {
      onSuccess: deleted => { if (deleted) onSaved() },
      onError: reason => setError(reason instanceof Error ? reason.message : 'Не удалось удалить сезон'),
    })
  }
  return <SeriesFormDialog title={season ? 'Редактирование сезона' : 'Новый сезон'} eyebrow="Сезоны" context={series.title} returnFocusTo={returnFocusTo} pending={pending} error={error} onClose={closeForm} onSubmit={event => void submit(event)} actions={<FormActions pending={pending} saving={saving} deleting={deleting} onClose={closeForm} onDelete={season ? () => void remove() : undefined} deleteLabel="Удалить сезон" />}>
    <div className="series-editor-grid"><label>Номер<input required min="1" step="1" type="number" inputMode="numeric" value={number} onChange={event => setNumber(event.target.value)} /></label><label>Год<input min="1900" step="1" type="number" inputMode="numeric" value={year} onChange={event => setYear(event.target.value)} /></label></div>
    <label>Название<input maxLength={300} value={title} onChange={event => setTitle(event.target.value)} /></label>
    {!season && <fieldset className="series-editor-section"><legend>Автоматическое создание эпизодов</legend><div className="series-editor-grid"><label>Количество эпизодов<input min="0" max="1000" step="1" type="number" inputMode="numeric" value={episodeCount} onChange={event => setEpisodeCount(event.target.value)} /></label><label>Длительность каждого, мин<input min="1" step="1" type="number" inputMode="numeric" value={episodeMinutes} onChange={event => setEpisodeMinutes(event.target.value)} /></label></div>{Number(episodeCount) > 0 && <><label className="series-editor-checkbox"><input type="checkbox" checked={markWatched} onChange={event => setMarkWatched(event.target.checked)} />Отметить весь сезон просмотренным</label>{markWatched && <><label>Дата завершения просмотра сезона<input type="date" value={watchedAt} onChange={event => setWatchedAt(event.target.value)} /></label><p className="series-editor-hint">Необязательно. Если дата неизвестна, сезон не появится ложным событием в журнале.</p></>}</>}</fieldset>}
  </SeriesFormDialog>
}

export function EpisodeForm({ season, episode, returnFocusTo, onClose, onSaved }: Callbacks & { season: Season; episode?: Episode & { watches?: Watch[] } }) {
  const latestWatch = episode?.watches?.at(-1)
  const initialWatchDate = latestWatch?.watchedAt ? new Intl.DateTimeFormat('sv-SE').format(new Date(latestWatch.watchedAt)) : ''
  const savedEpisodeRef = useRef(episode)
  const [number, setNumber] = useState(String(episode?.episodeNumber ?? 1))
  const [title, setTitle] = useState(episode?.title ?? '')
  const [minutes, setMinutes] = useState(episode?.durationMinutes?.toString() ?? '')
  const [date, setDate] = useState(episode?.releaseDate ?? '')
  const [watchedAt, setWatchedAt] = useState(initialWatchDate)
  const [error, setError] = useState<string | null>(null)
  const mutations = useFormMutation()
  const { saving, deleting, pending } = mutations
  const closeForm = () => { mutations.dispose(); onClose() }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    setError(null)
    if (!title.trim()) { setError('Укажите название эпизода.'); return }
    await mutations.run('save', async () => {
      const input = { episodeNumber: Number(number), title, durationMinutes: optionalNumber(minutes), releaseDate: date || null }
      const instant = dateInstant(watchedAt)
      const saved = savedEpisodeRef.current ? await updateEpisode(savedEpisodeRef.current.id, input) : await createEpisode(season.id, input)
      savedEpisodeRef.current = saved
      if (instant) {
        if (latestWatch) { if (watchedAt !== initialWatchDate) await updateEpisodeWatch(latestWatch.id, instant) }
        else await watchEpisode(saved.id, instant)
      }
    }, {
      onSuccess: onSaved,
      onError: reason => setError(reason instanceof Error ? reason.message : 'Не удалось сохранить эпизод'),
    })
  }
  const remove = async () => {
    if (!episode || pending) return
    setError(null)
    await mutations.run('delete', async () => {
      if (!window.confirm(`Удалить эпизод «${episode.title}» вместе с историей просмотров?`)) return false
      await deleteEpisode(episode.id)
      return true
    }, {
      onSuccess: deleted => { if (deleted) onSaved() },
      onError: reason => setError(reason instanceof Error ? reason.message : 'Не удалось удалить эпизод'),
    })
  }
  return <SeriesFormDialog title={episode ? 'Редактирование эпизода' : 'Новый эпизод'} eyebrow={`Сезон ${season.seasonNumber}`} returnFocusTo={returnFocusTo} pending={pending} error={error} onClose={closeForm} onSubmit={event => void submit(event)} actions={<FormActions pending={pending} saving={saving} deleting={deleting} onClose={closeForm} onDelete={episode ? () => void remove() : undefined} deleteLabel="Удалить эпизод" />}>
    <label>Название<input required maxLength={300} value={title} onChange={event => setTitle(event.target.value)} /></label>
    <div className="series-editor-grid"><label>Номер<input required min="1" step="1" type="number" inputMode="numeric" value={number} onChange={event => setNumber(event.target.value)} /></label><label>Длительность, мин<input min="1" step="1" type="number" inputMode="numeric" value={minutes} onChange={event => setMinutes(event.target.value)} /></label><label>Дата выхода<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label><label>Дата просмотра<input type="date" value={watchedAt} onChange={event => setWatchedAt(event.target.value)} /></label></div>
    <p className="series-editor-hint">Указанная дата попадёт в историю и статистику именно этого дня. Пустое поле не добавляет просмотр и не удаляет существующий.</p>
  </SeriesFormDialog>
}

export function BulkEpisodeForm({ season, returnFocusTo, onClose, onSaved }: Callbacks & { season: Season }) {
  const [count, setCount] = useState('20')
  const [minutes, setMinutes] = useState('')
  const [markWatched, setMarkWatched] = useState(false)
  const [watchedAt, setWatchedAt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const mutations = useFormMutation()
  const { saving, pending } = mutations
  const closeForm = () => { mutations.dispose(); onClose() }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    setError(null)
    await mutations.run('save', () => createEpisodes(season.id, { count: Number(count), durationMinutes: optionalNumber(minutes), markWatched, watchedAt: markWatched ? dateInstant(watchedAt) : null }), {
      onSuccess: onSaved,
      onError: reason => setError(reason instanceof Error ? reason.message : 'Не удалось добавить эпизоды'),
    })
  }
  return <SeriesFormDialog title="Добавить несколько эпизодов" eyebrow={`Сезон ${season.seasonNumber}`} returnFocusTo={returnFocusTo} pending={pending} error={error} onClose={closeForm} onSubmit={event => void submit(event)} actions={<FormActions pending={pending} saving={saving} onClose={closeForm} saveLabel={`Добавить ${count || '0'} эпизодов`} savingLabel="Создаём…" />}>
    <div className="series-editor-grid"><label>Количество<input required min="1" max="1000" step="1" type="number" inputMode="numeric" value={count} onChange={event => setCount(event.target.value)} /></label><label>Длительность каждого, мин<input min="1" step="1" type="number" inputMode="numeric" value={minutes} onChange={event => setMinutes(event.target.value)} /></label></div>
    <p className="series-editor-hint">Будут созданы записи «Эпизод 1», «Эпизод 2» и далее. Настоящие названия можно добавить позже.</p>
    <label className="series-editor-checkbox"><input type="checkbox" checked={markWatched} onChange={event => setMarkWatched(event.target.checked)} />Отметить созданные эпизоды просмотренными</label>
    {markWatched && <><label>Дата завершения просмотра сезона<input type="date" value={watchedAt} onChange={event => setWatchedAt(event.target.value)} /></label><p className="series-editor-hint">Необязательно. В журнал добавляется одно событие только при указанной дате.</p></>}
  </SeriesFormDialog>
}

export function SeasonCompletionForm({ season, returnFocusTo, onClose, onSaved }: Callbacks & { season: Season }) {
  const [completedAt, setCompletedAt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const mutations = useFormMutation()
  const { saving, pending } = mutations
  const closeForm = () => { mutations.dispose(); onClose() }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    setError(null)
    await mutations.run('save', () => watchSeason(season.id, dateInstant(completedAt) ?? undefined), {
      onSuccess: onSaved,
      onError: reason => setError(reason instanceof Error ? reason.message : 'Не удалось отметить сезон'),
    })
  }
  return <SeriesFormDialog title="Отметить сезон просмотренным" eyebrow={`Сезон ${season.seasonNumber}`} returnFocusTo={returnFocusTo} pending={pending} error={error} onClose={closeForm} onSubmit={event => void submit(event)} actions={<FormActions pending={pending} saving={saving} onClose={closeForm} saveLabel="Отметить сезон" />}>
    <label>Дата завершения просмотра сезона<input type="date" value={completedAt} onChange={event => setCompletedAt(event.target.value)} /></label>
    <p className="series-editor-hint">Дата необязательна. Если оставить поле пустым, сезон будет учтён в прогрессе, но не появится в журнале активности.</p>
  </SeriesFormDialog>
}
