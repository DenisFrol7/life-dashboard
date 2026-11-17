import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, Check, ChevronDown, Pencil, Plus } from 'lucide-react'
import { getViewingStructure, getSeriesById, getSeriesLibrary, type Episode, type Season, type Series, type SeriesLibraryEntry, type SeasonCompletion } from '../api/series'
import type { LibraryStatus, ReleaseStatus, Watch } from '../api/movies'
import { SeriesForm } from '../components/SeriesForm'
import { BulkEpisodeForm, EpisodeForm, SeasonCompletionForm, SeasonForm } from '../components/SeriesStructureForms'
import { ErrorState, LoadingState } from '../components/AsyncState'
import { useViewingActions } from '../hooks/useViewingActions'
import { useLatestRequest } from '../hooks/useLatestRequest'
import './SeriesDetailsPage.css'

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
  return <SeriesDetails key={id} id={id} />
}

function SeriesDetails({ id }: { id: number }) {
  const navigate = useNavigate()
  const requests = useLatestRequest()
  const [series, setSeries] = useState<Series | null>(null)
  const [library, setLibrary] = useState<SeriesLibraryEntry | undefined>()
  const [seasons, setSeasons] = useState<SeasonDetails[]>([])
  const [openSeasons, setOpenSeasons] = useState<Set<number>>(() => new Set())
  const [editing, setEditing] = useState(false)
  const [addingSeason, setAddingSeason] = useState(false)
  const [editingSeason, setEditingSeason] = useState<Season | null>(null)
  const [episodeSeason, setEpisodeSeason] = useState<Season | null>(null)
  const [editingEpisode, setEditingEpisode] = useState<{ season: Season; episode: Episode } | null>(null)
  const [bulkSeason, setBulkSeason] = useState<Season | null>(null)
  const [completingSeason, setCompletingSeason] = useState<Season | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const fallbackRef = useRef('.show-details-add-season')
  const focusAfterRefreshRef = useRef(false)
  const formOpen = Boolean(editing || addingSeason || editingSeason || episodeSeason || editingEpisode || bulkSeason || completingSeason)

  const load = useCallback(() => requests.run(async () => {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Некорректный идентификатор сериала')
    const result = await Promise.all([getSeriesById(id), getSeriesLibrary(), getViewingStructure(id)])
    if (result[0].itemType !== 'SERIES') throw new Error('Запрошенная запись не является сериалом')
    return result
  }, {
    onStart: () => { setLoading(true); setError(null) },
    onSuccess: ([item, entries, structure]) => { setSeries(item); setLibrary(entries.find(entry => entry.content.id === id)); setSeasons(structure.seasons) },
    onError: reason => setError(reason instanceof Error ? reason.message : 'Не удалось загрузить сериал'),
    onFinish: () => setLoading(false),
  }), [id, requests])
  useEffect(() => { void load(); return () => requests.invalidate() }, [load, requests])
  useEffect(() => {
    if (!focusAfterRefreshRef.current || loading || formOpen) return
    focusAfterRefreshRef.current = false
    const trigger = triggerRef.current?.isConnected && !triggerRef.current.disabled ? triggerRef.current : pageRef.current?.querySelector<HTMLElement>(fallbackRef.current) ?? pageRef.current?.querySelector<HTMLElement>('.show-details-add-season')
    trigger?.focus({ preventScroll: true })
  }, [loading, formOpen])
  const captureTrigger = (trigger: HTMLButtonElement, fallback = '.show-details-add-season') => { triggerRef.current = trigger; fallbackRef.current = fallback }
  const closeForms = (refresh = false) => {
    focusAfterRefreshRef.current = true
    setEditing(false); setAddingSeason(false); setEditingSeason(null); setEpisodeSeason(null); setEditingEpisode(null); setBulkSeason(null); setCompletingSeason(null)
    if (refresh) void load()
  }
  const viewing = useViewingActions(() => { focusAfterRefreshRef.current = true; void load() }, formOpen || loading || Boolean(error))
  const disabled = viewing.disabled
  const episodes = useMemo(() => seasons.flatMap(season => season.episodes), [seasons])
  const watched = useMemo(() => episodes.filter(episode => episode.watches.length > 0), [episodes])
  const progress = episodes.length ? watched.length / episodes.length * 100 : 0
  const lastWatch = useMemo(() => {
    const manual = seasons.flatMap(season => season.episodes.flatMap(episode => episode.watches.filter(watch => !watch.bulk).map(watch => ({ occurredAt: watch.watchedAt, seasonNumber: season.seasonNumber, episodeNumber: episode.episodeNumber, label: `S${season.seasonNumber} · E${episode.episodeNumber}`, detail: episode.title }))))
    const completed = seasons.filter(season => season.completion?.completedAt).map(season => ({ occurredAt: season.completion!.completedAt!, seasonNumber: season.seasonNumber, episodeNumber: season.completion!.episodeCount, label: `Сезон ${season.seasonNumber}`, detail: `Просмотрено ${season.completion!.episodeCount} эпизодов` }))
    return [...manual, ...completed].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || b.seasonNumber - a.seasonNumber || b.episodeNumber - a.episodeNumber)[0]
  }, [seasons])

  return <div ref={pageRef} className="show-details-page">
    <div className="show-details-toolbar"><Link className="icon-button" to="/series"><ArrowLeft aria-hidden="true" />Назад к сериалам</Link>{series && <button type="button" disabled={disabled} className="secondary-button icon-button show-details-edit" onClick={event => { captureTrigger(event.currentTarget, '.show-details-edit'); setEditing(true) }}><Pencil aria-hidden="true" />Редактировать</button>}</div>
    {loading && !series ? <LoadingState message="Загружаем сериал…" /> : !series ? <ErrorState title="Не удалось открыть сериал" message={error ?? 'Сериал не найден'} onRetry={() => void load()} /> : <>
      {error && <ErrorState title="Не удалось обновить сериал" message={error} onRetry={() => void load()} compact />}
      {loading && <p className="show-details-loading" role="status">Обновляем сведения о сериале…</p>}
      <section className="show-details-hero">
        <div className="show-details-poster"><span aria-hidden="true">{series.title.slice(0, 1)}</span>{series.coverUrl && <img key={series.coverUrl} src={series.coverUrl} alt={`Постер сериала «${series.title}»`} onError={event => { event.currentTarget.hidden = true }} />}</div>
        <div className="show-details-info"><p className="eyebrow">{series.format === 'ANIMATION' ? 'Мультсериал' : 'Сериал'}</p><h2>{series.title}</h2>{series.originalTitle && <p className="show-details-original">{series.originalTitle}</p>}<dl><div><dt>Год</dt><dd>{series.releaseYear ?? '—'}</dd></div><div><dt>Статус выпуска</dt><dd>{releaseLabels[series.releaseStatus]}</dd></div><div className="show-details-genre"><dt>Жанр</dt><dd>{series.genre ?? '—'}</dd></div></dl></div>
        <div className="show-details-personal"><div><span>Мой статус</span><strong className="show-details-status">{library ? statusLabels[library.status] : 'Не в библиотеке'}</strong>{library?.status === 'COMPLETED' && library.completedAt && <small>Завершён: {formatDate(library.completedAt)}</small>}</div><div className="show-details-score"><span>Моя оценка</span><strong className="show-details-rating">{library?.rating != null ? `${library.rating}/10` : 'Без оценки'}</strong></div><div className="show-details-note"><span>Заметки</span><p>{library?.personalNote || 'Заметок пока нет.'}</p></div></div>
      </section>
      <section className="show-details-summary" aria-label="Прогресс сериала">
        <article className="show-details-panel show-details-progress"><h2>Прогресс просмотра</h2><div><strong>{watched.length} из {episodes.length} эпизодов</strong><b>{Math.round(progress)}%</b></div><div className="show-details-progress-bar" role="progressbar" aria-label="Прогресс просмотра" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)} aria-valuetext={`Просмотрено ${watched.length} из ${episodes.length} эпизодов`}><span style={{ width: `${progress}%` }} /></div></article>
        <article className="show-details-panel show-details-count"><h2>Сезоны и эпизоды</h2><dl><div><dt>{countLabel(seasons.length, 'сезон', 'сезона', 'сезонов')}</dt><dd>{seasons.length}</dd></div><div><dt>{countLabel(episodes.length, 'эпизод', 'эпизода', 'эпизодов')}</dt><dd>{episodes.length}</dd></div></dl></article>
        <article className="show-details-panel show-details-last-watch"><h2>Последний просмотр</h2>{lastWatch ? <><strong>{lastWatch.label}</strong><span>{lastWatch.detail}</span><time dateTime={lastWatch.occurredAt}>{formatDate(lastWatch.occurredAt)}</time></> : <span>{watched.length ? 'Дата исторического просмотра не указана' : 'Просмотров пока нет'}</span>}</article>
      </section>
      {series.description && <section className="show-details-panel show-details-description"><h2>Описание</h2><p>{series.description}</p></section>}
      <section className="show-details-panel show-details-seasons" aria-busy={viewing.pending || loading}>
        <div className="show-details-season-heading"><div><p className="eyebrow">Структура сериала</p><h2>Сезоны и эпизоды</h2></div><button type="button" disabled={disabled} className="primary-button icon-button show-details-add-season" onClick={event => { captureTrigger(event.currentTarget); setAddingSeason(true) }}><Plus aria-hidden="true" />Добавить сезон</button></div>
        {viewing.error && <div className="show-details-action-error" role="alert">{viewing.error}</div>}{viewing.pending && <p className="show-details-loading" role="status">{viewing.deleting ? 'Снимаем отметки…' : 'Сохраняем отметку…'}</p>}
        {seasons.length ? <div className="show-details-season-list">{seasons.map(season => {
          const seasonFallback = `[data-season-id="${season.id}"] > summary`
          return <details data-season-id={season.id} key={season.id} open={openSeasons.has(season.id)} onToggle={event => { const open = event.currentTarget.open; setOpenSeasons(current => { if (current.has(season.id) === open) return current; const next = new Set(current); if (open) next.add(season.id); else next.delete(season.id); return next }) }}>
            <summary><div className="show-details-season-copy"><strong>Сезон {season.seasonNumber}</strong>{season.title && <p>{season.title}</p>}{season.releaseYear && <small>{season.releaseYear}</small>}{season.completion && <small>{season.completion.completedAt ? `Завершён ${formatDate(season.completion.completedAt)}` : 'Просмотрен · дата неизвестна'}</small>}</div><span className="show-details-season-count">{season.episodes.filter(episode => episode.watches.length).length} из {season.episodes.length} эпизодов</span><ChevronDown aria-hidden="true" /></summary>
            <div className="show-details-season-actions"><button type="button" disabled={disabled} onClick={event => { captureTrigger(event.currentTarget, seasonFallback); setEditingSeason(season) }}>Изменить сезон</button><button type="button" disabled={disabled} onClick={event => { captureTrigger(event.currentTarget, seasonFallback); setBulkSeason(season) }}>Добавить эпизоды</button><button type="button" disabled={disabled || !season.episodes.length} onClick={event => { captureTrigger(event.currentTarget, seasonFallback); setCompletingSeason(season) }}>Просмотрен весь сезон</button><button type="button" disabled={disabled || !season.episodes.some(episode => episode.watches.length)} onClick={event => { captureTrigger(event.currentTarget, seasonFallback); void viewing.clearSeason(season) }}>Снять просмотры</button></div>
            <div className="show-details-episode-list">{season.episodes.map(episode => {
              const watchedEpisode = episode.watches.length > 0
              const watchLabel = `${watchedEpisode ? 'Добавить повторный просмотр' : 'Отметить просмотр'}: ${episode.title}`
              return <div className="show-details-episode" data-episode-id={episode.id} data-watched={watchedEpisode} key={episode.id}><b>{episode.episodeNumber}</b><button type="button" disabled={disabled} className="show-details-episode-title" onClick={event => { captureTrigger(event.currentTarget, seasonFallback); setEditingEpisode({ season, episode }) }} aria-label={`Изменить эпизод ${episode.episodeNumber}: ${episode.title}`}><strong>{episode.title}</strong><small>{episode.releaseDate ? formatDate(episode.releaseDate) : 'Дата не указана'}{episode.durationMinutes ? ` · ${episode.durationMinutes} мин` : ''}</small></button><span className="show-details-episode-status">{watchedEpisode ? `Просмотрено${episode.watches.length > 1 ? ` ×${episode.watches.length}` : ''}` : 'Не просмотрено'}</span><button type="button" disabled={disabled} className="show-details-mark-episode" title={watchLabel} aria-label={watchLabel} onClick={event => { captureTrigger(event.currentTarget, seasonFallback); void viewing.markEpisode(episode.id) }}>{watchedEpisode ? <Plus aria-hidden="true" /> : <Check aria-hidden="true" />}</button></div>
            })}{!season.episodes.length && <p className="show-details-empty">В этом сезоне пока нет эпизодов.</p>}<button type="button" disabled={disabled} className="show-details-add-episode" onClick={event => { captureTrigger(event.currentTarget, seasonFallback); setEpisodeSeason(season) }}><Plus aria-hidden="true" />Добавить один эпизод</button></div>
          </details>
        })}</div> : <p className="show-details-empty">Сезонов пока нет.</p>}
      </section>
    </>}
    {editing && series && <SeriesForm returnFocusTo={triggerRef.current} series={series} library={library} onClose={() => closeForms()} onSaved={() => closeForms(true)} onDeleted={() => navigate('/series', { replace: true })} />}
    {addingSeason && series && <SeasonForm returnFocusTo={triggerRef.current} series={series} onClose={() => closeForms()} onSaved={() => closeForms(true)} />}
    {editingSeason && series && <SeasonForm returnFocusTo={triggerRef.current} series={series} season={editingSeason} onClose={() => closeForms()} onSaved={() => closeForms(true)} />}
    {episodeSeason && <EpisodeForm returnFocusTo={triggerRef.current} season={episodeSeason} onClose={() => closeForms()} onSaved={() => closeForms(true)} />}
    {editingEpisode && <EpisodeForm returnFocusTo={triggerRef.current} season={editingEpisode.season} episode={editingEpisode.episode} onClose={() => closeForms()} onSaved={() => closeForms(true)} />}
    {bulkSeason && <BulkEpisodeForm returnFocusTo={triggerRef.current} season={bulkSeason} onClose={() => closeForms()} onSaved={() => closeForms(true)} />}
    {completingSeason && <SeasonCompletionForm returnFocusTo={triggerRef.current} season={completingSeason} onClose={() => closeForms()} onSaved={() => closeForms(true)} />}
  </div>
}
