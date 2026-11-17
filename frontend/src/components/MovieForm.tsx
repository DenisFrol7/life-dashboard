import { useRef, useState, type FormEvent } from 'react'
import { createKinopoiskMovie, createMovie, deleteMovie, previewKinopoiskMovie, putInLibrary, removeFromLibrary, searchKinopoiskMovies, updateMovie, type ContentFormat, type KinopoiskMovieCandidate, type LibraryEntry, type LibraryInput, type LibraryStatus, type Movie, type MovieInput } from '../api/movies'
import { useToast } from './ToastContext'
import { useLatestRequest } from '../hooks/useLatestRequest'
import { useFormMutation } from '../hooks/useFormMutation'
import { saveLibraryForm } from '../pages/libraryForm'
import { MovieDialog } from './MovieDialog'
import './MovieForm.css'

const statusLabels: Record<LibraryStatus, string> = { NOT_STARTED: 'Не начато', PLANNED: 'В планах', IN_PROGRESS: 'Смотрю', COMPLETED: 'Просмотрено', PAUSED: 'На паузе', DROPPED: 'Брошено' }
const movieStatuses: LibraryStatus[] = ['PLANNED', 'COMPLETED']
const emptyMovie: MovieInput = { title: '', originalTitle: null, itemType: 'MOVIE', format: 'LIVE_ACTION', releaseYear: null, description: null, coverUrl: null, durationMinutes: null, releaseStatus: 'RELEASED', genre: null, developer: null, releaseDate: null, xboxPlayAnywhere: false }
const emptyLibrary: LibraryInput = { status: 'PLANNED', rating: null, favorite: false, startedAt: null, completedAt: null, personalNote: null }

export function MovieForm({ movie, library, existingMovieIds = [], returnFocusTo = null, onClose, onSaved, onDeleted }: { movie?: Movie; library?: LibraryEntry; existingMovieIds?: number[]; returnFocusTo?: HTMLElement | null; onClose: () => void; onSaved: () => void; onDeleted?: () => void }) {
  const { showToast } = useToast()
  const savedMovieRef = useRef(movie)
  const [film, setFilm] = useState<MovieInput>(movie ? { ...movie } : emptyMovie)
  const [entry, setEntry] = useState<LibraryInput>(library ? { status: library.status === 'COMPLETED' ? 'COMPLETED' : 'PLANNED', rating: library.rating, favorite: library.favorite, startedAt: library.startedAt, completedAt: library.completedAt, personalNote: library.personalNote } : emptyLibrary)
  const [inLibrary, setInLibrary] = useState(Boolean(library) || !movie)
  const mutations = useFormMutation()
  const { saving, deleting, pending } = mutations
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [candidates, setCandidates] = useState<KinopoiskMovieCandidate[]>([])
  const [selectedFilmId, setSelectedFilmId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const catalogRequests = useLatestRequest()
  const cancelCatalog = () => { catalogRequests.invalidate(); setSearching(false); setCandidates([]) }
  const changeSearchQuery = (value: string) => { cancelCatalog(); setSearchQuery(value) }
  const closeForm = () => { mutations.dispose(); catalogRequests.dispose(); onClose() }
  const setFilmValue = <K extends keyof MovieInput>(key: K, value: MovieInput[K]) => { cancelCatalog(); setFilm((current) => ({ ...current, [key]: value })) }
  const setEntryValue = <K extends keyof LibraryInput>(key: K, value: LibraryInput[K]) => setEntry((current) => ({ ...current, [key]: value }))
  const searchCatalog = async () => {
    const value = searchQuery.trim()
    if (pending || value.length < 2) return
    await catalogRequests.run(() => searchKinopoiskMovies(value), {
      onStart: () => { setSearching(true); setError(null); setCandidates([]) },
      onSuccess: setCandidates,
      onError: (reason) => setError(reason instanceof Error ? reason.message : 'Не удалось выполнить поиск в Кинопоиске'),
      onFinish: () => setSearching(false),
    })
  }
  const selectCandidate = async (candidate: KinopoiskMovieCandidate) => {
    if (pending || candidate.existingContentId) return
    await catalogRequests.run(() => previewKinopoiskMovie(candidate.filmId), {
      onStart: () => { setSearching(true); setError(null) },
      onSuccess: (details) => {
        setSelectedFilmId(details.filmId)
        setFilm({ title: details.title, originalTitle: details.originalTitle, itemType: 'MOVIE', format: details.format, releaseYear: details.releaseYear, description: details.description, coverUrl: details.coverUrl, durationMinutes: details.durationMinutes, releaseStatus: details.releaseStatus, genre: details.genre, developer: null, releaseDate: null, xboxPlayAnywhere: false })
        setCandidates([])
      },
      onError: (reason) => setError(reason instanceof Error ? reason.message : 'Не удалось загрузить данные фильма'),
      onFinish: () => setSearching(false),
    })
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (pending || searching) return
    setError(null)
    if (!film.title.trim()) { setError('Укажите название фильма.'); return }
    await mutations.run('save', () => saveLibraryForm({
      title: movie?.title ?? film.title, inLibrary, wasInLibrary: Boolean(library),
      saveItem: async () => {
        const saved = savedMovieRef.current ? await updateMovie(savedMovieRef.current.id, film) : selectedFilmId ? await createKinopoiskMovie(selectedFilmId, film) : await createMovie(film)
        savedMovieRef.current = saved
        return saved
      },
      putLibrary: (id) => putInLibrary(id, entry), removeLibrary: removeFromLibrary,
    }), {
      onSuccess: (saved) => {
        if (!saved) return
        showToast(movie || existingMovieIds.includes(saved.id) ? 'Данные фильма обновлены' : 'Фильм добавлен'); onSaved()
      },
      onError: (reason) => setError(reason instanceof Error ? reason.message : 'Не удалось сохранить фильм'),
    })
  }
  const removeCatalog = async () => {
    if (!movie || pending || searching) return
    setError(null)
    await mutations.run('delete', async () => {
      if (!window.confirm(`Удалить «${movie.title}» из общего каталога вместе со всей историей?`)) return false
      await deleteMovie(movie.id)
      return true
    }, {
      onSuccess: (deleted) => { if (deleted) { showToast('Фильм удалён'); (onDeleted ?? onSaved)() } },
      onError: (reason) => setError(reason instanceof Error ? reason.message : 'Не удалось удалить фильм'),
    })
  }
  return <MovieDialog title={movie ? 'Редактирование' : 'Новый фильм'} eyebrow="Фильмы" wide returnFocusTo={returnFocusTo} onClose={closeForm} onSubmit={event => void submit(event)} actions={<>
    {movie && <button className="movie-dialog-delete" type="button" disabled={pending || searching} onClick={() => void removeCatalog()}>{deleting ? 'Удаляем…' : 'Удалить из каталога'}</button>}
    <button className="secondary-button" type="button" onClick={closeForm}>Отмена</button><button className="primary-button" disabled={pending || searching}>{saving ? 'Сохраняем…' : 'Сохранить'}</button>
  </>}>
    {error && <div className="form-error" role="alert">{error}</div>}
    {!movie && <section className="movie-form-search" aria-label="Поиск фильма в Кинопоиске"><div><label>Поиск в Кинопоиске<input value={searchQuery} disabled={pending} onChange={event => changeSearchQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void searchCatalog() } }} placeholder="Введите название фильма" /></label><button className="secondary-button" type="button" disabled={pending || searching || searchQuery.trim().length < 2} onClick={() => void searchCatalog()}>{searching ? 'Ищем…' : 'Найти в Кинопоиске'}</button></div>
      {selectedFilmId && <p role="status">Данные фильма загружены. Проверьте их и укажите личный статус и оценку.</p>}
      {candidates.length > 0 && <div className="movie-form-results">{candidates.map(candidate => <button type="button" key={candidate.filmId} disabled={pending || searching || Boolean(candidate.existingContentId)} onClick={() => void selectCandidate(candidate)}>{candidate.posterUrlPreview ? <img src={candidate.posterUrlPreview} alt="" /> : <span className="movie-form-candidate-cover" aria-hidden="true">🎬</span>}<span><strong>{candidate.nameRu || candidate.nameOriginal || `Фильм ${candidate.filmId}`}</strong><small>{candidate.nameOriginal && candidate.nameOriginal !== candidate.nameRu ? `${candidate.nameOriginal} · ` : ''}{candidate.year ?? 'Год неизвестен'}{candidate.existingContentId ? ' · Уже в каталоге' : ''}</small></span></button>)}</div>}
    </section>}
    <label>Название<input required maxLength={300} value={film.title} onChange={event => setFilmValue('title', event.target.value)} /></label>
    <label>Оригинальное название<input maxLength={300} value={film.originalTitle ?? ''} onChange={event => setFilmValue('originalTitle', event.target.value || null)} /></label>
    <div className="movie-form-grid"><label>Формат<select value={film.format} onChange={event => setFilmValue('format', event.target.value as ContentFormat)}><option value="LIVE_ACTION">Фильм</option><option value="ANIMATION">Мультфильм</option></select></label><label>Год<input min="1888" step="1" type="number" inputMode="numeric" value={film.releaseYear ?? ''} onChange={event => setFilmValue('releaseYear', event.target.value ? Number(event.target.value) : null)} /></label><label>Длительность, мин<input min="1" step="1" type="number" inputMode="numeric" value={film.durationMinutes ?? ''} onChange={event => setFilmValue('durationMinutes', event.target.value ? Number(event.target.value) : null)} /></label><label>Жанр<input maxLength={100} value={film.genre ?? ''} onChange={event => setFilmValue('genre', event.target.value || null)} /></label></div>
    <label>URL обложки<input type="url" value={film.coverUrl ?? ''} onChange={event => setFilmValue('coverUrl', event.target.value || null)} /></label>
    <label>Описание<textarea rows={4} value={film.description ?? ''} onChange={event => setFilmValue('description', event.target.value || null)} /></label>
    <fieldset className="movie-form-library"><legend>Моя библиотека</legend><label className="movie-form-checkbox"><input type="checkbox" checked={inLibrary} onChange={event => setInLibrary(event.target.checked)} />Добавить в библиотеку</label>{inLibrary && <><div className="movie-form-grid"><label>Статус<select value={entry.status} onChange={event => setEntryValue('status', event.target.value as LibraryStatus)}>{movieStatuses.map(value => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label><label>Оценка<select value={entry.rating ?? ''} onChange={event => setEntryValue('rating', event.target.value ? Number(event.target.value) : null)}><option value="">Без оценки</option>{Array.from({ length: 10 }, (_, index) => index + 1).map(value => <option key={value}>{value}</option>)}</select></label></div><label className="movie-form-checkbox"><input type="checkbox" checked={entry.favorite} onChange={event => setEntryValue('favorite', event.target.checked)} />В избранном</label><label>Личная заметка<textarea rows={3} value={entry.personalNote ?? ''} onChange={event => setEntryValue('personalNote', event.target.value || null)} /></label></>}</fieldset>
  </MovieDialog>
}
