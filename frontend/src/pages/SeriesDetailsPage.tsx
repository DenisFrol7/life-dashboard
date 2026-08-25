import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { ArrowLeft, Pencil } from 'lucide-react'
import {
  createEpisode,
  createEpisodes,
  createSeason,
  deleteEpisode,
  deleteSeason,
  clearSeasonWatches,
  getViewingStructure,
  getSeriesById,
  getSeriesLibrary,
  watchEpisode,
  watchSeason,
  updateEpisode,
  updateSeason,
  type Episode,
  type Season,
  type Series,
  type SeriesLibraryEntry,
  type SeasonCompletion,
} from '../api/series'
import type { LibraryStatus, ReleaseStatus, Watch } from '../api/movies'
import { SeriesForm } from './SeriesPage'

type SeasonDetails = Season & { episodes: Array<Episode & { watches: Watch[] }>; completion?: SeasonCompletion }
const statusLabels: Record<LibraryStatus, string> = { NOT_STARTED: 'Не начато', PLANNED: 'В планах', IN_PROGRESS: 'Смотрю', COMPLETED: 'Просмотрено', PAUSED: 'На паузе', DROPPED: 'Брошено' }
const releaseLabels: Record<ReleaseStatus, string> = { ANNOUNCED: 'Анонсирован', ONGOING: 'Выходит', RELEASED: 'Вышел', ENDED: 'Завершён', CANCELLED: 'Отменён' }
const formatDate = (value: string) => new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' }).format(new Date(value))
const countLabel = (count: number, one: string, few: string, many: string) => {
  const lastTwo = count % 100
  const last = count % 10
  return lastTwo >= 11 && lastTwo <= 14 ? many : last === 1 ? one : last >= 2 && last <= 4 ? few : many
}

export function SeriesDetailsPage() {
  const id = Number(useParams().id)
  const [series, setSeries] = useState<Series | null>(null)
  const [library, setLibrary] = useState<SeriesLibraryEntry | undefined>()
  const [seasons, setSeasons] = useState<SeasonDetails[]>([])
  const [editing, setEditing] = useState(false)
  const [addingSeason, setAddingSeason] = useState(false)
  const [editingSeason, setEditingSeason] = useState<Season | null>(null)
  const [episodeSeason, setEpisodeSeason] = useState<Season | null>(null)
  const [editingEpisode, setEditingEpisode] = useState<{ season: Season; episode: Episode } | null>(null)
  const [bulkSeason, setBulkSeason] = useState<Season | null>(null)
  const [completingSeason, setCompletingSeason] = useState<Season | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [item, entries, structure] = await Promise.all([getSeriesById(id), getSeriesLibrary(), getViewingStructure(id)])
      if (item.itemType !== 'SERIES') throw new Error('Запрошенная запись не является сериалом')
      setSeries(item); setLibrary(entries.find((entry) => entry.content.id === id)); setSeasons(structure.seasons)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось загрузить сериал') }
    finally { setLoading(false) }
  }, [id])
  useEffect(() => { void load() }, [load])

  const episodes = useMemo(() => seasons.flatMap((season) => season.episodes), [seasons])
  const watched = useMemo(() => episodes.filter((episode) => episode.watches.length > 0), [episodes])
  const progress = episodes.length ? watched.length / episodes.length * 100 : 0
  const lastWatch = useMemo(() => {
    const manual = watched.flatMap((episode) => episode.watches.filter((watch) => !watch.bulk).map((watch) => ({ occurredAt: watch.watchedAt, label: `S${seasons.find((season) => season.id === episode.seasonId)?.seasonNumber} · E${episode.episodeNumber}`, detail: episode.title })))
    const completed = seasons.filter((season) => season.completion?.completedAt).map((season) => ({ occurredAt: season.completion!.completedAt!, label: `Сезон ${season.seasonNumber}`, detail: `Просмотрено ${season.completion!.episodeCount} эпизодов` }))
    return [...manual, ...completed].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]
  }, [seasons, watched])
  const markWatched = async (episode: Episode) => { try { await watchEpisode(episode.id); await load() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось отметить эпизод') } }
  const clearSeason = async (season: Season) => { if (!window.confirm(`Снять все отметки просмотра с сезона ${season.seasonNumber}?`)) return; try { await clearSeasonWatches(season.id); await load() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось снять отметки') } }

  if (loading) return <div className="loading"><span />Загружаем сериал…</div>
  if (error || !series) return <div className="notice error"><strong>Не удалось открыть сериал</strong><span>{error}</span></div>

  return <div className="series-details-page">
    <div className="game-details-toolbar"><Link to="/series"><ArrowLeft />Назад к сериалам</Link><button className="secondary-button icon-button" onClick={() => setEditing(true)}><Pencil />Редактировать</button></div>
    <section className="series-hero-card">
      <div className="movie-detail-poster" style={series.coverUrl ? { backgroundImage: `url(${series.coverUrl})` } : undefined}><span>{series.title.slice(0, 1)}</span></div>
      <div className="movie-main-info"><p className="eyebrow">{series.format === 'ANIMATION' ? 'Мультсериал' : 'Сериал'}</p><h1>{series.title}</h1>{series.originalTitle && <h2>{series.originalTitle}</h2>}<dl><div><dt>Год</dt><dd>{series.releaseYear ?? '—'}</dd></div><div><dt>Жанр</dt><dd>{series.genre ?? '—'}</dd></div><div><dt>Статус выпуска</dt><dd>{releaseLabels[series.releaseStatus]}</dd></div></dl></div>
      <div className="movie-personal-info series-personal-info"><div><small>Мой статус</small><strong className="detail-status">● {library ? statusLabels[library.status] : 'Не в библиотеке'}</strong>{library?.status === 'COMPLETED' && library.completedAt && <span>Завершён: {formatDate(library.completedAt)}</span>}</div><div><small>Моя оценка</small><strong className="series-detail-rating">{library?.rating ? `${library.rating}/10` : '—'}</strong></div><div><small>Заметки</small><p>{library?.personalNote ?? 'Заметок пока нет.'}</p></div></div>
    </section>
    <section className="series-summary-grid">
      <article className="detail-card series-progress-card"><div><h2>Прогресс просмотра</h2><strong>{watched.length} из {episodes.length} эпизодов</strong></div><b>{Math.round(progress)}%</b><div className="series-progress"><span style={{ width: `${progress}%` }} /></div></article>
      <article className="detail-card series-count-card"><h2>Сезоны и эпизоды</h2><strong>{seasons.length} <small>{countLabel(seasons.length, 'сезон', 'сезона', 'сезонов')}</small></strong><strong>{episodes.length} <small>{countLabel(episodes.length, 'эпизод', 'эпизода', 'эпизодов')}</small></strong></article>
      <article className="detail-card series-last-watch"><h2>Последний просмотр</h2>{lastWatch ? <><strong>{lastWatch.label}</strong><span>{lastWatch.detail}</span><small>{formatDate(lastWatch.occurredAt)}</small></> : <span>{watched.length ? 'Дата исторического просмотра не указана' : 'Просмотров пока нет'}</span>}</article>
    </section>
    {series.description && <section className="detail-card movie-description"><h2>Описание</h2><p>{series.description}</p></section>}
    <section className="detail-card series-season-panel"><div className="panel-heading"><div><p className="eyebrow">Структура сериала</p><h2>Сезоны и эпизоды</h2></div><button className="primary-button" onClick={() => setAddingSeason(true)}>+ Добавить сезон</button></div>
      {seasons.length ? <div className="season-detail-list">{seasons.map((season) => <details key={season.id}><summary><span><b>Сезон {season.seasonNumber}</b>{season.title && <small>{season.title}</small>}{season.completion && <small>{season.completion.completedAt ? `Завершён ${new Intl.DateTimeFormat('ru-RU').format(new Date(season.completion.completedAt))}` : 'Просмотрен · дата неизвестна'}</small>}</span><span className="season-summary-actions"><em>{season.episodes.filter((episode) => episode.watches.length).length} из {season.episodes.length}</em><button type="button" onClick={(event) => { event.preventDefault(); setEditingSeason(season) }}>Изменить</button></span></summary><div className="season-bulk-actions"><button onClick={() => setBulkSeason(season)}>+ Добавить несколько эпизодов</button><button disabled={!season.episodes.length} onClick={() => setCompletingSeason(season)}>✓ Просмотрен весь сезон</button><button disabled={!season.episodes.some((episode) => episode.watches.length)} onClick={() => void clearSeason(season)}>Снять просмотры</button></div><div className="episode-detail-list">{season.episodes.map((episode) => <div className={episode.watches.length ? 'watched' : ''} key={episode.id}><b>{episode.episodeNumber}</b><button className="episode-title-button" onClick={() => setEditingEpisode({ season, episode })}><strong>{episode.title}</strong><small>{episode.releaseDate ? new Intl.DateTimeFormat('ru-RU').format(new Date(episode.releaseDate)) : 'Дата не указана'}{episode.durationMinutes ? ` · ${episode.durationMinutes} мин` : ''}</small></button><em>{episode.watches.length ? `Просмотрено${episode.watches.length > 1 ? ` ×${episode.watches.length}` : ''}` : 'Не просмотрено'}</em><button title="Отметить просмотренным" onClick={() => void markWatched(episode)}>✓</button></div>)}<button className="add-episode-row" onClick={() => setEpisodeSeason(season)}>+ Добавить один эпизод</button></div></details>)}</div> : <p className="muted">Сезонов пока нет.</p>}
    </section>
    {editing && <SeriesForm series={series} library={library} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void load() }} />}
    {addingSeason && <SeasonForm series={series} onClose={() => setAddingSeason(false)} onSaved={() => { setAddingSeason(false); void load() }} />}
    {editingSeason && <SeasonForm series={series} season={editingSeason} onClose={() => setEditingSeason(null)} onSaved={() => { setEditingSeason(null); void load() }} />}
    {episodeSeason && <EpisodeForm season={episodeSeason} onClose={() => setEpisodeSeason(null)} onSaved={() => { setEpisodeSeason(null); void load() }} />}
    {editingEpisode && <EpisodeForm season={editingEpisode.season} episode={editingEpisode.episode} onClose={() => setEditingEpisode(null)} onSaved={() => { setEditingEpisode(null); void load() }} />}
    {bulkSeason && <BulkEpisodeForm season={bulkSeason} onClose={() => setBulkSeason(null)} onSaved={() => { setBulkSeason(null); void load() }} />}
    {completingSeason && <SeasonCompletionForm season={completingSeason} onClose={() => setCompletingSeason(null)} onSaved={() => { setCompletingSeason(null); void load() }} />}
  </div>
}

export function SeasonForm({ series, season, onClose, onSaved }: { series: { id: number; title: string }; season?: Season; onClose: () => void; onSaved: () => void }) {
  const [number, setNumber] = useState(season?.seasonNumber ?? 1); const [title, setTitle] = useState(season?.title ?? ''); const [year, setYear] = useState<number | null>(season?.releaseYear ?? null); const [episodeCount, setEpisodeCount] = useState(0); const [episodeMinutes, setEpisodeMinutes] = useState<number | null>(null); const [markWatched, setMarkWatched] = useState(false); const [watchedAt, setWatchedAt] = useState(''); const [error, setError] = useState<string | null>(null)
  const submit = async (event: FormEvent) => { event.preventDefault(); try { const input = { seasonNumber: number, title: title || null, releaseYear: year }; if (season) await updateSeason(season.id, input); else { const created = await createSeason(series.id, input); if (episodeCount > 0) await createEpisodes(created.id, { count: episodeCount, durationMinutes: episodeMinutes, markWatched, watchedAt: markWatched && watchedAt ? new Date(`${watchedAt}T12:00:00`).toISOString() : null }) } onSaved() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить сезон') } }
  const remove = async () => { if (!season || !window.confirm(`Удалить сезон ${season.seasonNumber} вместе со всеми эпизодами и историей просмотров?`)) return; try { await deleteSeason(season.id); onSaved() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось удалить сезон') } }
  return <div className="modal-backdrop"><form className="habit-form compact-book-form" onSubmit={(event) => void submit(event)}><div className="form-heading"><div><p className="eyebrow">{series.title}</p><h2>{season ? 'Редактирование сезона' : 'Новый сезон'}</h2></div><button type="button" onClick={onClose}>×</button></div>{error && <div className="form-error">{error}</div>}<div className="form-grid"><label>Номер<input required min="1" type="number" value={number} onChange={(event) => setNumber(Number(event.target.value))} /></label><label>Год<input min="1900" type="number" value={year ?? ''} onChange={(event) => setYear(event.target.value ? Number(event.target.value) : null)} /></label></div><label>Название<input maxLength={300} value={title} onChange={(event) => setTitle(event.target.value)} /></label>{!season && <fieldset className="library-fields"><legend>Автоматическое создание эпизодов</legend><div className="form-grid"><label>Количество эпизодов<input min="0" max="1000" type="number" value={episodeCount} onChange={(event) => setEpisodeCount(Number(event.target.value))} /></label><label>Длительность каждого, мин<input min="1" type="number" value={episodeMinutes ?? ''} onChange={(event) => setEpisodeMinutes(event.target.value ? Number(event.target.value) : null)} /></label></div>{episodeCount > 0 && <><label className="favorite-check"><input type="checkbox" checked={markWatched} onChange={(event) => setMarkWatched(event.target.checked)} />Отметить весь сезон просмотренным</label>{markWatched && <><label>Дата завершения просмотра сезона<input type="date" value={watchedAt} onChange={(event) => setWatchedAt(event.target.value)} /></label><p className="form-hint">Необязательно. Если дата неизвестна, сезон не появится ложным событием в журнале.</p></>}</>}</fieldset>}<div className="form-buttons">{season && <button className="danger-button" type="button" onClick={() => void remove()}>Удалить сезон</button>}<button className="secondary-button" type="button" onClick={onClose}>Отмена</button><button className="primary-button">Сохранить</button></div></form></div>
}

export function EpisodeForm({ season, episode, onClose, onSaved }: { season: Season; episode?: Episode; onClose: () => void; onSaved: () => void }) {
  const [number, setNumber] = useState(episode?.episodeNumber ?? 1); const [title, setTitle] = useState(episode?.title ?? ''); const [minutes, setMinutes] = useState<number | null>(episode?.durationMinutes ?? null); const [date, setDate] = useState<string | null>(episode?.releaseDate ?? null); const [error, setError] = useState<string | null>(null)
  const submit = async (event: FormEvent) => { event.preventDefault(); try { const input = { episodeNumber: number, title, durationMinutes: minutes, releaseDate: date }; if (episode) await updateEpisode(episode.id, input); else await createEpisode(season.id, input); onSaved() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить эпизод') } }
  const remove = async () => { if (!episode || !window.confirm(`Удалить эпизод «${episode.title}» вместе с историей просмотров?`)) return; try { await deleteEpisode(episode.id); onSaved() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось удалить эпизод') } }
  return <div className="modal-backdrop"><form className="habit-form compact-book-form" onSubmit={(event) => void submit(event)}><div className="form-heading"><div><p className="eyebrow">Сезон {season.seasonNumber}</p><h2>{episode ? 'Редактирование эпизода' : 'Новый эпизод'}</h2></div><button type="button" onClick={onClose}>×</button></div>{error && <div className="form-error">{error}</div>}<label>Название<input required maxLength={300} value={title} onChange={(event) => setTitle(event.target.value)} /></label><div className="form-grid"><label>Номер<input required min="1" type="number" value={number} onChange={(event) => setNumber(Number(event.target.value))} /></label><label>Длительность, мин<input min="1" type="number" value={minutes ?? ''} onChange={(event) => setMinutes(event.target.value ? Number(event.target.value) : null)} /></label><label>Дата выхода<input type="date" value={date ?? ''} onChange={(event) => setDate(event.target.value || null)} /></label></div><div className="form-buttons">{episode && <button className="danger-button" type="button" onClick={() => void remove()}>Удалить эпизод</button>}<button className="secondary-button" type="button" onClick={onClose}>Отмена</button><button className="primary-button">Сохранить</button></div></form></div>
}

export function BulkEpisodeForm({ season, onClose, onSaved }: { season: Season; onClose: () => void; onSaved: () => void }) {
  const [count, setCount] = useState(20); const [minutes, setMinutes] = useState<number | null>(null); const [markWatched, setMarkWatched] = useState(false); const [watchedAt, setWatchedAt] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null)
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError(null); try { await createEpisodes(season.id, { count, durationMinutes: minutes, markWatched, watchedAt: markWatched && watchedAt ? new Date(`${watchedAt}T12:00:00`).toISOString() : null }); onSaved() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось добавить эпизоды'); setSaving(false) } }
  return <div className="modal-backdrop"><form className="habit-form compact-book-form" onSubmit={(event) => void submit(event)}><div className="form-heading"><div><p className="eyebrow">Сезон {season.seasonNumber}</p><h2>Добавить несколько эпизодов</h2></div><button type="button" onClick={onClose}>×</button></div>{error && <div className="form-error">{error}</div>}<div className="form-grid"><label>Количество<input required min="1" max="1000" type="number" value={count} onChange={(event) => setCount(Number(event.target.value))} /></label><label>Длительность каждого, мин<input min="1" type="number" value={minutes ?? ''} onChange={(event) => setMinutes(event.target.value ? Number(event.target.value) : null)} /></label></div><p className="form-hint">Будут созданы записи «Эпизод 1», «Эпизод 2» и далее. Настоящие названия можно добавить позже.</p><label className="favorite-check"><input type="checkbox" checked={markWatched} onChange={(event) => setMarkWatched(event.target.checked)} />Отметить созданные эпизоды просмотренными</label>{markWatched && <><label>Дата завершения просмотра сезона<input type="date" value={watchedAt} onChange={(event) => setWatchedAt(event.target.value)} /></label><p className="form-hint">Необязательно. В журнал добавляется одно событие только при указанной дате.</p></>}<div className="form-buttons"><button className="secondary-button" type="button" onClick={onClose}>Отмена</button><button className="primary-button" disabled={saving}>{saving ? 'Создаём…' : `Добавить ${count} эпизодов`}</button></div></form></div>
}

export function SeasonCompletionForm({ season, onClose, onSaved }: { season: Season; onClose: () => void; onSaved: () => void }) {
  const [completedAt, setCompletedAt] = useState(''); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null)
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); try { await watchSeason(season.id, completedAt ? new Date(`${completedAt}T12:00:00`).toISOString() : undefined); onSaved() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось отметить сезон'); setSaving(false) } }
  return <div className="modal-backdrop"><form className="habit-form compact-book-form" onSubmit={(event) => void submit(event)}><div className="form-heading"><div><p className="eyebrow">Сезон {season.seasonNumber}</p><h2>Отметить сезон просмотренным</h2></div><button type="button" onClick={onClose}>×</button></div>{error && <div className="form-error">{error}</div>}<label>Дата завершения просмотра сезона<input type="date" value={completedAt} onChange={(event) => setCompletedAt(event.target.value)} /></label><p className="form-hint">Дата необязательна. Если оставить поле пустым, сезон будет учтён в прогрессе, но не появится в журнале активности.</p><div className="form-buttons"><button className="secondary-button" type="button" onClick={onClose}>Отмена</button><button className="primary-button" disabled={saving}>{saving ? 'Сохраняем…' : 'Отметить сезон'}</button></div></form></div>
}
