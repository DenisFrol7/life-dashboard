import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ChevronDown, FileSpreadsheet, Heart, Plus, RefreshCw, Search, Tv } from 'lucide-react'
import { getSeriesCatalog, type Series, type SeriesLibraryEntry } from '../api/series'
import type { LibraryStatus, ReleaseStatus } from '../api/movies'
import { enrichSeriesFromKinopoisk, type KinopoiskEnrichmentResult } from '../api/myShowsImport'
import { getApiErrorMessage } from '../api/client'
import { ErrorState, LoadingState } from '../components/AsyncState'
import { useToast } from '../components/ToastContext'
import { useLatestRequest } from '../hooks/useLatestRequest'
import { useFormMutation } from '../hooks/useFormMutation'
import { SeriesForm } from '../components/SeriesForm'
import { MyShowsImportDialog } from '../components/MyShowsImportDialog'
import './SeriesPage.css'

const statusLabels: Record<LibraryStatus, string> = { NOT_STARTED: 'Не начато', PLANNED: 'В планах', IN_PROGRESS: 'Смотрю', COMPLETED: 'Просмотрено', PAUSED: 'На паузе', DROPPED: 'Брошено' }
const releaseLabels: Record<ReleaseStatus, string> = { ANNOUNCED: 'Анонсирован', ONGOING: 'Выходит', RELEASED: 'Вышел', ENDED: 'Завершён', CANCELLED: 'Отменён' }
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
    {editing && <SeriesForm returnFocusTo={triggerRef.current} series={editing === 'new' ? undefined : editing} library={editing === 'new' ? undefined : library[editing.id]} onClose={() => finishDialog()} onSaved={() => finishDialog(true)} />}
    {importing && <MyShowsImportDialog returnFocusTo={importRef.current} onClose={() => finishDialog()} onChanged={() => { void load() }} />}
  </div>
}
