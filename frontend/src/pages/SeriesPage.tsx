import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { FileSpreadsheet, Plus, RefreshCw, Search, Upload, X } from 'lucide-react'
import { createSeries, deleteSeries, getSeriesCatalog, putSeriesLibrary, updateSeries, type Series, type SeriesFormat, type SeriesInput, type SeriesLibraryEntry } from '../api/series'
import type { LibraryInput, LibraryStatus, ReleaseStatus } from '../api/movies'
import { confirmMyShowsImport, enrichSeriesFromKinopoisk, matchMyShowsWithKinopoisk, previewMyShowsImport, type KinopoiskCandidate, type KinopoiskEnrichmentResult, type KinopoiskMatchPreview, type MyShowsImportChoice, type MyShowsImportPreview, type MyShowsImportResult } from '../api/myShowsImport'
import { getApiErrorMessage } from '../api/client'
import { ErrorState, LoadingState } from '../components/AsyncState'
import { useToast } from '../components/ToastContext'

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
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [series, setSeries] = useState<Series[]>([])
  const [library, setLibrary] = useState<Record<number, SeriesLibraryEntry>>({})
  const [progress, setProgress] = useState<Record<number, Progress>>({})
  const [editing, setEditing] = useState<Series | 'new' | null>(null)
  const [importing, setImporting] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<LibraryStatus | ''>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [catalogUpdating, setCatalogUpdating] = useState(false)
  const [catalogUpdate, setCatalogUpdate] = useState<KinopoiskEnrichmentResult | null>(null)

  const load = useCallback(async () => { setLoading(true); setError(null); try { const catalog = await getSeriesCatalog(); const items: Series[] = catalog.map((item) => ({ ...item, itemType: 'SERIES', xboxPlayAnywhere: false })); setSeries(items); setLibrary(Object.fromEntries(catalog.filter((item) => item.libraryId && item.userStatus).map((item) => [item.id, { id: item.libraryId!, content: { ...item, itemType: 'SERIES', xboxPlayAnywhere: false }, status: item.userStatus!, rating: item.rating, favorite: item.favorite, startedAt: item.startedAt, completedAt: item.completedAt, personalNote: item.personalNote }] as const))); setProgress(Object.fromEntries(catalog.map((item) => [item.id, { seasonCount: item.seasonCount, episodeCount: item.episodeCount, watchedEpisodeCount: item.watchedEpisodeCount, watchedMinutes: item.watchedMinutes }]))) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось загрузить сериалы') } finally { setLoading(false) } }, [])
  useEffect(() => { void load() }, [load])
  const visible = useMemo(() => { const normalized = query.trim().toLocaleLowerCase('ru-RU'); return series.filter((item) => (!normalized || `${item.title} ${item.originalTitle ?? ''}`.toLocaleLowerCase('ru-RU').includes(normalized)) && (!status || library[item.id]?.status === status)) }, [library, query, series, status])
  const libraryEntries = Object.values(library)
  const watchedEpisodeCount = Object.values(progress).reduce((sum, item) => sum + item.watchedEpisodeCount, 0)
  const watchedMinutes = Object.values(progress).reduce((sum, item) => sum + item.watchedMinutes, 0)
  const watchTime = `${Math.floor(watchedMinutes / 60)} ч ${watchedMinutes % 60} мин`
  const updateKinopoiskCatalog = async () => {
    setCatalogUpdating(true); setError(null)
    try {
      const result = await enrichSeriesFromKinopoisk(10)
      setCatalogUpdate(result)
      showToast(result.rateLimited ? 'Дневная квота Кинопоиска исчерпана' : result.remaining ? `Обновлено: ${result.updated}, осталось: ${result.remaining}` : 'Каталог сериалов обновлён')
      if (result.updated) await load()
    } catch (reason) { setError(getApiErrorMessage(reason, 'Не удалось обновить данные из Кинопоиска')) }
    finally { setCatalogUpdating(false) }
  }
  if (loading) return <LoadingState message="Загружаем сериалы…" />
  if (error) return <ErrorState title="Не удалось загрузить сериалы" message={error} onRetry={() => void load()} />
  return <div className="movies-page series-page series-catalog-page"><section className="media-toolbar series-media-toolbar"><div className="series-status-tabs" aria-label="Фильтр сериалов по статусу">{([
      ['', 'Все'],
      ['IN_PROGRESS', 'Смотрю'],
      ['PLANNED', 'В планах'],
      ['COMPLETED', 'Просмотрено'],
      ['PAUSED', 'На паузе'],
      ['DROPPED', 'Брошено'],
    ] as const).map(([value, label]) => <button key={value || 'all'} className={status === value ? 'active' : ''} onClick={() => setStatus(value)}>{label}</button>)}</div><div className="journal-search series-search"><span><Search /></span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти сериал" /></div><button className="secondary-button icon-button series-import-button" disabled={catalogUpdating} onClick={() => void updateKinopoiskCatalog()}><RefreshCw />{catalogUpdating ? 'Обновляем…' : 'Обновить из Кинопоиска'}</button><button className="secondary-button icon-button series-import-button" onClick={() => setImporting(true)}><FileSpreadsheet />Импорт MyShows</button><button className="primary-button series-add-button media-add-button icon-button" onClick={() => setEditing('new')}><Plus />Добавить сериал</button></section>
    <section className="series-catalog-layout"><div className="series-catalog-main">
    {error && <div className="notice error movies-error"><strong>Ошибка</strong><span>{error}</span></div>}
    {catalogUpdate && <div className="notice"><strong>Обновление Кинопоиска</strong><span>{catalogUpdate.rateLimited ? 'Дневная квота закончилась. Продолжите после её сброса.' : catalogUpdate.remaining ? `Обновлено в этом пакете: ${catalogUpdate.updated}. Осталось сериалов: ${catalogUpdate.remaining}.` : 'Все связанные сериалы обновлены.'}</span></div>}
    {loading ? <div className="loading"><span />Загружаем сериалы…</div> : visible.length === 0 ? <div className="media-empty"><span>▤</span><h2>Сериалов пока нет</h2><p>Добавьте первый сериал в каталог.</p></div> : <section className="movie-grid series-catalog-grid">{visible.map((item) => {
      const entry = library[item.id]
      const data = progress[item.id]
      const watched = data?.watchedEpisodeCount ?? 0
      const total = data?.episodeCount ?? 0
      const percent = total ? watched / total * 100 : 0
      return <article className="series-list-card" key={item.id}>
        <button className="series-list-cover" onClick={() => navigate(`/series/${item.id}`)} style={item.coverUrl ? { backgroundImage: `url(${item.coverUrl})` } : undefined}><span>{item.title.slice(0, 1)}</span>{entry?.favorite && <i>♥</i>}</button>
        <div className="series-list-content">
          <div className="series-list-heading"><button onClick={() => navigate(`/series/${item.id}`)}>{item.title}</button><span className={`release-badge ${item.releaseStatus.toLowerCase()}`}>{releaseLabels[item.releaseStatus]}</span></div>
          {item.originalTitle && <p>{item.originalTitle}</p>}
          <div className="movie-list-meta"><span>{item.releaseYear ?? '—'}</span>{item.genre && <span>{item.genre}</span>}<span>{formatSeasonCount(data?.seasonCount ?? 0)}</span></div>
          <div className="series-list-inline-status">{entry ? <span className={`media-status ${entry.status.toLowerCase()}`}>{statusLabels[entry.status]}</span> : <span className="media-status not_started">Не в библиотеке</span>}</div>
          <div className="series-list-progress-row"><strong>{watched} <small>из {total}</small></strong><div className="series-list-progress"><span style={{ width: `${percent}%` }} /></div></div>
        </div>
        <div className="series-list-side">{entry ? <strong className="series-list-score">{entry.rating ? `${entry.rating}/10` : 'Без оценки'}</strong> : <button className="add-library-button" onClick={() => setEditing(item)}>+ В библиотеку</button>}</div>
      </article>
    })}</section>}
    </div><aside className="series-statistics"><p className="eyebrow">Общая статистика</p><h2>Сериалы</h2><dl>
      <div><dt>Количество сериалов</dt><dd>{series.length}</dd></div>
      <div><dt>Просмотрено</dt><dd>{libraryEntries.filter((item) => item.status === 'COMPLETED').length}</dd></div>
      <div><dt>Смотрю</dt><dd>{libraryEntries.filter((item) => item.status === 'IN_PROGRESS').length}</dd></div>
      <div><dt>В планах</dt><dd>{libraryEntries.filter((item) => item.status === 'PLANNED').length}</dd></div>
      <div><dt>На паузе</dt><dd>{libraryEntries.filter((item) => item.status === 'PAUSED').length}</dd></div>
      <div><dt>Брошено</dt><dd>{libraryEntries.filter((item) => item.status === 'DROPPED').length}</dd></div>
      <div className="series-stat-total"><dt>Просмотрено эпизодов</dt><dd>{watchedEpisodeCount}</dd></div>
      <div><dt>Общее время</dt><dd>{watchTime}</dd></div>
    </dl></aside></section>
    {editing && <SeriesForm series={editing === 'new' ? undefined : editing} library={editing === 'new' ? undefined : library[editing.id]} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void load() }} />}
    {importing && <MyShowsImportDialog onClose={() => setImporting(false)} onImported={() => { setImporting(false); void load() }} />}
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

export function SeriesForm({ series, library, onClose, onSaved }: { series?: Series; library?: SeriesLibraryEntry; onClose: () => void; onSaved: () => void }) {
  const { showToast } = useToast()
  const [item, setItem] = useState<SeriesInput>(series ? { ...series } : emptySeries)
  const [entry, setEntry] = useState<LibraryInput>(library ? { status: library.status, rating: library.rating, favorite: library.favorite, startedAt: library.startedAt, completedAt: library.completedAt, personalNote: library.personalNote } : emptyLibrary)
  const [inLibrary, setInLibrary] = useState(Boolean(library) || !series)
  const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null)
  const setItemValue = <K extends keyof SeriesInput>(key: K, value: SeriesInput[K]) => setItem((current) => ({ ...current, [key]: value }))
  const setEntryValue = <K extends keyof LibraryInput>(key: K, value: LibraryInput[K]) => setEntry((current) => ({ ...current, [key]: value }))
  const submit = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setError(null); try { const saved = series ? await updateSeries(series.id, item) : await createSeries(item); if (inLibrary) await putSeriesLibrary(saved.id, entry); showToast(series ? 'Сериал обновлён' : 'Сериал добавлен'); onSaved() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось сохранить сериал') } finally { setSaving(false) } }
  const remove = async () => { if (!series || !window.confirm(`Удалить «${series.title}» вместе с сезонами и историей?`)) return; try { await deleteSeries(series.id); showToast('Сериал удалён'); onSaved() } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось удалить сериал') } }
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="habit-form" onSubmit={(event) => void submit(event)}><div className="form-heading"><div><p className="eyebrow">Сериалы</p><h2>{series ? 'Редактирование' : 'Новый сериал'}</h2></div><button type="button" onClick={onClose}>×</button></div>{error && <div className="form-error">{error}</div>}<label>Название<input required value={item.title} onChange={(event) => setItemValue('title', event.target.value)} /></label><label>Оригинальное название<input value={item.originalTitle ?? ''} onChange={(event) => setItemValue('originalTitle', event.target.value || null)} /></label><div className="form-grid"><label>Формат<select value={item.format} onChange={(event) => setItemValue('format', event.target.value as SeriesFormat)}><option value="LIVE_ACTION">Сериал</option><option value="ANIMATION">Мультсериал</option></select></label><label>Статус выпуска<select value={item.releaseStatus} onChange={(event) => setItemValue('releaseStatus', event.target.value as ReleaseStatus)}>{Object.entries(releaseLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Год<input min="1900" type="number" value={item.releaseYear ?? ''} onChange={(event) => setItemValue('releaseYear', event.target.value ? Number(event.target.value) : null)} /></label><label>Жанр<input maxLength={100} value={item.genre ?? ''} onChange={(event) => setItemValue('genre', event.target.value || null)} /></label><label>Обложка<input type="url" value={item.coverUrl ?? ''} onChange={(event) => setItemValue('coverUrl', event.target.value || null)} /></label></div><label>Описание<textarea rows={3} value={item.description ?? ''} onChange={(event) => setItemValue('description', event.target.value || null)} /></label><fieldset className="library-fields"><legend>Моя библиотека</legend><label className="all-day-check"><input type="checkbox" checked={inLibrary} onChange={(event) => setInLibrary(event.target.checked)} />Добавить в библиотеку</label>{inLibrary && <><div className="form-grid"><label>Статус<select value={entry.status} onChange={(event) => setEntryValue('status', event.target.value as LibraryStatus)}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Оценка<select value={entry.rating ?? ''} onChange={(event) => setEntryValue('rating', event.target.value ? Number(event.target.value) : null)}><option value="">Без оценки</option>{Array.from({ length: 10 }, (_, index) => index + 1).map((value) => <option key={value}>{value}</option>)}</select></label></div><label className="favorite-check"><input type="checkbox" checked={entry.favorite} onChange={(event) => setEntryValue('favorite', event.target.checked)} />В избранном</label><label>Заметка<textarea rows={2} value={entry.personalNote ?? ''} onChange={(event) => setEntryValue('personalNote', event.target.value || null)} /></label></>}</fieldset><div className="form-buttons">{series && <button className="danger-button" type="button" onClick={() => void remove()}>Удалить</button>}<button className="secondary-button" type="button" onClick={onClose}>Отмена</button><button className="primary-button" disabled={saving}>{saving ? 'Сохраняем…' : 'Сохранить'}</button></div></form></div>
}
