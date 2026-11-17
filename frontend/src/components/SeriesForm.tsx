import { useRef, useState, type FormEvent } from 'react'
import { createKinopoiskSeries, createSeries, deleteSeries, previewKinopoiskSeries, putSeriesLibrary, removeSeriesLibrary, searchKinopoiskSeries, updateSeries, type KinopoiskSeriesCandidate, type Series, type SeriesFormat, type SeriesInput, type SeriesLibraryEntry } from '../api/series'
import type { LibraryInput, LibraryStatus, ReleaseStatus } from '../api/movies'
import { getApiErrorMessage } from '../api/client'
import { saveLibraryForm } from '../pages/libraryForm'
import { useLatestRequest } from '../hooks/useLatestRequest'
import { useFormMutation } from '../hooks/useFormMutation'
import { useToast } from './ToastContext'
import { SeriesFormDialog } from './SeriesFormDialog'
import './SeriesForm.css'

const statusLabels: Record<LibraryStatus, string> = { NOT_STARTED: 'Не начато', PLANNED: 'В планах', IN_PROGRESS: 'Смотрю', COMPLETED: 'Просмотрено', PAUSED: 'На паузе', DROPPED: 'Брошено' }
const releaseLabels: Record<ReleaseStatus, string> = { ANNOUNCED: 'Анонсирован', ONGOING: 'Выходит', RELEASED: 'Вышел', ENDED: 'Завершён', CANCELLED: 'Отменён' }
const emptySeries: SeriesInput = { title: '', originalTitle: null, itemType: 'SERIES', format: 'LIVE_ACTION', releaseYear: null, description: null, coverUrl: null, durationMinutes: null, releaseStatus: 'ONGOING', genre: null, developer: null, releaseDate: null, xboxPlayAnywhere: false }
const emptyLibrary: LibraryInput = { status: 'PLANNED', rating: null, favorite: false, startedAt: null, completedAt: null, personalNote: null }
type Props = { series?: Series; library?: SeriesLibraryEntry; returnFocusTo?: HTMLElement | null; onClose: () => void; onSaved: () => void; onDeleted?: () => void }

export function SeriesForm({ series, library, returnFocusTo, onClose, onSaved, onDeleted }: Props) {
  const { showToast } = useToast()
  const savedSeriesRef = useRef(series)
  const [item, setItem] = useState<SeriesInput>(series ? { ...series } : emptySeries)
  const [entry, setEntry] = useState<LibraryInput>(library ? { status: library.status, rating: library.rating, favorite: library.favorite, startedAt: library.startedAt, completedAt: library.completedAt, personalNote: library.personalNote } : emptyLibrary)
  const [inLibrary, setInLibrary] = useState(Boolean(library) || !series)
  const [searchQuery, setSearchQuery] = useState('')
  const [candidates, setCandidates] = useState<KinopoiskSeriesCandidate[]>([])
  const [selectedFilmId, setSelectedFilmId] = useState<number | null>(null)
  const [catalogSummary, setCatalogSummary] = useState<{ seasons: number; episodes: number } | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mutations = useFormMutation()
  const { saving, deleting, pending } = mutations
  const catalogRequests = useLatestRequest()
  const created = !series && Boolean(savedSeriesRef.current)
  const cancelCatalog = () => { catalogRequests.invalidate(); setSearching(false); setCandidates([]) }
  const changeSearchQuery = (value: string) => { cancelCatalog(); setSearchQuery(value) }
  const closeForm = () => { mutations.dispose(); catalogRequests.dispose(); onClose() }
  const setItemValue = <K extends keyof SeriesInput>(key: K, value: SeriesInput[K]) => { cancelCatalog(); setItem(current => ({ ...current, [key]: value })) }
  const setEntryValue = <K extends keyof LibraryInput>(key: K, value: LibraryInput[K]) => setEntry(current => ({ ...current, [key]: value }))
  const searchCatalog = async () => {
    const value = searchQuery.trim()
    if (pending || created || value.length < 2) return
    await catalogRequests.run(() => searchKinopoiskSeries(value), {
      onStart: () => { setSearching(true); setError(null); setCandidates([]) },
      onSuccess: setCandidates,
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось выполнить поиск в Кинопоиске')),
      onFinish: () => setSearching(false),
    })
  }
  const selectCandidate = async (candidate: KinopoiskSeriesCandidate) => {
    if (pending || created || candidate.existingContentId) return
    await catalogRequests.run(() => previewKinopoiskSeries(candidate.filmId), {
      onStart: () => { setSearching(true); setError(null) },
      onSuccess: details => {
        setSelectedFilmId(details.filmId)
        setCatalogSummary({ seasons: details.seasonCount, episodes: details.episodeCount })
        setItem({ ...emptySeries, title: details.title, originalTitle: details.originalTitle, releaseYear: details.releaseYear, description: details.description, coverUrl: details.coverUrl, releaseStatus: details.releaseStatus, genre: details.genre })
        setCandidates([])
      },
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось загрузить данные сериала')),
      onFinish: () => setSearching(false),
    })
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending || searching) return
    setError(null)
    if (!item.title.trim()) { setError('Укажите название сериала.'); return }
    await mutations.run('save', () => saveLibraryForm({
      title: series?.title ?? item.title, inLibrary, wasInLibrary: Boolean(library),
      saveItem: async () => {
        const saved = savedSeriesRef.current ? await updateSeries(savedSeriesRef.current.id, item) : selectedFilmId ? await createKinopoiskSeries(selectedFilmId, item) : await createSeries(item)
        savedSeriesRef.current = saved
        return saved
      },
      putLibrary: id => putSeriesLibrary(id, entry), removeLibrary: removeSeriesLibrary,
    }), {
      onSuccess: saved => { if (saved) { showToast(series ? 'Сериал обновлён' : 'Сериал добавлен'); onSaved() } },
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось сохранить сериал')),
    })
  }
  const remove = async () => {
    if (!series || pending || searching) return
    setError(null)
    await mutations.run('delete', async () => {
      if (!window.confirm(`Удалить «${series.title}» вместе с сезонами и историей?`)) return false
      await deleteSeries(series.id)
      return true
    }, {
      onSuccess: deleted => { if (deleted) { showToast('Сериал удалён'); (onDeleted ?? onSaved)() } },
      onError: reason => setError(reason instanceof Error ? reason.message : 'Не удалось удалить сериал'),
    })
  }
  return <SeriesFormDialog title={series ? 'Редактирование сериала' : 'Новый сериал'} eyebrow="Сериалы" wide returnFocusTo={returnFocusTo} error={error} pending={pending} onClose={closeForm} onSubmit={event => void submit(event)} actions={<>
    {series && <button className="movie-dialog-delete" type="button" disabled={pending || searching} onClick={() => void remove()}>{deleting ? 'Удаляем…' : 'Удалить сериал'}</button>}
    <button className="secondary-button" type="button" onClick={closeForm}>Отмена</button><button className="primary-button" disabled={pending || searching}>{saving ? 'Сохраняем…' : 'Сохранить'}</button>
  </>}>
    {!series && <section className="series-form-search" aria-label="Поиск сериала в Кинопоиске"><div><label>Поиск в Кинопоиске<input value={searchQuery} disabled={created} onChange={event => changeSearchQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void searchCatalog() } }} placeholder="Введите название сериала" /></label><button className="secondary-button" type="button" disabled={pending || searching || created || searchQuery.trim().length < 2} onClick={() => void searchCatalog()}>{searching ? 'Ищем…' : 'Найти в Кинопоиске'}</button></div>
      {created ? <p role="status">Сериал уже создан. Повторное сохранение обновит его данные и библиотеку.</p> : selectedFilmId && <p role="status">Данные и структура загружены: {catalogSummary?.seasons ?? 0} сезонов, {catalogSummary?.episodes ?? 0} эпизодов. Проверьте поля и укажите личный статус.</p>}
      {candidates.length > 0 && <div className="series-form-results">{candidates.map(candidate => <button type="button" key={candidate.filmId} disabled={pending || searching || created || Boolean(candidate.existingContentId)} onClick={() => void selectCandidate(candidate)}><span aria-hidden="true">▤</span><span><strong>{candidate.nameRu || candidate.nameOriginal || `Сериал ${candidate.filmId}`}</strong><small>{candidate.nameOriginal && candidate.nameOriginal !== candidate.nameRu ? `${candidate.nameOriginal} · ` : ''}{candidate.year ?? 'Год неизвестен'}{candidate.existingContentId ? ' · Уже в каталоге' : ''}</small></span></button>)}</div>}
    </section>}
    <label>Название<input required maxLength={300} value={item.title} onChange={event => setItemValue('title', event.target.value)} /></label>
    <label>Оригинальное название<input maxLength={300} value={item.originalTitle ?? ''} onChange={event => setItemValue('originalTitle', event.target.value || null)} /></label>
    <div className="series-editor-grid"><label>Формат<select value={item.format} onChange={event => setItemValue('format', event.target.value as SeriesFormat)}><option value="LIVE_ACTION">Сериал</option><option value="ANIMATION">Мультсериал</option></select></label><label>Статус выпуска<select value={item.releaseStatus} onChange={event => setItemValue('releaseStatus', event.target.value as ReleaseStatus)}>{Object.entries(releaseLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Год<input min="1900" step="1" type="number" inputMode="numeric" value={item.releaseYear ?? ''} onChange={event => setItemValue('releaseYear', event.target.value ? Number(event.target.value) : null)} /></label><label>Жанр<input maxLength={100} value={item.genre ?? ''} onChange={event => setItemValue('genre', event.target.value || null)} /></label></div>
    <label>URL обложки<input type="url" value={item.coverUrl ?? ''} onChange={event => setItemValue('coverUrl', event.target.value || null)} /></label>
    <label>Описание<textarea rows={4} value={item.description ?? ''} onChange={event => setItemValue('description', event.target.value || null)} /></label>
    <fieldset className="series-editor-section"><legend>Моя библиотека</legend><label className="series-editor-checkbox"><input type="checkbox" checked={inLibrary} onChange={event => setInLibrary(event.target.checked)} />Добавить в библиотеку</label>{inLibrary && <><div className="series-editor-grid"><label>Статус<select value={entry.status} onChange={event => setEntryValue('status', event.target.value as LibraryStatus)}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Оценка<select value={entry.rating ?? ''} onChange={event => setEntryValue('rating', event.target.value ? Number(event.target.value) : null)}><option value="">Без оценки</option>{Array.from({ length: 10 }, (_, index) => index + 1).map(value => <option key={value}>{value}</option>)}</select></label></div><label className="series-editor-checkbox"><input type="checkbox" checked={entry.favorite} onChange={event => setEntryValue('favorite', event.target.checked)} />В избранном</label><label>Заметка<textarea rows={3} value={entry.personalNote ?? ''} onChange={event => setEntryValue('personalNote', event.target.value || null)} /></label></>}</fieldset>
  </SeriesFormDialog>
}
