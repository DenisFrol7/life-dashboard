import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Pencil, Plus } from 'lucide-react'
import { deleteMovieWatch, getLibrary, getMovie, getMovieWatches, updateMovieWatch, watchMovie, type LibraryEntry, type LibraryStatus, type Movie, type Watch } from '../api/movies'
import { ErrorState, LoadingState } from '../components/AsyncState'
import { MovieForm } from '../components/MovieForm'
import { MovieDialog } from '../components/MovieDialog'
import { useFormMutation } from '../hooks/useFormMutation'
import { useLatestRequest } from '../hooks/useLatestRequest'
import './MovieDetailsPage.css'

const statusLabels: Record<LibraryStatus, string> = {
  NOT_STARTED: 'Не начато', PLANNED: 'В планах', IN_PROGRESS: 'Смотрю',
  COMPLETED: 'Просмотрено', PAUSED: 'На паузе', DROPPED: 'Брошено',
}
const formatDate = (value: string) => new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long' }).format(new Date(value))
const formatDateTime = (value: string) => new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))
const localDateTime = (value: string) => { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) }
const duration = (minutes: number | null) => minutes == null ? '—' : `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`

export function MovieDetailsPage() {
  const id = Number(useParams().id)
  return <MovieDetails key={id} id={id} />
}

function MovieDetails({ id }: { id: number }) {
  const navigate = useNavigate()
  const requests = useLatestRequest()
  const [movie, setMovie] = useState<Movie | null>(null)
  const [library, setLibrary] = useState<LibraryEntry | undefined>()
  const [watches, setWatches] = useState<Watch[]>([])
  const [editing, setEditing] = useState(false)
  const [watch, setWatch] = useState<Watch | 'new' | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const focusAfterRefreshRef = useRef(false)
  const focusTargetRef = useRef<'edit' | 'new' | number>('edit')

  const load = useCallback(() => requests.run(async () => {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Некорректный идентификатор фильма')
    const result = await Promise.all([getMovie(id), getLibrary(), getMovieWatches(id)])
    if (result[0].itemType !== 'MOVIE') throw new Error('Запрошенная запись не является фильмом')
    return result
  }, {
    onStart: () => { setLoading(true); setError(null) },
    onSuccess: ([item, entries, history]) => { setMovie(item); setLibrary(entries.find(entry => entry.content.id === id)); setWatches(history) },
    onError: reason => setError(reason instanceof Error ? reason.message : 'Не удалось загрузить фильм'),
    onFinish: () => setLoading(false),
  }), [id, requests])
  useEffect(() => { void load(); return () => requests.invalidate() }, [load, requests])
  useEffect(() => {
    if (!focusAfterRefreshRef.current || loading || editing || watch) return
    focusAfterRefreshRef.current = false
    const target = focusTargetRef.current
    const selector = target === 'edit' ? '.film-details-edit' : target === 'new' ? '.film-details-add-watch' : `[data-watch-id="${target}"]`
    const trigger = triggerRef.current?.isConnected ? triggerRef.current : pageRef.current?.querySelector<HTMLButtonElement>(selector) ?? pageRef.current?.querySelector<HTMLButtonElement>('.film-details-add-watch')
    trigger?.focus({ preventScroll: true })
  }, [loading, editing, watch])
  const openEdit = (trigger: HTMLButtonElement) => { triggerRef.current = trigger; focusTargetRef.current = 'edit'; setEditing(true) }
  const openWatch = (item: Watch | 'new', trigger: HTMLButtonElement) => { triggerRef.current = trigger; focusTargetRef.current = item === 'new' ? 'new' : item.id; setWatch(item) }
  const saved = () => { focusAfterRefreshRef.current = true; setEditing(false); setWatch(null); void load() }
  const latestWatch = watches.reduce<Watch | null>((latest, item) => !latest || Date.parse(item.watchedAt) > Date.parse(latest.watchedAt) ? item : latest, null)

  return <div ref={pageRef} className="film-details-page">
    <div className="film-details-toolbar"><Link className="icon-button" to="/movies"><ArrowLeft aria-hidden="true" />Назад к фильмам</Link>{movie && <button type="button" disabled={loading || Boolean(error)} className="secondary-button icon-button film-details-edit" onClick={event => openEdit(event.currentTarget)}><Pencil aria-hidden="true" />Редактировать</button>}</div>
    {loading ? <LoadingState message="Загружаем фильм…" /> : error || !movie ? <ErrorState title="Не удалось открыть фильм" message={error ?? 'Фильм не найден'} onRetry={() => void load()} /> : <>
      <section className="film-details-hero">
        <div className="film-details-poster"><span aria-hidden="true">{movie.title.slice(0, 1)}</span>{movie.coverUrl && <img key={movie.coverUrl} src={movie.coverUrl} alt={`Постер фильма «${movie.title}»`} onError={event => { event.currentTarget.hidden = true }} />}</div>
        <div className="film-details-info"><p className="eyebrow">{movie.format === 'ANIMATION' ? 'Мультфильм' : 'Фильм'}</p><h2>{movie.title}</h2>{movie.originalTitle && <p className="film-details-original">{movie.originalTitle}</p>}<dl><div><dt>Год</dt><dd>{movie.releaseYear ?? '—'}</dd></div><div><dt>Длительность</dt><dd>{duration(movie.durationMinutes)}</dd></div><div className="film-details-genre"><dt>Жанр</dt><dd>{movie.genre ?? '—'}</dd></div></dl></div>
        <div className="film-details-personal"><div><span>Статус</span><strong className="film-details-status">{library ? statusLabels[library.status] : 'Не в библиотеке'}</strong>{latestWatch && <small>Последний просмотр: {formatDate(latestWatch.watchedAt)}</small>}</div><div className="film-details-score"><span>Моя оценка</span><strong className="film-details-rating">{library?.rating != null ? `${library.rating}/10` : 'Без оценки'}</strong></div><div className="film-details-note"><span>Заметки</span><p>{library?.personalNote || 'Заметок пока нет.'}</p></div></div>
      </section>
      <section className="film-details-panel film-details-watch-summary" aria-labelledby="film-details-history-title"><h2 id="film-details-history-title">История просмотров</h2><dl><div><dt>Количество просмотров</dt><dd>{watches.length}</dd></div><div><dt>Последний просмотр</dt><dd>{latestWatch ? formatDate(latestWatch.watchedAt) : 'Просмотров пока нет'}</dd></div></dl><button type="button" className="primary-button icon-button film-details-add-watch" onClick={event => openWatch('new', event.currentTarget)}><Plus aria-hidden="true" />Добавить просмотр</button></section>
      {movie.description && <section className="film-details-panel film-details-description"><h2>Описание</h2><p>{movie.description}</p></section>}
      <section className="film-details-panel film-details-history"><p className="eyebrow">История</p><h2>Все просмотры</h2>{watches.length ? <div className="film-details-watch-list">{[...watches].reverse().map(item => <button type="button" data-watch-id={item.id} key={item.id} onClick={event => openWatch(item, event.currentTarget)} aria-label={`Изменить просмотр №${item.watchNumber}, ${formatDateTime(item.watchedAt)}`}><b aria-hidden="true">{item.watchNumber}</b><span><strong>Просмотр №{item.watchNumber}</strong><time dateTime={item.watchedAt}>{formatDateTime(item.watchedAt)}</time></span><span className="film-details-watch-edit"><Pencil aria-hidden="true" />Изменить</span></button>)}</div> : <p className="film-details-empty">Просмотров пока нет.</p>}</section>
    </>}
    {editing && movie && <MovieForm movie={movie} library={library} returnFocusTo={triggerRef.current} onClose={() => setEditing(false)} onSaved={saved} onDeleted={() => navigate('/movies', { replace: true })} />}
    {watch && movie && <MovieWatchForm movie={movie} watch={watch === 'new' ? undefined : watch} returnFocusTo={triggerRef.current} onClose={() => setWatch(null)} onSaved={saved} />}
  </div>
}

function MovieWatchForm({ movie, watch, returnFocusTo, onClose, onSaved }: { movie: Movie; watch?: Watch; returnFocusTo: HTMLElement | null; onClose: () => void; onSaved: () => void }) {
  const [watchedAt, setWatchedAt] = useState(() => localDateTime(watch?.watchedAt ?? new Date().toISOString()))
  const mutations = useFormMutation()
  const { saving, deleting, pending } = mutations
  const [error, setError] = useState<string | null>(null)
  const closeForm = () => { mutations.dispose(); onClose() }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (pending) return
    setError(null)
    const instant = new Date(watchedAt)
    if (!watchedAt || Number.isNaN(instant.getTime())) { setError('Укажите дату и время просмотра.'); return }
    await mutations.run('save', () => watch ? updateMovieWatch(watch.id, instant.toISOString()) : watchMovie(movie.id, instant.toISOString()), {
      onSuccess: onSaved,
      onError: reason => setError(reason instanceof Error ? reason.message : 'Не удалось сохранить просмотр'),
    })
  }
  const remove = async () => {
    if (!watch || pending) return
    setError(null)
    await mutations.run('delete', async () => {
      if (!window.confirm(`Удалить просмотр №${watch.watchNumber}?`)) return false
      await deleteMovieWatch(watch.id)
      return true
    }, {
      onSuccess: deleted => { if (deleted) onSaved() },
      onError: reason => setError(reason instanceof Error ? reason.message : 'Не удалось удалить просмотр'),
    })
  }
  return <MovieDialog title={watch ? `Просмотр №${watch.watchNumber}` : 'Новый просмотр'} eyebrow="История просмотров" returnFocusTo={returnFocusTo} onClose={closeForm} onSubmit={event => void submit(event)} actions={<>
    {watch && <button className="movie-dialog-delete" type="button" disabled={pending} onClick={() => void remove()}>{deleting ? 'Удаляем…' : 'Удалить'}</button>}
    <button className="secondary-button" type="button" onClick={closeForm}>Отмена</button><button className="primary-button" disabled={pending}>{saving ? 'Сохраняем…' : 'Сохранить'}</button>
  </>}>
    {error && <div className="form-error" role="alert">{error}</div>}
    <p className="film-details-watch-title">{movie.title}</p>
    <label>Дата и время<input required type="datetime-local" value={watchedAt} onChange={event => setWatchedAt(event.target.value)} /></label>
  </MovieDialog>
}
