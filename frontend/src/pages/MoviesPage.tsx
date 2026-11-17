import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ChevronDown, Download, Film, Heart, Plus, Search } from 'lucide-react'
import { getMovieCatalogPage, type LibraryEntry, type LibraryStatus, type Movie, type MovieCatalogStatistics } from '../api/movies'
import { ErrorState, LoadingState } from '../components/AsyncState'
import { useLatestRequest } from '../hooks/useLatestRequest'
import { MovieForm } from '../components/MovieForm'
import { KinopoiskRatingsDialog } from '../components/KinopoiskRatingsDialog'
import './MoviesPage.css'

const statusLabels: Record<LibraryStatus, string> = { NOT_STARTED: 'Не начато', PLANNED: 'В планах', IN_PROGRESS: 'Смотрю', COMPLETED: 'Просмотрено', PAUSED: 'На паузе', DROPPED: 'Брошено' }
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
  const catalogRef = useRef<HTMLDivElement>(null)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const importButtonRef = useRef<HTMLButtonElement>(null)
  const formTriggerRef = useRef<HTMLButtonElement | null>(null)
  const formMovieIdRef = useRef<number | null>(null)
  const focusAfterFormRef = useRef(false)

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
  const openForm = (movie: Movie | 'new', trigger: HTMLButtonElement) => {
    formTriggerRef.current = trigger
    formMovieIdRef.current = movie === 'new' ? null : movie.id
    setEditing(movie)
  }
  const savedForm = () => { focusAfterFormRef.current = true; setEditing(null); void load() }
  useEffect(() => {
    if (!focusAfterFormRef.current || loading || editing) return
    focusAfterFormRef.current = false
    const cardLink = formMovieIdRef.current == null ? null : catalogRef.current?.querySelector<HTMLAnchorElement>(`[data-movie-id="${formMovieIdRef.current}"] h3 a`)
    const trigger = formTriggerRef.current?.isConnected ? formTriggerRef.current : cardLink ?? addButtonRef.current
    trigger?.focus({ preventScroll: true })
  }, [loading, editing])

  return <div ref={catalogRef} className="movie-catalog-page">
    <section className="movies-catalog-toolbar" aria-label="Управление каталогом фильмов">
      <div className="movies-catalog-status-tabs" role="group" aria-label="Статус фильмов">{([['', 'Все'], ['PLANNED', 'В планах'], ['COMPLETED', 'Просмотрено']] as const).map(([value, label]) => <button type="button" key={value || 'all'} aria-pressed={status === value} onClick={() => changeFilters(query, value)}>{label}</button>)}</div>
      <div className="movies-catalog-search"><Search aria-hidden="true" /><input type="search" aria-label="Найти фильм" value={query} onChange={event => changeFilters(event.target.value, status)} placeholder="Найти фильм" /></div>
      <div className="movies-catalog-actions"><button type="button" className="secondary-button icon-button" ref={importButtonRef} onClick={() => setImporting(true)}><Download aria-hidden="true" />Импорт оценок</button><button type="button" ref={addButtonRef} className="primary-button icon-button" onClick={event => openForm('new', event.currentTarget)}><Plus aria-hidden="true" />Добавить фильм</button></div>
    </section>
    <section className="movies-catalog-layout">
      <div className="movies-catalog-main">
        <div className="movies-catalog-heading"><h2>Каталог</h2><output aria-live="polite" aria-atomic="true">{loading ? 'Загружаем фильмы…' : error ? 'Фильмы не загружены' : `Показано: ${movies.length} из ${totalItems}`}</output></div>
        {loading ? <LoadingState message="Загружаем фильмы…" /> : error ? <ErrorState title="Не удалось загрузить фильмы" message={error} onRetry={() => void load()} /> : movies.length === 0 ? <div className="movies-catalog-empty"><Film aria-hidden="true" /><h2>{filtered ? 'Фильмов не найдено' : 'Каталог пока пуст'}</h2><p>{filtered ? 'Попробуйте изменить поиск или статус.' : 'Добавьте первый фильм или импортируйте оценки.'}</p>{filtered && <button type="button" className="secondary-button" onClick={() => changeFilters('', '')}>Сбросить фильтры</button>}</div> : <>
          <section className="movies-catalog-grid" aria-label="Фильмы">{movies.map(movie => {
            const entry = library[movie.id]
            return <article className="movies-catalog-card" data-movie-id={movie.id} key={movie.id}>
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
                {entry ? <strong className="movies-catalog-rating" data-rated={entry.rating != null} aria-label={entry.rating != null ? `Моя оценка: ${entry.rating} из 10` : 'Без оценки'}>{entry.rating != null ? `${entry.rating}/10` : 'Без оценки'}</strong> : <button type="button" className="movies-catalog-add-library" aria-label={`Добавить в библиотеку: ${movie.title}`} onClick={event => openForm(movie, event.currentTarget)}><Plus aria-hidden="true" />В библиотеку</button>}
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
    {editing && <MovieForm movie={editing === 'new' ? undefined : editing} library={editing === 'new' ? undefined : library[editing.id]} existingMovieIds={movies.map((item) => item.id)} returnFocusTo={formTriggerRef.current} onClose={() => setEditing(null)} onSaved={savedForm} />}
    {importing && <KinopoiskRatingsDialog returnFocusTo={importButtonRef.current} onClose={() => setImporting(false)} onImported={() => { void load() }} />}
  </div>
}
