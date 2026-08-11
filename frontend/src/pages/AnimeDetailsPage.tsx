import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { getAnimeDetails, type AnimeDetails } from '../api/anime'
import {
  clearSeasonWatches, getEpisodeWatches, getSeasonCompletion, watchEpisode,
  type Episode, type Season, type SeasonCompletion,
} from '../api/series'
import type { LibraryStatus, ReleaseStatus, Watch } from '../api/movies'
import { AnimeForm } from './AnimePage'
import { BulkEpisodeForm, EpisodeForm, SeasonCompletionForm, SeasonForm } from './SeriesDetailsPage'

type EpisodeDetails = Episode & { watches: Watch[] }
type SeasonDetails = Season & { episodes: EpisodeDetails[]; completion?: SeasonCompletion }
const statusLabels: Record<LibraryStatus, string> = { NOT_STARTED: 'Не начато', PLANNED: 'В планах', IN_PROGRESS: 'Смотрю', COMPLETED: 'Просмотрено', PAUSED: 'На паузе', DROPPED: 'Брошено' }
const releaseLabels: Record<ReleaseStatus, string> = { ANNOUNCED: 'Анонсировано', ONGOING: 'Выходит', RELEASED: 'Вышло', ENDED: 'Завершено', CANCELLED: 'Отменено' }
const formatDate = (value: string) => new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

export function AnimeDetailsPage() {
  const id = Number(useParams().id)
  const [anime, setAnime] = useState<AnimeDetails | null>(null)
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
      const item = await getAnimeDetails(id)
      const details = await Promise.all(item.seasons.map(async (season) => ({
        id: season.id, contentId: item.id, seasonNumber: season.seasonNumber, title: season.title,
        releaseYear: season.releaseYear, completion: await getSeasonCompletion(season.id),
        episodes: await Promise.all(season.episodes.map(async (episode) => ({
          id: episode.id, seasonId: season.id, episodeNumber: episode.episodeNumber, title: episode.title,
          durationMinutes: episode.durationMinutes, releaseDate: episode.releaseDate,
          watches: await getEpisodeWatches(episode.id),
        }))),
      })))
      setAnime(item); setSeasons(details)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось загрузить аниме') }
    finally { setLoading(false) }
  }, [id])
  useEffect(() => { void load() }, [load])

  const episodes = useMemo(() => seasons.flatMap((season) => season.episodes), [seasons])
  const watched = useMemo(() => episodes.filter((episode) => episode.watches.length), [episodes])
  const progress = episodes.length ? watched.length / episodes.length * 100 : 0
  const lastWatch = useMemo(() => {
    const manual = watched.flatMap((episode) => episode.watches.filter((watch) => !watch.bulk).map((watch) => ({ occurredAt: watch.watchedAt, label: `S${seasons.find((season) => season.id === episode.seasonId)?.seasonNumber} · E${episode.episodeNumber}`, detail: episode.title })))
    const completed = seasons.filter((season) => season.completion?.completedAt).map((season) => ({ occurredAt: season.completion!.completedAt!, label: `Сезон ${season.seasonNumber}`, detail: `Просмотрено ${season.completion!.episodeCount} эпизодов` }))
    return [...manual, ...completed].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]
  }, [seasons, watched])
  const markEpisode = async (episode: Episode) => { try { await watchEpisode(episode.id); await load() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось отметить эпизод') } }
  const clearSeason = async (season: Season) => { if (!window.confirm(`Снять все отметки просмотра с сезона ${season.seasonNumber}?`)) return; try { await clearSeasonWatches(season.id); await load() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось снять отметки') } }

  if (loading) return <div className="loading"><span />Загружаем аниме…</div>
  if (error || !anime) return <div className="notice error"><strong>Не удалось открыть аниме</strong><span>{error}</span></div>

  return <div className="series-details-page anime-details-page">
    <div className="game-details-toolbar"><Link to="/anime">← Назад к аниме</Link><button className="secondary-button" onClick={() => setEditing(true)}>✎ Редактировать</button></div>
    <section className="series-hero-card"><div className="movie-detail-poster anime-detail-poster" style={anime.coverUrl ? { backgroundImage: `url(${anime.coverUrl})` } : undefined}><span>{anime.title.slice(0, 1)}</span></div><div className="movie-main-info"><p className="eyebrow">Многосерийное аниме</p><h1>{anime.title}</h1>{anime.originalTitle && <h2>{anime.originalTitle}</h2>}<dl><div><dt>Год</dt><dd>{anime.releaseYear ?? '—'}</dd></div><div><dt>Статус выпуска</dt><dd>{releaseLabels[anime.releaseStatus]}</dd></div><div><dt>Формат</dt><dd>TV-сериал</dd></div></dl></div><div className="movie-personal-info"><small>Мой статус</small><strong>{anime.userStatus ? statusLabels[anime.userStatus] : 'Не в библиотеке'}</strong><small>Моя оценка</small><strong>{anime.rating ? `★ ${anime.rating}/10` : '—'}</strong><small>Заметки</small><p>{anime.personalNote ?? 'Заметок пока нет.'}</p></div></section>
    <section className="series-summary-grid"><article className="detail-card series-progress-card"><div><h2>Прогресс просмотра</h2><strong>{watched.length} из {episodes.length} эпизодов</strong></div><b>{Math.round(progress)}%</b><div className="series-progress anime-progress"><span style={{ width: `${progress}%` }} /></div></article><article className="detail-card series-count-card"><h2>Сезоны и эпизоды</h2><strong>{seasons.length}<small>сезонов</small></strong><strong>{episodes.length}<small>эпизодов</small></strong></article><article className="detail-card series-last-watch"><h2>Последний просмотр</h2>{lastWatch ? <><strong>{lastWatch.label}</strong><span>{lastWatch.detail}</span><small>{formatDate(lastWatch.occurredAt)}</small></> : <span>{watched.length ? 'Дата исторического просмотра не указана' : 'Просмотров пока нет'}</span>}</article></section>
    {anime.description && <section className="detail-card movie-description"><h2>Описание</h2><p>{anime.description}</p></section>}
    <section className="detail-card series-season-panel"><div className="panel-heading"><div><p className="eyebrow">Структура аниме</p><h2>Сезоны и эпизоды</h2></div><button className="primary-button" onClick={() => setAddingSeason(true)}>+ Добавить сезон</button></div>{seasons.length ? <div className="season-detail-list">{seasons.map((season) => <details key={season.id}><summary><span><b>Сезон {season.seasonNumber}</b>{season.title && <small>{season.title}</small>}{season.completion && <small>{season.completion.completedAt ? `Завершён ${new Intl.DateTimeFormat('ru-RU').format(new Date(season.completion.completedAt))}` : 'Просмотрен · дата неизвестна'}</small>}</span><span className="season-summary-actions"><em>{season.episodes.filter((episode) => episode.watches.length).length} из {season.episodes.length}</em><button onClick={(event) => { event.preventDefault(); setEditingSeason(season) }}>Изменить</button></span></summary><div className="season-bulk-actions"><button onClick={() => setBulkSeason(season)}>+ Добавить несколько эпизодов</button><button disabled={!season.episodes.length} onClick={() => setCompletingSeason(season)}>✓ Просмотрен весь сезон</button><button disabled={!season.episodes.some((episode) => episode.watches.length)} onClick={() => void clearSeason(season)}>Снять просмотры</button></div><div className="episode-detail-list">{season.episodes.map((episode) => <div className={episode.watches.length ? 'watched' : ''} key={episode.id}><b>{episode.episodeNumber}</b><button className="episode-title-button" onClick={() => setEditingEpisode({ season, episode })}><strong>{episode.title}</strong><small>{episode.releaseDate ? new Intl.DateTimeFormat('ru-RU').format(new Date(episode.releaseDate)) : 'Дата не указана'}{episode.durationMinutes ? ` · ${episode.durationMinutes} мин` : ''}</small></button><em>{episode.watches.length ? `Просмотрено${episode.watches.length > 1 ? ` ×${episode.watches.length}` : ''}` : 'Не просмотрено'}</em><button title="Отметить просмотренным" onClick={() => void markEpisode(episode)}>✓</button></div>)}<button className="add-episode-row" onClick={() => setEpisodeSeason(season)}>+ Добавить один эпизод</button></div></details>)}</div> : <p className="muted">Сезонов пока нет.</p>}</section>
    {editing && <AnimeForm anime={anime} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); void load() }} />}
    {addingSeason && <SeasonForm series={anime} onClose={() => setAddingSeason(false)} onSaved={() => { setAddingSeason(false); void load() }} />}
    {editingSeason && <SeasonForm series={anime} season={editingSeason} onClose={() => setEditingSeason(null)} onSaved={() => { setEditingSeason(null); void load() }} />}
    {episodeSeason && <EpisodeForm season={episodeSeason} onClose={() => setEpisodeSeason(null)} onSaved={() => { setEpisodeSeason(null); void load() }} />}
    {editingEpisode && <EpisodeForm season={editingEpisode.season} episode={editingEpisode.episode} onClose={() => setEditingEpisode(null)} onSaved={() => { setEditingEpisode(null); void load() }} />}
    {bulkSeason && <BulkEpisodeForm season={bulkSeason} onClose={() => setBulkSeason(null)} onSaved={() => { setBulkSeason(null); void load() }} />}
    {completingSeason && <SeasonCompletionForm season={completingSeason} onClose={() => setCompletingSeason(null)} onSaved={() => { setCompletingSeason(null); void load() }} />}
  </div>
}
