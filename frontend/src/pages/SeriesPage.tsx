import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ChevronDown, FileSpreadsheet, Heart, Plus, RefreshCw, Search, Tv, Upload, X } from 'lucide-react'
import { createKinopoiskSeries, createSeries, deleteSeries, getSeriesCatalog, previewKinopoiskSeries, putSeriesLibrary, removeSeriesLibrary, searchKinopoiskSeries, updateSeries, type KinopoiskSeriesCandidate, type Series, type SeriesFormat, type SeriesInput, type SeriesLibraryEntry } from '../api/series'
import type { LibraryInput, LibraryStatus, ReleaseStatus } from '../api/movies'
import { confirmMyShowsImport, enrichSeriesFromKinopoisk, matchMyShowsWithKinopoisk, previewMyShowsImport, type KinopoiskCandidate, type KinopoiskEnrichmentResult, type KinopoiskMatchPreview, type MyShowsImportChoice, type MyShowsImportPreview, type MyShowsImportResult } from '../api/myShowsImport'
import { getApiErrorMessage } from '../api/client'
import { ErrorState, LoadingState } from '../components/AsyncState'
import { useToast } from '../components/ToastContext'
import { saveLibraryForm } from './libraryForm'
import { useLatestRequest } from '../hooks/useLatestRequest'
import { useFormMutation } from '../hooks/useFormMutation'
import './SeriesPage.css'

const statusLabels: Record<LibraryStatus, string> = { NOT_STARTED: 'Не начато', PLANNED: 'В планах', IN_PROGRESS: 'Смотрю', COMPLETED: 'Просмотрено', PAUSED: 'На паузе', DROPPED: 'Брошено' }
const releaseLabels: Record<ReleaseStatus, string> = { ANNOUNCED: 'Анонсирован', ONGOING: 'Выходит', RELEASED: 'Вышел', ENDED: 'Завершён', CANCELLED: 'Отменён' }
const emptySeries: SeriesInput = { title: '', originalTitle: null, itemType: 'SERIES', format: 'LIVE_ACTION', releaseYear: null, description: null, coverUrl: null, durationMinutes: null, releaseStatus: 'ONGOING', genre: null, developer: null, releaseDate: null, xboxPlayAnywhere: false }
const emptyLibrary: LibraryInput = { status: 'PLANNED', rating: null, favorite: false, startedAt: null, completedAt: null, personalNote: null }
type Progress = { seasonCount: number; episodeCount: number; watchedEpisodeCount: number; watchedMinutes: number }
const formatSeasonCount = (count: number) => {
  const lastTwo = count % 100
  const last = count % 10
  const word = lastTwo >= 11 && lastTwo <= 14 ? 'сезонов' : last === 1 ? 'сезон' : last >= 2 && last <= 4 ? 'сезона' : 'сезонов'
  return `${count} ${word}`
}

export function SeriesPage() {
  const { showToast } = useToast()
  const requests = useLatestRequest()
  const updates = useFormMutation()
  const [series, setSeries] = useState<Series[]>([])
  const [library, setLibrary] = useState<Record<number, SeriesLibraryEntry>>({})
  const [progress, setProgress] = useState<Record<number, Progress>>({})
  const [editing, setEditing] = useState<Series | 'new' | null>(null)
  const [importing, setImporting] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<LibraryStatus | ''>('')
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [catalogUpdate, setCatalogUpdate] = useState<KinopoiskEnrichmentResult | null>(null)
  const [statisticsExpanded, setStatisticsExpanded] = useState(false)
  const pageRef = useRef<HTMLDivElement>(null)
  const addRef = useRef<HTMLButtonElement>(null)
  const importRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const focusTargetRef = useRef<'new' | 'import' | number>('new')
  const focusAfterDialogRef = useRef(false)
  const catalogUpdating = updates.pending

  const load = useCallback(() => requests.run(getSeriesCatalog, {
    onStart: () => { setLoading(true); setError(null) },
    onSuccess: catalog => {
      setSeries(catalog.map(item => ({ ...item, itemType: 'SERIES', xboxPlayAnywhere: false })))
      setLibrary(Object.fromEntries(catalog.filter(item => item.libraryId != null && item.userStatus).map(item => [item.id, {
        id: item.libraryId!, content: { ...item, itemType: 'SERIES', xboxPlayAnywhere: false }, status: item.userStatus!, rating: item.rating,
        favorite: item.favorite, startedAt: item.startedAt, completedAt: item.completedAt, personalNote: item.personalNote,
      }] as const)))
      setProgress(Object.fromEntries(catalog.map(item => [item.id, { seasonCount: item.seasonCount, episodeCount: item.episodeCount, watchedEpisodeCount: item.watchedEpisodeCount, watchedMinutes: item.watchedMinutes }])))
      setInitialized(true)
    },
    onError: reason => setError(getApiErrorMessage(reason, 'Не удалось загрузить сериалы')),
    onFinish: () => setLoading(false),
  }), [requests])
  useEffect(() => { void load(); return () => requests.invalidate() }, [load, requests])
  useEffect(() => {
    if (!focusAfterDialogRef.current || loading || editing || importing) return
    focusAfterDialogRef.current = false
    const target = focusTargetRef.current
    const fallback = target === 'import' ? importRef.current : target === 'new' ? addRef.current : pageRef.current?.querySelector<HTMLAnchorElement>(`[data-series-id="${target}"] h3 a`) ?? addRef.current
    const trigger = triggerRef.current?.isConnected ? triggerRef.current : fallback
    trigger?.focus({ preventScroll: true })
  }, [loading, editing, importing])
  const openForm = (item: Series | 'new', trigger: HTMLButtonElement) => {
    triggerRef.current = trigger
    focusTargetRef.current = item === 'new' ? 'new' : item.id
    setEditing(item)
  }
  const openImport = (trigger: HTMLButtonElement) => { triggerRef.current = trigger; focusTargetRef.current = 'import'; setImporting(true) }
  const finishDialog = (refresh = false) => {
    focusAfterDialogRef.current = true
    setEditing(null)
    setImporting(false)
    if (refresh) void load()
  }
  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('ru-RU')
    return series.filter(item => (!normalized || `${item.title} ${item.originalTitle ?? ''}`.toLocaleLowerCase('ru-RU').includes(normalized)) && (!status || library[item.id]?.status === status))
  }, [library, query, series, status])
  const libraryEntries = Object.values(library)
  const watchedEpisodeCount = Object.values(progress).reduce((sum, item) => sum + item.watchedEpisodeCount, 0)
  const watchedMinutes = Object.values(progress).reduce((sum, item) => sum + item.watchedMinutes, 0)
  const watchTime = `${Math.floor(watchedMinutes / 60)} ч ${watchedMinutes % 60} мин`
  const filtered = Boolean(query.trim() || status)
  const updateKinopoiskCatalog = async () => {
    if (catalogUpdating || loading) return
    setUpdateError(null)
    await updates.run('save', () => enrichSeriesFromKinopoisk(10), {
      onSuccess: result => {
        setCatalogUpdate(result)
        showToast(result.rateLimited ? `Обновлено: ${result.updated}, осталось: ${result.remaining}. Достигнут лимит запросов Кинопоиска` : result.remaining ? `Обновлено: ${result.updated}, осталось: ${result.remaining}` : 'Каталог сериалов обновлён')
        if (result.updated) void load()
      },
      onError: reason => setUpdateError(getApiErrorMessage(reason, 'Не удалось обновить данные из Кинопоиска')),
    })
  }

  return <div ref={pageRef} className="series-library-page">
    <section className="shows-catalog-toolbar" aria-label="Управление каталогом сериалов">
      <div className="shows-catalog-tabs" role="group" aria-label="Статус сериалов">{([
        ['', 'Все'], ['IN_PROGRESS', 'Смотрю'], ['PLANNED', 'В планах'], ['COMPLETED', 'Просмотрено'], ['PAUSED', 'На паузе'], ['DROPPED', 'Брошено'],
      ] as const).map(([value, label]) => <button type="button" key={value || 'all'} aria-pressed={status === value} onClick={() => setStatus(value)}>{label}</button>)}</div>
      <div className="shows-catalog-search"><Search aria-hidden="true" /><input type="search" aria-label="Найти сериал" value={query} onChange={event => setQuery(event.target.value)} placeholder="Найти сериал" /></div>
      <div className="shows-catalog-actions"><button ref={importRef} type="button" className="secondary-button icon-button" onClick={event => openImport(event.currentTarget)}><FileSpreadsheet aria-hidden="true" />Импорт MyShows</button><button ref={addRef} type="button" className="primary-button icon-button" onClick={event => openForm('new', event.currentTarget)}><Plus aria-hidden="true" />Добавить сериал</button></div>
    </section>
    <section className="shows-catalog-layout">
      <div className="shows-catalog-main">
        {updateError && <div className="shows-catalog-notice" role="alert"><strong>Не удалось обновить каталог</strong><span>{updateError}</span><button type="button" className="secondary-button" disabled={catalogUpdating || loading} onClick={() => void updateKinopoiskCatalog()}>Повторить обновление</button></div>}
        {catalogUpdate && <div className="shows-catalog-notice" role="status"><strong>Обновление Кинопоиска</strong><span>{catalogUpdate.remaining ? `Обновлено в этом пакете: ${catalogUpdate.updated}. Осталось сериалов: ${catalogUpdate.remaining}.` : 'Все связанные сериалы обновлены.'}{catalogUpdate.rateLimited ? ' Достигнут лимит запросов Кинопоиска. Продолжите позже.' : ''}</span></div>}
        <div className="shows-catalog-heading"><h2>Каталог</h2><output aria-live="polite" aria-atomic="true">{loading ? 'Загружаем сериалы…' : error ? 'Сериалы не загружены' : `Показано: ${visible.length} из ${series.length}`}</output></div>
        {loading ? <LoadingState message="Загружаем сериалы…" /> : error ? <ErrorState title="Не удалось загрузить сериалы" message={error} onRetry={() => void load()} /> : visible.length === 0 ? <div className="shows-catalog-empty"><Tv aria-hidden="true" /><h2>{filtered ? 'Сериалов не найдено' : 'Каталог пока пуст'}</h2><p>{filtered ? 'Попробуйте изменить поиск или статус.' : 'Добавьте первый сериал или импортируйте данные MyShows.'}</p>{filtered && <button type="button" className="secondary-button" onClick={() => { setQuery(''); setStatus('') }}>Сбросить фильтры</button>}</div> : <section className="shows-catalog-grid" aria-label="Сериалы">{visible.map(item => {
          const entry = library[item.id]
          const data = progress[item.id]
          const watched = data?.watchedEpisodeCount ?? 0
          const total = data?.episodeCount ?? 0
          const percent = total ? Math.min(100, Math.max(0, watched / total * 100)) : 0
          const progressText = total ? `${watched} из ${total} эпизодов` : 'Эпизоды не добавлены'
          return <article className="shows-catalog-card" data-series-id={item.id} key={item.id}>
            <Link className="shows-catalog-cover" to={`/series/${item.id}`} aria-label={`Открыть сериал: ${item.title}`}>
              <span className="shows-catalog-cover-letter" aria-hidden="true">{item.title.slice(0, 1)}</span>
              {item.coverUrl && <img key={item.coverUrl} src={item.coverUrl} alt="" loading="lazy" decoding="async" onError={event => { event.currentTarget.hidden = true }} />}
              {entry?.favorite && <span className="shows-catalog-favorite" role="img" aria-label="В избранном"><Heart aria-hidden="true" /></span>}
              <span className="shows-catalog-release">{releaseLabels[item.releaseStatus]}</span>
            </Link>
            <div className="shows-catalog-copy"><h3><Link to={`/series/${item.id}`}>{item.title}</Link></h3>{item.originalTitle && <p className="shows-catalog-original">{item.originalTitle}</p>}<div className="shows-catalog-meta"><span>{item.releaseYear ?? 'Год неизвестен'}</span><span>{formatSeasonCount(data?.seasonCount ?? 0)}</span></div>{item.genre && <p className="shows-catalog-genre">{item.genre}</p>}<div className="shows-catalog-progress"><span>{progressText}</span><div role="progressbar" aria-label={`Просмотрено эпизодов: ${item.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(percent)} aria-valuetext={total ? `Просмотрено ${watched} из ${total} эпизодов` : progressText}><span style={{ width: `${percent}%` }} /></div></div></div>
            <div className="shows-catalog-personal"><span className={`shows-catalog-status ${entry?.status.toLowerCase() ?? 'not_started'}`}>{entry ? statusLabels[entry.status] : 'Не в библиотеке'}</span>{entry ? <strong className="shows-catalog-rating" data-rated={entry.rating != null} aria-label={entry.rating != null ? `Моя оценка: ${entry.rating} из 10` : 'Без оценки'}>{entry.rating != null ? `${entry.rating}/10` : 'Без оценки'}</strong> : <button type="button" className="shows-catalog-add-library" aria-label={`Добавить в библиотеку: ${item.title}`} onClick={event => openForm(item, event.currentTarget)}><Plus aria-hidden="true" />В библиотеку</button>}</div>
          </article>
        })}</section>}
      </div>
      <aside className="shows-catalog-statistics" aria-label="Общая статистика сериалов"><p className="eyebrow">Весь каталог</p><h2>Сериалы <span>{initialized ? series.length : '—'}</span></h2><button type="button" className="shows-catalog-statistics-toggle" aria-expanded={statisticsExpanded} aria-controls="shows-catalog-statistics-details" onClick={() => setStatisticsExpanded(expanded => !expanded)}>Общая статистика<ChevronDown aria-hidden="true" /></button>
        <div id="shows-catalog-statistics-details" className="shows-catalog-statistics-details" data-expanded={statisticsExpanded}><dl>{([
          ['Количество сериалов', series.length], ['Просмотрено', libraryEntries.filter(item => item.status === 'COMPLETED').length], ['Смотрю', libraryEntries.filter(item => item.status === 'IN_PROGRESS').length], ['В планах', libraryEntries.filter(item => item.status === 'PLANNED').length], ['На паузе', libraryEntries.filter(item => item.status === 'PAUSED').length], ['Брошено', libraryEntries.filter(item => item.status === 'DROPPED').length], ['Просмотрено эпизодов', watchedEpisodeCount], ['Общее время', watchTime],
        ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{initialized ? value : '—'}</dd></div>)}</dl><button type="button" className="secondary-button icon-button shows-catalog-update" disabled={catalogUpdating || loading} onClick={() => void updateKinopoiskCatalog()}><RefreshCw aria-hidden="true" />{catalogUpdating ? 'Обновляем…' : 'Обновить каталог'}</button></div>
      </aside>
    </section>
    {editing && <SeriesForm series={editing === 'new' ? undefined : editing} library={editing === 'new' ? undefined : library[editing.id]} onClose={() => finishDialog()} onSaved={() => finishDialog(true)} />}
    {importing && <MyShowsImportDialog onClose={() => finishDialog()} onImported={() => finishDialog(true)} />}
  </div>
}


function MyShowsImportDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<MyShowsImportPreview | null>(null)
  const [kinopoiskPreview, setKinopoiskPreview] = useState<KinopoiskMatchPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [result, setResult] = useState<MyShowsImportResult | null>(null)
  const [enrichment, setEnrichment] = useState<KinopoiskEnrichmentResult | null>(null)
  const selectFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.name.toLocaleLowerCase().endsWith('.xlsx')) { setError('Выберите XLSX-файл экспорта MyShows.'); return }
    setFile(file); setFileName(file.name); setLoading(true); setError(null); setPreview(null); setKinopoiskPreview(null)
    try { setPreview(await previewMyShowsImport(file)) }
    catch (reason) { setError(getApiErrorMessage(reason, 'Не удалось проверить экспорт MyShows')) }
    finally { setLoading(false) }
  }
  const matchWithKinopoisk = async () => {
    if (!file) return
    setLoading(true); setError(null); setKinopoiskPreview(null)
    try {
      const matched = await matchMyShowsWithKinopoisk(file)
      setKinopoiskPreview(matched)
      setSelections(Object.fromEntries(matched.series.map((item) => [item.title, item.selectedFilmId != null ? String(item.selectedFilmId) : item.candidates.length ? '' : 'BASIC'])))
    }
    catch (reason) { setError(getApiErrorMessage(reason, 'Не удалось сопоставить сериалы с Кинопоиском')) }
    finally { setLoading(false) }
  }
  const candidateFor = (title: string): KinopoiskCandidate | null => {
    const item = kinopoiskPreview?.series.find((entry) => entry.title === title)
    return item?.candidates.find((candidate) => String(candidate.filmId) === selections[title]) ?? null
  }
  const unresolved = kinopoiskPreview?.series.filter((item) => !selections[item.title]).length ?? 0
  const confirmImport = async () => {
    if (!file || !kinopoiskPreview || unresolved) return
    if (!window.confirm('Импортировать выбранные сериалы и историю просмотров? Перед записью backend создаст резервную копию базы.')) return
    const choices: MyShowsImportChoice[] = kinopoiskPreview.series.map((item) => {
      const value = selections[item.title]; const candidate = candidateFor(item.title)
      return { sourceTitle: item.title, action: value === 'SKIP' ? 'SKIP' : 'IMPORT', filmId: candidate?.filmId ?? null, nameRu: candidate?.nameRu ?? null, nameEn: candidate?.nameEn ?? null, year: candidate?.year ?? null }
    })
    setLoading(true); setError(null)
    try { setResult(await confirmMyShowsImport(file, choices)) }
    catch (reason) { setError(getApiErrorMessage(reason, 'Не удалось импортировать данные MyShows')) }
    finally { setLoading(false) }
  }
  const enrichCatalog = async () => {
    setLoading(true); setError(null)
    try { setEnrichment(await enrichSeriesFromKinopoisk(10)) }
    catch (reason) { setError(getApiErrorMessage(reason, 'Не удалось загрузить каталог Кинопоиска')) }
    finally { setLoading(false) }
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="myshows-import-dialog">
      <div className="form-heading"><div><p className="eyebrow">Сериалы</p><h2>Импорт из MyShows</h2></div><button type="button" aria-label="Закрыть" onClick={onClose}><X /></button></div>
      <p className="form-hint">Сначала файл будет проверен. На этапе предварительного просмотра данные в Life Dashboard не изменяются.</p>
      {error && <div className="form-error">{error}</div>}
      <input ref={inputRef} hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void selectFile(event)} />
      <button className="secondary-button icon-button myshows-file-button" disabled={loading} onClick={() => inputRef.current?.click()}><Upload />{loading ? 'Проверяем файл…' : fileName || 'Выбрать XLSX-файл'}</button>
      {preview && <>
        <div className="myshows-preview-summary">
          <div><span>Сериалов</span><strong>{preview.totalSeries}</strong></div>
          <div><span>Просмотров эпизодов</span><strong>{preview.totalEpisodeWatches}</strong></div>
          <div><span>Совпало</span><strong>{preview.matchedSeries}</strong></div>
          <div><span>Новых</span><strong>{preview.newSeries}</strong></div>
          <div><span>Неоднозначных</span><strong>{preview.ambiguousSeries}</strong></div>
        </div>
        <ul className="myshows-warnings">{preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        <div className="myshows-preview-list">{preview.series.slice(0, 20).map((item) => <div key={item.title}><span><strong>{item.title}</strong><small>{item.status} · просмотрено {item.watchedEpisodes ?? 0}</small></span><em className={item.match.toLowerCase()}>{item.match === 'MATCHED' ? 'Совпадение' : item.match === 'NEW' ? 'Новый' : 'Проверить'}</em></div>)}</div>
        {preview.series.length > 20 && <p className="form-hint">Показаны первые 20 из {preview.series.length} сериалов.</p>}
        {!kinopoiskPreview && <div className="myshows-match-action"><p className="form-hint">Следующий шаг отправит названия сериалов в Kinopoisk Unofficial API и найдёт полную структуру сезонов.</p><button className="primary-button icon-button" disabled={loading} onClick={() => void matchWithKinopoisk()}><Search />{loading ? 'Ищем совпадения…' : 'Найти в Кинопоиске'}</button></div>}
        {kinopoiskPreview && !result && <><div className="myshows-preview-summary kinopoisk-summary"><div><span>Всего</span><strong>{kinopoiskPreview.totalSeries}</strong></div><div><span>Найдено точно</span><strong>{kinopoiskPreview.matchedSeries}</strong></div><div><span>Нужно проверить</span><strong>{kinopoiskPreview.reviewRequired}</strong></div><div><span>Не найдено</span><strong>{kinopoiskPreview.notFound}</strong></div></div><div className="myshows-match-list">{kinopoiskPreview.series.map((item) => <label key={item.title}><span><strong>{item.title}</strong><small>{item.status}</small></span><select value={selections[item.title] ?? ''} onChange={(event) => setSelections((current) => ({ ...current, [item.title]: event.target.value }))}><option value="" disabled>Выберите соответствие</option>{item.candidates.map((candidate) => <option key={candidate.filmId} value={candidate.filmId}>{candidate.nameRu || candidate.nameEn || `ID ${candidate.filmId}`} {candidate.year ? `(${candidate.year})` : ''}</option>)}<option value="BASIC">Импортировать без Кинопоиска</option><option value="SKIP">Пропустить</option></select></label>)}</div><div className="myshows-confirm"><span>{unresolved ? `Осталось выбрать: ${unresolved}` : 'Все спорные результаты обработаны'}</span><button className="primary-button" disabled={loading || unresolved > 0} onClick={() => void confirmImport()}>{loading ? 'Импортируем…' : 'Подтвердить импорт'}</button></div></>}
        {result && <div className="notice settings-success"><strong>Импорт завершён</strong><span>Сериалов: {result.importedSeries}, пропущено: {result.skippedSeries}, просмотров эпизодов: {result.importedEpisodeWatches}. Резервная копия создана.</span><span>{enrichment ? `Обновлено из Кинопоиска: ${enrichment.updated}. Осталось: ${enrichment.remaining}.${enrichment.rateLimited ? ' Достигнут лимит API — продолжи позже.' : ''}` : 'Теперь можно загрузить обложки, сведения и полную структуру сезонов пакетами.'}</span><div className="form-buttons"><button className="secondary-button" disabled={loading || enrichment?.remaining === 0} onClick={() => void enrichCatalog()}>{loading ? 'Загружаем…' : enrichment ? 'Продолжить загрузку' : 'Загрузить данные из Кинопоиска'}</button><button className="primary-button" onClick={onImported}>Готово</button></div></div>}
      </>}
    </section>
  </div>
}

export function SeriesForm({ series, library, onClose, onSaved, onDeleted }: { series?: Series; library?: SeriesLibraryEntry; onClose: () => void; onSaved: () => void; onDeleted?: () => void }) {
  const { showToast } = useToast()
  const [item, setItem] = useState<SeriesInput>(series ? { ...series } : emptySeries)
  const [entry, setEntry] = useState<LibraryInput>(library ? { status: library.status, rating: library.rating, favorite: library.favorite, startedAt: library.startedAt, completedAt: library.completedAt, personalNote: library.personalNote } : emptyLibrary)
  const [inLibrary, setInLibrary] = useState(Boolean(library) || !series)
  const [searchQuery, setSearchQuery] = useState('')
  const [candidates, setCandidates] = useState<KinopoiskSeriesCandidate[]>([])
  const [selectedFilmId, setSelectedFilmId] = useState<number | null>(null)
  const [catalogSummary, setCatalogSummary] = useState<{ seasons: number; episodes: number } | null>(null)
  const [searching, setSearching] = useState(false)
  const mutations = useFormMutation()
  const { saving, deleting, pending } = mutations
  const [error, setError] = useState<string | null>(null)
  const catalogRequests = useLatestRequest()
  const cancelCatalog = () => { catalogRequests.invalidate(); setSearching(false); setCandidates([]) }
  const changeSearchQuery = (value: string) => { cancelCatalog(); setSearchQuery(value) }
  const closeForm = () => { mutations.dispose(); catalogRequests.dispose(); onClose() }
  const setItemValue = <K extends keyof SeriesInput>(key: K, value: SeriesInput[K]) => { cancelCatalog(); setItem((current) => ({ ...current, [key]: value })) }
  const setEntryValue = <K extends keyof LibraryInput>(key: K, value: LibraryInput[K]) => setEntry((current) => ({ ...current, [key]: value }))
  const searchCatalog = async () => {
    const value = searchQuery.trim()
    if (value.length < 2) return
    await catalogRequests.run(() => searchKinopoiskSeries(value), {
      onStart: () => { setSearching(true); setError(null); setCandidates([]) },
      onSuccess: setCandidates,
      onError: (reason) => setError(getApiErrorMessage(reason, 'Не удалось выполнить поиск в Кинопоиске')),
      onFinish: () => setSearching(false),
    })
  }
  const selectCandidate = async (candidate: KinopoiskSeriesCandidate) => {
    if (candidate.existingContentId) return
    await catalogRequests.run(() => previewKinopoiskSeries(candidate.filmId), {
      onStart: () => { setSearching(true); setError(null) },
      onSuccess: (details) => {
        setSelectedFilmId(details.filmId)
        setCatalogSummary({ seasons: details.seasonCount, episodes: details.episodeCount })
        setItem({ ...emptySeries, title: details.title, originalTitle: details.originalTitle, releaseYear: details.releaseYear, description: details.description, coverUrl: details.coverUrl, releaseStatus: details.releaseStatus, genre: details.genre })
        setCandidates([])
      },
      onError: (reason) => setError(getApiErrorMessage(reason, 'Не удалось загрузить данные сериала')),
      onFinish: () => setSearching(false),
    })
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (pending || searching) return
    setError(null)
    await mutations.run('save', () => saveLibraryForm({
      title: series?.title ?? item.title, inLibrary, wasInLibrary: Boolean(library),
      saveItem: () => series ? updateSeries(series.id, item) : selectedFilmId ? createKinopoiskSeries(selectedFilmId, item) : createSeries(item),
      putLibrary: (id) => putSeriesLibrary(id, entry), removeLibrary: removeSeriesLibrary,
    }), {
      onSuccess: (saved) => {
        if (!saved) return
        showToast(series ? 'Сериал обновлён' : 'Сериал добавлен'); onSaved()
      },
      onError: (reason) => setError(getApiErrorMessage(reason, 'Не удалось сохранить сериал')),
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
      onSuccess: (deleted) => { if (deleted) { showToast('Сериал удалён'); (onDeleted ?? onSaved)() } },
      onError: (reason) => setError(reason instanceof Error ? reason.message : 'Не удалось удалить сериал'),
    })
  }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm() }}><form className="habit-form movie-form" onSubmit={(event) => void submit(event)}><div className="form-heading"><div><p className="eyebrow">Сериалы</p><h2>{series ? 'Редактирование' : 'Новый сериал'}</h2></div><button type="button" onClick={closeForm}>×</button></div>{error && <div className="form-error">{error}</div>}{!series && <section className="kinopoisk-movie-search"><div><input value={searchQuery} onChange={(event) => changeSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void searchCatalog() } }} placeholder="Введите название сериала" /><button className="secondary-button" type="button" disabled={searching || searchQuery.trim().length < 2} onClick={() => void searchCatalog()}>{searching ? 'Ищем…' : 'Найти в Кинопоиске'}</button></div>{selectedFilmId && <p>Данные и структура загружены: {catalogSummary?.seasons ?? 0} сезонов, {catalogSummary?.episodes ?? 0} эпизодов. Проверьте поля и укажите личный статус.</p>}{candidates.length > 0 && <div className="kinopoisk-movie-results">{candidates.map((candidate) => <button type="button" key={candidate.filmId} disabled={Boolean(candidate.existingContentId)} onClick={() => void selectCandidate(candidate)}><span>▤</span><span><strong>{candidate.nameRu || candidate.nameOriginal || `Сериал ${candidate.filmId}`}</strong><small>{candidate.nameOriginal && candidate.nameOriginal !== candidate.nameRu ? `${candidate.nameOriginal} · ` : ''}{candidate.year ?? 'Год неизвестен'}{candidate.existingContentId ? ' · Уже в каталоге' : ''}</small></span></button>)}</div>}</section>}<label>Название<input required value={item.title} onChange={(event) => setItemValue('title', event.target.value)} /></label><label>Оригинальное название<input value={item.originalTitle ?? ''} onChange={(event) => setItemValue('originalTitle', event.target.value || null)} /></label><div className="form-grid"><label>Формат<select value={item.format} onChange={(event) => setItemValue('format', event.target.value as SeriesFormat)}><option value="LIVE_ACTION">Сериал</option><option value="ANIMATION">Мультсериал</option></select></label><label>Статус выпуска<select value={item.releaseStatus} onChange={(event) => setItemValue('releaseStatus', event.target.value as ReleaseStatus)}>{Object.entries(releaseLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Год<input min="1900" type="number" value={item.releaseYear ?? ''} onChange={(event) => setItemValue('releaseYear', event.target.value ? Number(event.target.value) : null)} /></label><label>Жанр<input maxLength={100} value={item.genre ?? ''} onChange={(event) => setItemValue('genre', event.target.value || null)} /></label><label>Обложка<input type="url" value={item.coverUrl ?? ''} onChange={(event) => setItemValue('coverUrl', event.target.value || null)} /></label></div><label>Описание<textarea rows={3} value={item.description ?? ''} onChange={(event) => setItemValue('description', event.target.value || null)} /></label><fieldset className="library-fields"><legend>Моя библиотека</legend><label className="all-day-check"><input type="checkbox" checked={inLibrary} onChange={(event) => setInLibrary(event.target.checked)} />Добавить в библиотеку</label>{inLibrary && <><div className="form-grid"><label>Статус<select value={entry.status} onChange={(event) => setEntryValue('status', event.target.value as LibraryStatus)}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Оценка<select value={entry.rating ?? ''} onChange={(event) => setEntryValue('rating', event.target.value ? Number(event.target.value) : null)}><option value="">Без оценки</option>{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <option key={value}>{value}</option>)}</select></label></div><label className="favorite-check"><input type="checkbox" checked={entry.favorite} onChange={(event) => setEntryValue('favorite', event.target.checked)} />В избранном</label><label>Заметка<textarea rows={2} value={entry.personalNote ?? ''} onChange={(event) => setEntryValue('personalNote', event.target.value || null)} /></label></>}</fieldset><div className="form-buttons">{series && <button className="danger-button" type="button" disabled={pending || searching} onClick={() => void remove()}>{deleting ? 'Удаляем…' : 'Удалить'}</button>}<button className="secondary-button" type="button" onClick={closeForm}>Отмена</button><button className="primary-button" disabled={pending || searching}>{saving ? 'Сохраняем…' : 'Сохранить'}</button></div></form></div>
}
