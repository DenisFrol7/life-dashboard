import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import {
  deleteMovieWatch,
  getLibrary,
  getMovie,
  getMovieWatches,
  updateMovieWatch,
  watchMovie,
  type LibraryEntry,
  type LibraryStatus,
  type Movie,
  type Watch,
} from '../api/movies'
import { MovieForm } from './MoviesPage'

const statusLabels: Record<LibraryStatus, string> = {
  NOT_STARTED: 'Не начато', PLANNED: 'В планах', IN_PROGRESS: 'Смотрю',
  COMPLETED: 'Просмотрено', PAUSED: 'На паузе', DROPPED: 'Брошено',
}
const formatDate = (value: string) => new Intl.DateTimeFormat('ru-RU', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))
const localDateTime = (value: string) => { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
const duration = (minutes: number | null) => minutes == null ? '—' : `${Math.floor(minutes / 60)} ч ${minutes % 60} мин`

export function MovieDetailsPage() {
  const id = Number(useParams().id)
  const [movie, setMovie] = useState<Movie | null>(null)
  const [library, setLibrary] = useState<LibraryEntry | undefined>()
  const [watches, setWatches] = useState<Watch[]>([])
  const [editing, setEditing] = useState(false)
  const [watch, setWatch] = useState<Watch | 'new' | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [item, entries, history] = await Promise.all([getMovie(id), getLibrary(), getMovieWatches(id)])
      if (item.itemType !== 'MOVIE') throw new Error('Запрошенная запись не является фильмом')
      setMovie(item); setLibrary(entries.find((entry) => entry.content.id === id)); setWatches(history)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось загрузить фильм') }
    finally { setLoading(false) }
  }, [id])
  useEffect(() => { void load() }, [load])
  if (loading) return <div className="loading"><span />Загружаем фильм…</div>
  if (error || !movie) return <div className="notice error"><strong>Не удалось открыть фильм</strong><span>{error}</span></div>

  return <div className="movie-details-page">
    <div className="game-details-toolbar"><Link to="/movies">← Назад к фильмам</Link><button className="secondary-button" onClick={() => setEditing(true)}>✎ Редактировать</button></div>
    <section className="movie-hero-card">
      <div className="movie-detail-poster" style={movie.coverUrl ? { backgroundImage: `url(${movie.coverUrl})` } : undefined}><span>{movie.title.slice(0, 1)}</span></div>
      <div className="movie-main-info"><p className="eyebrow">{movie.format === 'ANIMATION' ? 'Мультфильм' : 'Фильм'}</p><h1>{movie.title}</h1>{movie.originalTitle && <h2>{movie.originalTitle}</h2>}<dl><div><dt>Год</dt><dd>{movie.releaseYear ?? '—'}</dd></div><div><dt>Жанр</dt><dd>{movie.genre ?? '—'}</dd></div><div><dt>Длительность</dt><dd>{duration(movie.durationMinutes)}</dd></div></dl></div>
      <div className="movie-personal-info series-personal-info"><div><small>Статус</small><strong className="detail-status">● {library ? statusLabels[library.status] : 'Не в библиотеке'}</strong>{watches.length > 0 && <span>Последний просмотр: {formatDate(watches.at(-1)!.watchedAt)}</span>}</div><div><small>Моя оценка</small><strong className="series-detail-rating">{library?.rating ? `${library.rating}/10` : '—'}</strong></div><div><small>Заметки</small><p>{library?.personalNote ?? 'Заметок пока нет.'}</p></div></div>
    </section>
    <section className="movie-detail-summary">
      <article className="detail-card movie-watch-summary"><h2>История просмотров</h2><div><span><small>Количество просмотров</small><strong>{watches.length}</strong></span><span><small>Последний просмотр</small><strong>{watches.length ? formatDate(watches.at(-1)!.watchedAt) : 'Просмотров пока нет'}</strong></span></div><button className="primary-button" onClick={() => setWatch('new')}>+ Добавить просмотр</button></article>
    </section>
    {movie.description && <section className="detail-card movie-description"><h2>Описание</h2><p>{movie.description}</p></section>}
    <section className="detail-card movie-watch-history"><div className="panel-heading"><div><p className="eyebrow">История</p><h2>Все просмотры</h2></div></div>{watches.length ? <div className="movie-watch-list">{[...watches].reverse().map((item) => <button key={item.id} onClick={() => setWatch(item)}><b>{item.watchNumber}</b><span><strong>Просмотр №{item.watchNumber}</strong><small>{formatDate(item.watchedAt)}</small></span><em>Изменить</em></button>)}</div> : <p className="muted">Просмотров пока нет.</p>}</section>
    {editing && <MovieForm movie={movie} library={library} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void load() }} />}
    {watch && <MovieWatchForm movie={movie} watch={watch === 'new' ? undefined : watch} onClose={() => setWatch(null)} onSaved={() => { setWatch(null); void load() }} />}
  </div>
}

function MovieWatchForm({ movie, watch, onClose, onSaved }: { movie: Movie; watch?: Watch; onClose: () => void; onSaved: () => void }) {
  const [watchedAt, setWatchedAt] = useState(watch?.watchedAt ?? new Date().toISOString())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError(null); try { if (watch) await updateMovieWatch(watch.id, watchedAt); else await watchMovie(movie.id, watchedAt); onSaved() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить просмотр') } finally { setSaving(false) } }
  const remove = async () => { if (!watch || !window.confirm(`Удалить просмотр №${watch.watchNumber}?`)) return; setSaving(true); try { await deleteMovieWatch(watch.id); onSaved() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось удалить просмотр'); setSaving(false) } }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="habit-form compact-book-form" onSubmit={(event) => void submit(event)}><div className="form-heading"><div><p className="eyebrow">История просмотров</p><h2>{watch ? `Просмотр №${watch.watchNumber}` : 'Новый просмотр'}</h2></div><button type="button" onClick={onClose}>×</button></div>{error && <div className="form-error">{error}</div>}<label>Дата и время<input required type="datetime-local" value={localDateTime(watchedAt)} onChange={(event) => setWatchedAt(new Date(event.target.value).toISOString())} /></label><div className="form-buttons">{watch && <button className="danger-button" type="button" disabled={saving} onClick={() => void remove()}>Удалить</button>}<button className="secondary-button" type="button" onClick={onClose}>Отмена</button><button className="primary-button" disabled={saving}>{saving ? 'Сохраняем…' : 'Сохранить'}</button></div></form></div>
}
