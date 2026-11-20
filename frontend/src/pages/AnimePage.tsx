import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router'
import { ChevronDown, Heart, Plus, Search, Tv, Upload, X } from 'lucide-react'
import { getAnime, getAnimeDetails, importShikimori, previewShikimoriImport, type AnimeDetails, type AnimeSummary, type ShikimoriImportPreview, type ShikimoriImportResult } from '../api/anime'
import type { LibraryStatus, ReleaseStatus } from '../api/movies'
import { getApiErrorMessage } from '../api/client'
import { ErrorState, LoadingState } from '../components/AsyncState'
import { useLatestRequest } from '../hooks/useLatestRequest'
import { AnimeForm } from '../components/AnimeForm'
import './AnimePage.css'

const statusLabels: Record<LibraryStatus, string> = { NOT_STARTED: 'Не начато', PLANNED: 'В планах', IN_PROGRESS: 'Смотрю', COMPLETED: 'Просмотрено', PAUSED: 'На паузе', DROPPED: 'Брошено' }
const releaseLabels: Record<ReleaseStatus, string> = { ANNOUNCED: 'Анонсировано', ONGOING: 'Выходит', RELEASED: 'Вышло', ENDED: 'Завершено', CANCELLED: 'Отменено' }
const formatSeasonCount = (count: number) => {
  const lastTwo = count % 100, last = count % 10
  return `${count} ${lastTwo >= 11 && lastTwo <= 14 ? 'сезонов' : last === 1 ? 'сезон' : last >= 2 && last <= 4 ? 'сезона' : 'сезонов'}`
}

export function AnimePage() {
  const requests = useLatestRequest()
  const editRequests = useLatestRequest()
  const [anime, setAnime] = useState<AnimeSummary[]>([])
  const [editing, setEditing] = useState<AnimeDetails | 'new' | null>(null)
  const [importing, setImporting] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<LibraryStatus | ''>('')
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<number | null>(null)
  const [openError, setOpenError] = useState<{ id: number; message: string } | null>(null)
  const [statisticsExpanded, setStatisticsExpanded] = useState(false)
  const pageRef = useRef<HTMLDivElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const importRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const focusTargetRef = useRef<'new' | 'import' | number>('new')
  const focusAfterDialogRef = useRef(false)
  const openingIdRef = useRef<number | null>(null)
  const openErrorRef = useRef<HTMLDivElement>(null)

  const load = useCallback(() => requests.run(getAnime, {
    onStart: () => { setLoading(true); setError(null) },
    onSuccess: items => { setAnime(items); setInitialized(true) },
    onError: reason => setError(getApiErrorMessage(reason, 'Не удалось загрузить аниме')),
    onFinish: () => setLoading(false),
  }), [requests])
  useEffect(() => { void load(); return () => requests.invalidate() }, [load, requests])
  useEffect(() => {
    if (!focusAfterDialogRef.current || loading || editing || importing) return
    focusAfterDialogRef.current = false
    const target = focusTargetRef.current
    const fallback = target === 'import' ? importRef.current : target === 'new' ? addRef.current : pageRef.current?.querySelector<HTMLAnchorElement>(`[data-anime-id="${target}"] h3 a`) ?? addRef.current
    const trigger = triggerRef.current?.isConnected ? triggerRef.current : fallback
    trigger?.focus({ preventScroll: true })
  }, [loading, editing, importing])
  useEffect(() => {
    if (openError) { openErrorRef.current?.scrollIntoView({ block: 'nearest' }); openErrorRef.current?.focus({ preventScroll: true }) }
  }, [openError])
  const cancelOpening = () => {
    editRequests.invalidate()
    openingIdRef.current = null
    setOpeningId(null)
    setOpenError(null)
  }
  const captureTrigger = (trigger: HTMLButtonElement, target: 'new' | 'import' | number) => { triggerRef.current = trigger; focusTargetRef.current = target }
  const openNew = (trigger: HTMLButtonElement) => { cancelOpening(); captureTrigger(trigger, 'new'); setEditing('new') }
  const openImport = (trigger: HTMLButtonElement) => { cancelOpening(); captureTrigger(trigger, 'import'); setImporting(true) }
  const openEdit = async (item: AnimeSummary, trigger: HTMLButtonElement) => {
    if (editing || importing || openingIdRef.current === item.id) return
    captureTrigger(trigger, item.id)
    await editRequests.run(() => getAnimeDetails(item.id), {
      onStart: () => { openingIdRef.current = item.id; setOpeningId(item.id); setOpenError(null) },
      onSuccess: setEditing,
      onError: reason => setOpenError({ id: item.id, message: getApiErrorMessage(reason, 'Не удалось открыть аниме') }),
      onFinish: () => { openingIdRef.current = null; setOpeningId(null) },
    })
  }
  const finishDialog = (refresh = false) => {
    cancelOpening()
    focusAfterDialogRef.current = true
    setEditing(null); setImporting(false)
    if (refresh) void load()
  }
  const changeFilters = (nextQuery: string, nextStatus: LibraryStatus | '') => {
    if (nextQuery === query && nextStatus === status) return
    cancelOpening()
    setQuery(nextQuery); setStatus(nextStatus)
  }
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru-RU')
    return anime.filter(item => (!normalized || `${item.title} ${item.originalTitle ?? ''}`.toLocaleLowerCase('ru-RU').includes(normalized)) && (!status || item.userStatus === status))
  }, [anime, query, status])
  const watchedEpisodeCount = anime.reduce((sum, item) => sum + (item.watchedEpisodeCount ?? 0), 0)
  const watchedMinutes = anime.reduce((sum, item) => sum + (item.watchedMinutes ?? 0), 0)
  const watchTime = `${Math.floor(watchedMinutes / 60)} ч ${watchedMinutes % 60} мин`
  const filtered = Boolean(query.trim() || status)

  return <div ref={pageRef} className="anime-library-page">
    <section className="anime-catalog-toolbar" aria-label="Управление каталогом аниме">
      <div className="anime-catalog-tabs" role="group" aria-label="Статус аниме">{([['', 'Все'], ['IN_PROGRESS', 'Смотрю'], ['PLANNED', 'В планах'], ['COMPLETED', 'Просмотрено'], ['PAUSED', 'На паузе'], ['DROPPED', 'Брошено']] as const).map(([value, label]) => <button type="button" key={value || 'all'} aria-pressed={status === value} onClick={() => changeFilters(query, value)}>{label}</button>)}</div>
      <div className="anime-catalog-search"><Search aria-hidden="true" /><input type="search" aria-label="Найти аниме" value={query} onChange={event => changeFilters(event.target.value, status)} placeholder="Найти аниме" /></div>
      <div className="anime-catalog-actions"><button ref={importRef} type="button" className="secondary-button icon-button" onClick={event => openImport(event.currentTarget)}><Upload aria-hidden="true" />Импорт Shikimori</button><button ref={addRef} type="button" className="primary-button icon-button" onClick={event => openNew(event.currentTarget)}><Plus aria-hidden="true" />Добавить аниме</button></div>
    </section>
    <section className="anime-catalog-layout">
      <div className="anime-catalog-main">
        {openError && <div ref={openErrorRef} className="anime-catalog-notice" tabIndex={-1} role="alert"><strong>Не удалось открыть аниме</strong><span>{openError.message}</span><button type="button" className="secondary-button" onClick={event => { const item = anime.find(entry => entry.id === openError.id); if (item) void openEdit(item, event.currentTarget) }}>Повторить открытие</button></div>}
        {openingId != null && <p className="anime-catalog-notice" role="status">Открываем сведения об аниме…</p>}
        <div className="anime-catalog-heading"><h2>Каталог</h2><output aria-live="polite" aria-atomic="true">{loading ? 'Загружаем аниме…' : error ? 'Аниме не загружено' : `Показано: ${visible.length} из ${anime.length}`}</output></div>
        {loading ? <LoadingState message="Загружаем аниме…" /> : error ? <ErrorState title="Не удалось загрузить аниме" message={error} onRetry={() => void load()} /> : visible.length === 0 ? <div className="anime-catalog-empty"><Tv aria-hidden="true" /><h2>{filtered ? 'Аниме не найдено' : 'Каталог пока пуст'}</h2><p>{filtered ? 'Попробуйте изменить поиск или статус.' : 'Добавьте первый многосерийный тайтл или импортируйте данные Shikimori.'}</p>{filtered && <button type="button" className="secondary-button" onClick={() => changeFilters('', '')}>Сбросить фильтры</button>}</div> : <section className="anime-catalog-grid" aria-label="Аниме">{visible.map(item => {
          const watched = item.watchedEpisodeCount ?? 0, total = item.episodeCount ?? 0
          const percent = total ? Math.min(100, Math.max(0, watched / total * 100)) : 0
          const progressText = total ? `${watched} из ${total} эпизодов` : 'Эпизоды не добавлены'
          return <article className="anime-catalog-card" data-anime-id={item.id} key={item.id}>
            <Link className="anime-catalog-cover" to={`/anime/${item.id}`} aria-label={`Открыть аниме: ${item.title}`}><span className="anime-catalog-cover-letter" aria-hidden="true">{item.title.slice(0, 1)}</span>{item.coverUrl && <img key={item.coverUrl} src={item.coverUrl} alt="" loading="lazy" decoding="async" onError={event => { event.currentTarget.hidden = true }} />}{item.favorite && <span className="anime-catalog-favorite" role="img" aria-label="В избранном"><Heart aria-hidden="true" /></span>}<span className="anime-catalog-release">{releaseLabels[item.releaseStatus]}</span></Link>
            <div className="anime-catalog-copy"><h3><Link to={`/anime/${item.id}`}>{item.title}</Link></h3>{item.originalTitle && <p className="anime-catalog-original">{item.originalTitle}</p>}<div className="anime-catalog-meta"><span>{item.releaseYear ?? 'Год неизвестен'}</span><span>{formatSeasonCount(item.seasonCount ?? 0)}</span></div><div className="anime-catalog-progress"><span>{progressText}</span><div role="progressbar" aria-label={`Просмотрено эпизодов: ${item.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} aria-valuetext={total ? `Просмотрено ${watched} из ${total} эпизодов` : progressText}><span style={{ width: `${percent}%` }} /></div></div></div>
            <div className="anime-catalog-personal"><span className={`anime-catalog-status ${item.userStatus?.toLowerCase() ?? 'not_started'}`}>{item.userStatus ? statusLabels[item.userStatus] : 'Не в библиотеке'}</span>{item.userStatus ? <strong className="anime-catalog-rating" data-rated={item.rating != null} aria-label={item.rating != null ? `Моя оценка: ${item.rating} из 10` : 'Без оценки'}>{item.rating != null ? `${item.rating}/10` : 'Без оценки'}</strong> : <button type="button" className="anime-catalog-add-library" disabled={openingId === item.id} aria-busy={openingId === item.id} aria-label={`Добавить в библиотеку: ${item.title}`} onClick={event => void openEdit(item, event.currentTarget)}><Plus aria-hidden="true" />{openingId === item.id ? 'Загружаем…' : 'В библиотеку'}</button>}</div>
          </article>
        })}</section>}
      </div>
      <aside className="anime-catalog-statistics" aria-label="Общая статистика аниме"><p className="eyebrow">Весь каталог</p><h2>Аниме <span>{initialized ? anime.length : '—'}</span></h2><button type="button" className="anime-catalog-statistics-toggle" aria-expanded={statisticsExpanded} aria-controls="anime-catalog-statistics-details" onClick={() => setStatisticsExpanded(expanded => !expanded)}>Общая статистика<ChevronDown aria-hidden="true" /></button>
        <div id="anime-catalog-statistics-details" className="anime-catalog-statistics-details" data-expanded={statisticsExpanded}><dl>{([
          ['Количество аниме', anime.length], ['Просмотрено', anime.filter(item => item.userStatus === 'COMPLETED').length], ['Смотрю', anime.filter(item => item.userStatus === 'IN_PROGRESS').length], ['В планах', anime.filter(item => item.userStatus === 'PLANNED').length], ['На паузе', anime.filter(item => item.userStatus === 'PAUSED').length], ['Брошено', anime.filter(item => item.userStatus === 'DROPPED').length], ['Просмотрено эпизодов', watchedEpisodeCount], ['Общее время', watchTime],
        ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{initialized ? value : '—'}</dd></div>)}</dl></div>
      </aside>
    </section>
    {editing && <AnimeForm returnFocusTo={triggerRef.current} anime={editing === 'new' ? undefined : editing} onClose={() => finishDialog()} onSaved={() => finishDialog(true)} />}
    {importing && <ShikimoriImportDialog onClose={() => finishDialog()} onImported={() => finishDialog(true)} />}
  </div>
}


function ShikimoriImportDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<ShikimoriImportPreview | null>(null)
  const [result, setResult] = useState<ShikimoriImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; event.target.value = ''; if (!file) return; if (!file.name.toLowerCase().endsWith('.json')) { setError('Выберите JSON-файл экспорта Shikimori.'); return } setFileName(file.name); setLoading(true); setError(null); setResult(null); try { setPreview(await previewShikimoriImport(file)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось проверить экспорт Shikimori') } finally { setLoading(false) } }
  const confirm = async () => { if (!preview || !window.confirm(`Импортировать ${preview.total} записей? Перед изменением данных будет создана резервная копия.`)) return; setLoading(true); setError(null); try { setResult(await importShikimori(preview.token)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось импортировать Shikimori') } finally { setLoading(false) } }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="myshows-import-dialog"><div className="form-heading"><div><p className="eyebrow">Аниме</p><h2>Импорт из Shikimori</h2></div><button type="button" aria-label="Закрыть" onClick={onClose}><X /></button></div><p className="form-hint">Сначала файл будет проверен без изменения базы. При подтверждении сведения о тайтлах загрузятся из Shikimori API.</p>{error && <div className="form-error">{error}</div>}<input ref={inputRef} hidden type="file" accept=".json,application/json" onChange={(event) => void selectFile(event)} /><button className="secondary-button icon-button myshows-file-button" disabled={loading} onClick={() => inputRef.current?.click()}><Upload />{loading ? 'Обрабатываем…' : fileName || 'Выбрать JSON-файл'}</button>{preview && !result && <><div className="myshows-preview-summary"><div><span>Всего</span><strong>{preview.total}</strong></div><div><span>Просмотрено</span><strong>{preview.completed}</strong></div><div><span>Смотрю</span><strong>{preview.watching}</strong></div><div><span>В планах</span><strong>{preview.planned}</strong></div><div><span>Уже в каталоге</span><strong>{preview.existing}</strong></div></div><ul className="myshows-warnings">{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul><div className="myshows-preview-list">{preview.items.map((item) => <div key={item.shikimoriId}><span><strong>{item.title}</strong><small>{item.originalTitle} · эпизодов просмотрено: {item.watchedEpisodes}</small></span><em className={item.existingContentId ? 'matched' : 'new'}>{item.existingContentId ? 'Проверить' : item.score ? `${item.score}/10` : 'Добавить'}</em></div>)}</div><div className="myshows-confirm"><span>Данные проверены</span><button className="primary-button" disabled={loading} onClick={() => void confirm()}>{loading ? 'Загружаем каталог…' : `Импортировать ${preview.total}`}</button></div></>}{result && <div className="notice settings-success"><strong>Импорт завершён</strong><span>Добавлено аниме: {result.animeCreated}, фильмов: {result.moviesCreated}, обновлено: {result.updated}, пропущено фильмов Кинопоиска: {result.skipped}, отметок эпизодов: {result.episodeWatches}.</span><span>Резервная копия создана.</span><div className="form-buttons"><button className="primary-button" onClick={onImported}>Готово</button></div></div>}</section></div>
}
