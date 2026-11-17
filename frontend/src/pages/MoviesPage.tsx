import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ChevronDown, Download, Film, Heart, Plus, Search } from 'lucide-react'
import { createKinopoiskMovie, createMovie, deleteMovie, enrichKinopoiskMovies, getMovieCatalogPage, importKinopoiskRatings, previewKinopoiskMovie, previewKinopoiskRatings, putInLibrary, removeFromLibrary, searchKinopoiskMovies, updateMovie, type ContentFormat, type KinopoiskMovieCandidate, type KinopoiskMovieEnrichmentResult, type KinopoiskRatingsImportResult, type KinopoiskRatingsPreview, type LibraryEntry, type LibraryInput, type LibraryStatus, type Movie, type MovieCatalogStatistics, type MovieInput } from '../api/movies'
import { ErrorState, LoadingState } from '../components/AsyncState'
import { useToast } from '../components/ToastContext'
import { saveLibraryForm } from './libraryForm'
import { useLatestRequest } from '../hooks/useLatestRequest'
import { useFormMutation } from '../hooks/useFormMutation'
import './MoviesPage.css'

const statusLabels: Record<LibraryStatus, string> = { NOT_STARTED: 'Не начато', PLANNED: 'В планах', IN_PROGRESS: 'Смотрю', COMPLETED: 'Просмотрено', PAUSED: 'На паузе', DROPPED: 'Брошено' }
const movieStatuses: LibraryStatus[] = ['PLANNED', 'COMPLETED']
const emptyMovie: MovieInput = { title: '', originalTitle: null, itemType: 'MOVIE', format: 'LIVE_ACTION', releaseYear: null, description: null, coverUrl: null, durationMinutes: null, releaseStatus: 'RELEASED', genre: null, developer: null, releaseDate: null, xboxPlayAnywhere: false }
const emptyLibrary: LibraryInput = { status: 'PLANNED', rating: null, favorite: false, startedAt: null, completedAt: null, personalNote: null }
const formatDuration = (minutes: number | null) => minutes == null ? null : `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`

export function MoviesPage() {
  const requests = useLatestRequest()
  const [movies, setMovies] = useState<Movie[]>([])
  const [library, setLibrary] = useState<Record<number, LibraryEntry>>({})
  const [statistics, setStatistics] = useState<MovieCatalogStatistics>({ totalMovies: 0, inLibrary: 0, completed: 0, planned: 0, liveAction: 0, animation: 0 })
  const [page, setPage] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [editing, setEditing] = useState<Movie | 'new' | null>(null)
  const [importing, setImporting] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<LibraryStatus | ''>('')
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [moreError, setMoreError] = useState<string | null>(null)
  const [statisticsExpanded, setStatisticsExpanded] = useState(false)
  const appendLockRef = useRef(false)

  const load = useCallback(async (nextPage = 0, append = false) => {
    if (append && appendLockRef.current) return
    appendLockRef.current = append
    await requests.run(() => getMovieCatalogPage(nextPage, 50, query, status), {
      onStart: () => {
        if (append) setLoadingMore(true)
        else setLoading(true)
        setError(null)
        setMoreError(null)
      },
      onSuccess: catalog => {
        const loaded: Movie[] = catalog.items.map(item => ({ ...item, itemType: 'MOVIE', xboxPlayAnywhere: false }))
        setMovies(current => append ? [...new Map([...current, ...loaded].map(movie => [movie.id, movie])).values()] : loaded)
        setLibrary(current => ({ ...(append ? current : {}), ...Object.fromEntries(catalog.items.filter(item => item.libraryId != null && item.userStatus).map(item => [item.id, {
          id: item.libraryId!, content: { ...item, itemType: 'MOVIE', xboxPlayAnywhere: false }, status: item.userStatus!, rating: item.rating,
          favorite: item.favorite, startedAt: item.startedAt, completedAt: item.completedAt, personalNote: item.personalNote,
        }] as const)) }))
        setStatistics(catalog.statistics)
        setTotalItems(catalog.totalItems)
        setPage(catalog.page)
        setHasMore(catalog.hasMore)
        setInitialized(true)
      },
      onError: reason => {
        const message = reason instanceof Error ? reason.message : 'Не удалось загрузить фильмы'
        if (append) setMoreError(message)
        else setError(message)
      },
      onFinish: () => { appendLockRef.current = false; setLoading(false); setLoadingMore(false) },
    })
  }, [query, status, requests])
  useEffect(() => {
    setLoading(true)
    setLoadingMore(false)
    appendLockRef.current = false
    const timeout = window.setTimeout(() => { void load() }, 250)
    return () => { window.clearTimeout(timeout); requests.invalidate() }
  }, [load, requests])
  const changeFilters = (nextQuery: string, nextStatus: LibraryStatus | '') => {
    if (nextQuery === query && nextStatus === status) return
    requests.invalidate()
    appendLockRef.current = false
    setLoading(true)
    setLoadingMore(false)
    setError(null)
    setMoreError(null)
    setQuery(nextQuery)
    setStatus(nextStatus)
  }
  const filtered = Boolean(query.trim() || status)

  return <div className="movie-catalog-page">
    <section className="movies-catalog-toolbar" aria-label="Управление каталогом фильмов">
      <div className="movies-catalog-status-tabs" role="group" aria-label="Статус фильмов">{([['', 'Все'], ['PLANNED', 'В планах'], ['COMPLETED', 'Просмотрено']] as const).map(([value, label]) => <button type="button" key={value || 'all'} aria-pressed={status === value} onClick={() => changeFilters(query, value)}>{label}</button>)}</div>
      <div className="movies-catalog-search"><Search aria-hidden="true" /><input type="search" aria-label="Найти фильм" value={query} onChange={event => changeFilters(event.target.value, status)} placeholder="Найти фильм" /></div>
      <div className="movies-catalog-actions"><button type="button" className="secondary-button icon-button" onClick={() => setImporting(true)}><Download aria-hidden="true" />Импорт оценок</button><button type="button" className="primary-button icon-button" onClick={() => setEditing('new')}><Plus aria-hidden="true" />Добавить фильм</button></div>
    </section>
    <section className="movies-catalog-layout">
      <div className="movies-catalog-main">
        <div className="movies-catalog-heading"><h2>Каталог</h2><output aria-live="polite" aria-atomic="true">{loading ? 'Загружаем фильмы…' : error ? 'Фильмы не загружены' : `Показано: ${movies.length} из ${totalItems}`}</output></div>
        {loading ? <LoadingState message="Загружаем фильмы…" /> : error ? <ErrorState title="Не удалось загрузить фильмы" message={error} onRetry={() => void load()} /> : movies.length === 0 ? <div className="movies-catalog-empty"><Film aria-hidden="true" /><h2>{filtered ? 'Фильмов не найдено' : 'Каталог пока пуст'}</h2><p>{filtered ? 'Попробуйте изменить поиск или статус.' : 'Добавьте первый фильм или импортируйте оценки.'}</p>{filtered && <button type="button" className="secondary-button" onClick={() => changeFilters('', '')}>Сбросить фильтры</button>}</div> : <>
          <section className="movies-catalog-grid" aria-label="Фильмы">{movies.map(movie => {
            const entry = library[movie.id]
            return <article className="movies-catalog-card" key={movie.id}>
              <Link className="movies-catalog-cover" to={`/movies/${movie.id}`} aria-label={`Открыть фильм: ${movie.title}`}>
                <span className="movies-catalog-cover-letter" aria-hidden="true">{movie.title.slice(0, 1)}</span>
                {movie.coverUrl && <img key={movie.coverUrl} src={movie.coverUrl} loading="lazy" decoding="async" alt="" onError={event => { event.currentTarget.hidden = true }} />}
                {entry?.favorite && <span className="movies-catalog-favorite" role="img" aria-label="В избранном"><Heart aria-hidden="true" /></span>}
              </Link>
              <div className="movies-catalog-copy">
                <h3><Link to={`/movies/${movie.id}`}>{movie.title}</Link></h3>
                {movie.originalTitle && <p className="movies-catalog-original">{movie.originalTitle}</p>}
                <div className="movies-catalog-meta"><span>{movie.releaseYear ?? 'Год неизвестен'}</span>{movie.durationMinutes != null && <span>{formatDuration(movie.durationMinutes)}</span>}</div>
                {movie.genre && <p className="movies-catalog-genre">{movie.genre}</p>}
                <span className="movies-catalog-format">{movie.format === 'ANIMATION' ? 'Мультфильм' : 'Фильм'}</span>
              </div>
              <div className="movies-catalog-personal">
                <span className={`movies-catalog-status ${entry?.status.toLowerCase() ?? 'not_started'}`}>{entry ? statusLabels[entry.status] : 'Не в библиотеке'}</span>
                {entry ? <strong className="movies-catalog-rating" data-rated={entry.rating != null} aria-label={entry.rating != null ? `Моя оценка: ${entry.rating} из 10` : 'Без оценки'}>{entry.rating != null ? `${entry.rating}/10` : 'Без оценки'}</strong> : <button type="button" className="movies-catalog-add-library" aria-label={`Добавить в библиотеку: ${movie.title}`} onClick={() => setEditing(movie)}><Plus aria-hidden="true" />В библиотеку</button>}
              </div>
            </article>
          })}</section>
          {moreError && <div className="notice error movies-catalog-more-error" role="alert"><strong>Не удалось загрузить следующую страницу</strong><span>{moreError}</span></div>}
          {hasMore && <button type="button" className="secondary-button movies-catalog-load-more" disabled={loadingMore} onClick={() => void load(page + 1, true)}>{loadingMore ? 'Загружаем…' : moreError ? 'Повторить загрузку' : 'Показать ещё 50'}</button>}
          {loadingMore && <p className="movies-catalog-loading-more" role="status">Загружаем следующую страницу…</p>}
        </>}
      </div>
      <aside className="movies-catalog-statistics" aria-label="Общая статистика фильмов">
        <p className="eyebrow">Весь каталог</p><h2>Фильмы <span>{initialized ? statistics.totalMovies : '—'}</span></h2>
        <button type="button" className="movies-catalog-statistics-toggle" aria-expanded={statisticsExpanded} aria-controls="movies-catalog-statistics-details" onClick={() => setStatisticsExpanded(expanded => !expanded)}>Общая статистика<ChevronDown aria-hidden="true" /></button>
        <dl id="movies-catalog-statistics-details" data-expanded={statisticsExpanded}>{([['Количество фильмов', statistics.totalMovies], ['В библиотеке', statistics.inLibrary], ['Просмотрено', statistics.completed], ['В планах', statistics.planned], ['Фильмы', statistics.liveAction], ['Мультфильмы', statistics.animation]] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{initialized ? value : '—'}</dd></div>)}</dl>
      </aside>
    </section>
    {editing && <MovieForm movie={editing === 'new' ? undefined : editing} library={editing === 'new' ? undefined : library[editing.id]} existingMovieIds={movies.map((item) => item.id)} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load() }} />}
    {importing && <KinopoiskRatingsDialog onClose={() => setImporting(false)} onImported={() => { setImporting(false); void load() }} />}
  </div>
}

function KinopoiskRatingsDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [profileId, setProfileId] = useState('')
  const [preview, setPreview] = useState<KinopoiskRatingsPreview | null>(null)
  const [result, setResult] = useState<KinopoiskRatingsImportResult | null>(null)
  const [enrichment, setEnrichment] = useState<KinopoiskMovieEnrichmentResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const load = async () => { if (!profileId.trim()) return; setLoading(true); setError(null); try { setPreview(await previewKinopoiskRatings(profileId.trim())) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось загрузить оценки Кинопоиска') } finally { setLoading(false) } }
  const confirm = async () => { if (!preview || !window.confirm(`Добавить ${preview.newCount} новых фильмов и обновить ${preview.existingCount} существующих?`)) return; setLoading(true); setError(null); try { setResult(await importKinopoiskRatings(preview.profileId)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось импортировать фильмы') } finally { setLoading(false) } }
  const enrich = async () => { setLoading(true); setError(null); try { setEnrichment(await enrichKinopoiskMovies(350)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось загрузить подробные данные фильмов') } finally { setLoading(false) } }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !loading) onClose() }}>
    <div className="habit-form kinopoisk-ratings-dialog">
      <div className="form-heading"><div><p className="eyebrow">Кинопоиск</p><h2>Импорт оценок</h2></div><button type="button" onClick={onClose}>×</button></div>
      {error && <div className="form-error">{error}</div>}
      {enrichment && <div className="notice success"><strong>Подробные данные обновлены</strong><span>Обновлено: {enrichment.updated}. Осталось: {enrichment.remaining}.{enrichment.quotaExhausted ? ' Достигнут лимит запросов Кинопоиска. Продолжите позже.' : ''}</span></div>}
      {result ? <div className="notice success"><strong>Импорт завершён</strong><span>Добавлено: {result.created}. Обновлено: {result.updated}. Пропущено: {result.skipped}.</span></div> : <>
        <div className="kinopoisk-profile-input"><label>ID профиля<input value={profileId} placeholder="Например, 1234567" onChange={(event) => setProfileId(event.target.value)} disabled={loading} /></label><button className="primary-button" type="button" disabled={loading || !profileId.trim()} onClick={() => void load()}>{loading && !preview ? 'Загружаем страницы…' : 'Загрузить оценки'}</button></div>
        {loading && <p className="form-hint">Операция может занять несколько минут. Не закрывайте окно.</p>}
        {preview && <><div className="myshows-preview-summary kinopoisk-summary"><div><span>Всего оценок</span><strong>{preview.totalRatings}</strong></div><div><span>Фильмы</span><strong>{preview.movieCount}</strong></div><div><span>Уже в каталоге</span><strong>{preview.existingCount}</strong></div><div><span>Новые</span><strong>{preview.newCount}</strong></div></div><p className="form-hint">Сериалов исключено: {preview.seriesCount}. Дата просмотра недоступна и не будет добавлена в статистику дня.</p><div className="kinopoisk-ratings-list">{preview.movies.map((item) => <article key={item.filmId} className={item.existingContentId ? 'existing' : ''}>{item.posterUrlPreview ? <img src={item.posterUrlPreview} alt="" /> : <span>🎬</span>}<div><strong>{item.title}</strong><small>{item.originalTitle && item.originalTitle !== item.title ? `${item.originalTitle} · ` : ''}{item.year ?? 'Год неизвестен'}{item.genre ? ` · ${item.genre}` : ''}</small></div><b>{item.userRating ? `${item.userRating}/10` : 'Без оценки'}</b><em>{item.existingContentId ? 'Обновить' : 'Добавить'}</em></article>)}</div></>}
      </>}
      <div className="form-buttons"><button className="secondary-button" type="button" disabled={loading} onClick={result ? onImported : onClose}>{result ? 'Готово' : 'Закрыть'}</button>{!preview && !result && <button className="primary-button" type="button" disabled={loading} onClick={() => void enrich()}>{loading ? 'Обновляем…' : 'Загрузить подробные данные'}</button>}{preview && !result && <button className="primary-button" type="button" disabled={loading} onClick={() => void confirm()}>{loading ? 'Импортируем…' : `Импортировать ${preview.movieCount} фильмов`}</button>}</div>
    </div>
  </div>
}

export function MovieForm({ movie, library, existingMovieIds = [], onClose, onSaved, onDeleted }: { movie?: Movie; library?: LibraryEntry; existingMovieIds?: number[]; onClose: () => void; onSaved: () => void; onDeleted?: () => void }) {
  const { showToast } = useToast()
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
    if (value.length < 2) return
    await catalogRequests.run(() => searchKinopoiskMovies(value), {
      onStart: () => { setSearching(true); setError(null); setCandidates([]) },
      onSuccess: setCandidates,
      onError: (reason) => setError(reason instanceof Error ? reason.message : 'Не удалось выполнить поиск в Кинопоиске'),
      onFinish: () => setSearching(false),
    })
  }
  const selectCandidate = async (candidate: KinopoiskMovieCandidate) => {
    if (candidate.existingContentId) return
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
    await mutations.run('save', () => saveLibraryForm({
      title: movie?.title ?? film.title, inLibrary, wasInLibrary: Boolean(library),
      saveItem: () => movie ? updateMovie(movie.id, film) : selectedFilmId ? createKinopoiskMovie(selectedFilmId, film) : createMovie(film),
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
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}><form className="habit-form movie-form" onSubmit={(event) => void submit(event)}><div className="form-heading"><div><p className="eyebrow">Фильмы</p><h2>{movie ? 'Редактирование' : 'Новый фильм'}</h2></div><button type="button" onClick={closeForm}>×</button></div>{error && <div className="form-error">{error}</div>}{!movie && <section className="kinopoisk-movie-search"><div><input value={searchQuery} onChange={(event) => changeSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void searchCatalog() } }} placeholder="Введите название фильма" /><button className="secondary-button" type="button" disabled={searching || searchQuery.trim().length < 2} onClick={() => void searchCatalog()}>{searching ? 'Ищем…' : 'Найти в Кинопоиске'}</button></div>{selectedFilmId && <p>Данные фильма загружены. Проверьте их и укажите личный статус и оценку.</p>}{candidates.length > 0 && <div className="kinopoisk-movie-results">{candidates.map((candidate) => <button type="button" key={candidate.filmId} disabled={Boolean(candidate.existingContentId)} onClick={() => void selectCandidate(candidate)}>{candidate.posterUrlPreview ? <img src={candidate.posterUrlPreview} alt="" /> : <span>🎬</span>}<span><strong>{candidate.nameRu || candidate.nameOriginal || `Фильм ${candidate.filmId}`}</strong><small>{candidate.nameOriginal && candidate.nameOriginal !== candidate.nameRu ? `${candidate.nameOriginal} · ` : ''}{candidate.year ?? 'Год неизвестен'}{candidate.existingContentId ? ' · Уже в каталоге' : ''}</small></span></button>)}</div>}</section>}<label>Название<input required maxLength={300} value={film.title} onChange={(event) => setFilmValue('title', event.target.value)} /></label><label>Оригинальное название<input maxLength={300} value={film.originalTitle ?? ''} onChange={(event) => setFilmValue('originalTitle', event.target.value || null)} /></label><div className="movie-details-grid"><label>Формат<select value={film.format} onChange={(event) => setFilmValue('format', event.target.value as ContentFormat)}><option value="LIVE_ACTION">Фильм</option><option value="ANIMATION">Мультфильм</option></select></label><label>Год<input min="1888" type="number" value={film.releaseYear ?? ''} onChange={(event) => setFilmValue('releaseYear', event.target.value ? Number(event.target.value) : null)} /></label><label>Длительность, мин<input min="1" type="number" value={film.durationMinutes ?? ''} onChange={(event) => setFilmValue('durationMinutes', event.target.value ? Number(event.target.value) : null)} /></label><label>Жанр<input maxLength={100} value={film.genre ?? ''} onChange={(event) => setFilmValue('genre', event.target.value || null)} /></label></div><label>URL обложки<input type="url" value={film.coverUrl ?? ''} onChange={(event) => setFilmValue('coverUrl', event.target.value || null)} /></label><label>Описание<textarea rows={3} value={film.description ?? ''} onChange={(event) => setFilmValue('description', event.target.value || null)} /></label>
    <fieldset className="library-fields"><legend>Моя библиотека</legend><label className="all-day-check"><input type="checkbox" checked={inLibrary} onChange={(event) => setInLibrary(event.target.checked)} />Добавить в библиотеку</label>{inLibrary && <><div className="form-grid"><label>Статус<select value={entry.status} onChange={(event) => setEntryValue('status', event.target.value as LibraryStatus)}>{movieStatuses.map((value) => <option key={value} value={value}>{statusLabels[value]}</option>)}</select></label><label>Оценка<select value={entry.rating ?? ''} onChange={(event) => setEntryValue('rating', event.target.value ? Number(event.target.value) : null)}><option value="">Без оценки</option>{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <option key={value}>{value}</option>)}</select></label></div><label className="favorite-check"><input type="checkbox" checked={entry.favorite} onChange={(event) => setEntryValue('favorite', event.target.checked)} />В избранном</label><label>Личная заметка<textarea rows={2} value={entry.personalNote ?? ''} onChange={(event) => setEntryValue('personalNote', event.target.value || null)} /></label></>}</fieldset>
    <div className="form-buttons">{movie && <button className="danger-button" type="button" disabled={pending || searching} onClick={() => void removeCatalog()}>{deleting ? 'Удаляем…' : 'Удалить из каталога'}</button>}<button className="secondary-button" type="button" onClick={closeForm}>Отмена</button><button className="primary-button" disabled={pending || searching}>{saving ? 'Сохраняем…' : 'Сохранить'}</button></div></form></div>
}
