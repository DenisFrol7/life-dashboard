import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { LoaderCircle, Upload } from 'lucide-react'
import { confirmMyShowsImport, enrichSeriesFromKinopoisk, matchMyShowsWithKinopoisk, previewMyShowsImport, type KinopoiskEnrichmentResult, type KinopoiskMatchPreview, type MyShowsImportChoice, type MyShowsImportPreview, type MyShowsImportResult } from '../api/myShowsImport'
import { getApiErrorMessage } from '../api/client'
import { useLatestRequest } from '../hooks/useLatestRequest'
import { useFormMutation } from '../hooks/useFormMutation'
import { MovieDialog } from './MovieDialog'
import './MyShowsImportDialog.css'

type Props = { onClose: () => void; onChanged: () => void; returnFocusTo: HTMLElement | null }
const seriesCount = (count: number) => {
  const lastTwo = count % 100, last = count % 10
  return `${count} ${lastTwo >= 11 && lastTwo <= 14 ? 'сериалов' : last === 1 ? 'сериал' : last >= 2 && last <= 4 ? 'сериала' : 'сериалов'}`
}

export function MyShowsImportDialog({ onClose, onChanged, returnFocusTo }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLElement>(null)
  const enrichmentRef = useRef<HTMLElement>(null)
  const readLockRef = useRef(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<MyShowsImportPreview | null>(null)
  const [matched, setMatched] = useState<KinopoiskMatchPreview | null>(null)
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [result, setResult] = useState<MyShowsImportResult | null>(null)
  const [enrichment, setEnrichment] = useState<KinopoiskEnrichmentResult | null>(null)
  const [readAction, setReadAction] = useState<'preview' | 'match' | null>(null)
  const [writeAction, setWriteAction] = useState<'import' | 'enrich'>('import')
  const [error, setError] = useState<string | null>(null)
  const requests = useLatestRequest()
  const mutations = useFormMutation()
  const { pending } = mutations
  const busy = pending || readAction !== null
  const unresolved = matched?.series.filter(item => !selections[item.title]).length ?? 0
  const importCount = matched?.series.filter(item => selections[item.title] && selections[item.title] !== 'SKIP').length ?? 0
  const step = result ? 4 : matched ? 3 : preview ? 2 : 1

  useEffect(() => {
    if (error) { errorRef.current?.scrollIntoView({ block: 'nearest' }); errorRef.current?.focus({ preventScroll: true }) }
  }, [error])
  useEffect(() => {
    const target = enrichmentRef.current ?? resultRef.current
    target?.scrollIntoView({ block: 'nearest' })
    target?.focus({ preventScroll: true })
  }, [result, enrichment])
  const close = () => {
    if (pending) return
    requests.dispose()
    mutations.dispose()
    onClose()
  }
  const loadPreview = async (source: File) => {
    if (pending || readLockRef.current) return
    readLockRef.current = true
    await requests.run(() => previewMyShowsImport(source), {
      onStart: () => { setReadAction('preview'); setError(null); setPreview(null); setMatched(null); setSelections({}) },
      onSuccess: setPreview,
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось проверить экспорт MyShows')),
      onFinish: () => { readLockRef.current = false; setReadAction(null) },
    })
  }
  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const source = event.target.files?.[0]
    event.target.value = ''
    if (!source || pending) return
    requests.invalidate()
    readLockRef.current = false
    setReadAction(null); setFile(null); setPreview(null); setMatched(null); setSelections({}); setError(null)
    if (!source.name.toLocaleLowerCase().endsWith('.xlsx')) { setError('Выберите XLSX-файл экспорта MyShows.'); return }
    setFile(source)
    void loadPreview(source)
  }
  const match = async () => {
    if (!file || !preview?.totalSeries || busy || readLockRef.current || result) return
    readLockRef.current = true
    await requests.run(() => matchMyShowsWithKinopoisk(file), {
      onStart: () => { setReadAction('match'); setError(null); setMatched(null); setSelections({}) },
      onSuccess: data => {
        setMatched(data)
        setSelections(Object.fromEntries(data.series.map(item => [item.title,
          item.selectedFilmId != null && item.candidates.some(candidate => candidate.filmId === item.selectedFilmId) ? String(item.selectedFilmId) : item.candidates.length ? '' : 'BASIC',
        ])))
      },
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось сопоставить сериалы с Кинопоиском')),
      onFinish: () => { readLockRef.current = false; setReadAction(null) },
    })
  }
  const confirmImport = async () => {
    if (!file || !matched || busy || unresolved || !importCount || result) return
    setWriteAction('import')
    setError(null)
    await mutations.run('save', async () => {
      if (!window.confirm('Импортировать выбранные сериалы и историю просмотров? Перед импортом будет создана резервная копия.')) return null
      const choices: MyShowsImportChoice[] = matched.series.map(item => {
        const value = selections[item.title]
        const candidate = item.candidates.find(entry => String(entry.filmId) === value)
        return { sourceTitle: item.title, action: value === 'SKIP' ? 'SKIP' : 'IMPORT', filmId: candidate?.filmId ?? null, nameRu: candidate?.nameRu ?? null, nameEn: candidate?.nameEn ?? null, year: candidate?.year ?? null }
      })
      return confirmMyShowsImport(file, choices)
    }, {
      onSuccess: imported => { if (imported) { setResult(imported); onChanged() } },
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось импортировать данные MyShows')),
    })
  }
  const enrich = async () => {
    if (!result || busy || enrichment?.remaining === 0) return
    setWriteAction('enrich')
    setError(null)
    await mutations.run('save', () => enrichSeriesFromKinopoisk(10), {
      onSuccess: updated => { setEnrichment(updated); if (updated.updated) onChanged() },
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось загрузить каталог Кинопоиска')),
    })
  }

  return <MovieDialog title="Импорт из MyShows" eyebrow="Сериалы" wide returnFocusTo={returnFocusTo} closeDisabled={pending} onClose={close} onSubmit={event => event.preventDefault()} actions={<>
    <button className={result ? 'primary-button' : 'secondary-button'} type="button" disabled={pending} onClick={close}>{result ? 'Готово' : 'Закрыть'}</button>
    {result ? <button className="secondary-button" type="button" disabled={busy || enrichment?.remaining === 0} onClick={() => void enrich()}>{pending ? 'Обновляем…' : enrichment?.remaining ? 'Продолжить загрузку данных' : 'Загрузить данные из Кинопоиска'}</button>
      : matched ? <button className="primary-button" type="button" disabled={busy || unresolved > 0 || !importCount} onClick={() => void confirmImport()}>{pending ? 'Импортируем…' : `Импортировать ${seriesCount(importCount)}`}</button>
        : preview ? <button className="primary-button" type="button" disabled={busy || !preview.totalSeries} onClick={() => void match()}>{readAction === 'match' ? 'Ищем совпадения…' : 'Найти в Кинопоиске'}</button>
          : file && <button className="primary-button" type="button" disabled={busy} onClick={() => void loadPreview(file)}>{readAction ? 'Проверяем файл…' : 'Повторить проверку'}</button>}
  </>}>
    <div className="myshows-mobile-content" aria-busy={busy}>
      <ol className="myshows-mobile-steps" aria-label="Этапы импорта">{['Файл', 'Сопоставление', 'Импорт'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined} data-complete={step > index + 1}><span aria-hidden="true">{index + 1}</span>{label}</li>)}</ol>
      {error && <div ref={errorRef} className="form-error" tabIndex={-1} role="alert">{error}</div>}
      {busy && <p className="myshows-mobile-progress" role="status"><LoaderCircle aria-hidden="true" /><span>{readAction === 'preview' ? 'Проверяем файл MyShows…' : readAction === 'match' ? 'Ищем сериалы в Кинопоиске. Это может занять несколько минут.' : writeAction === 'import' ? 'Импортируем сериалы и историю просмотров. Дождитесь завершения.' : 'Загружаем подробные данные. Дождитесь завершения.'}</span></p>}
      {result ? <>
        <section ref={resultRef} className="myshows-mobile-result" tabIndex={-1} role="status"><h3>Импорт завершён</h3><dl className="myshows-mobile-summary"><div><dt>Сериалов</dt><dd>{result.importedSeries}</dd></div><div><dt>Пропущено</dt><dd>{result.skippedSeries}</dd></div><div><dt>Просмотров эпизодов</dt><dd>{result.importedEpisodeWatches}</dd></div></dl><p>Резервная копия создана. Сериалы и история просмотров доступны в приложении.</p></section>
        {enrichment ? <section ref={enrichmentRef} className="myshows-mobile-result" tabIndex={-1} role="status"><h3>Данные Кинопоиска</h3><dl className="myshows-mobile-summary"><div><dt>Обновлено в этом пакете</dt><dd>{enrichment.updated}</dd></div><div><dt>Осталось</dt><dd>{enrichment.remaining}</dd></div></dl><p>{enrichment.rateLimited ? 'Достигнут лимит запросов Кинопоиска. Продолжите позже.' : enrichment.remaining ? 'Можно продолжить загрузку следующего пакета.' : 'Все связанные сериалы обновлены.'}</p></section> : <p className="myshows-mobile-hint">При необходимости загрузите описания и полную структуру сезонов из Кинопоиска.</p>}
      </> : <>
        <p className="myshows-mobile-hint">Выберите XLSX-файл экспорта MyShows. Сначала проверим файл и сопоставим сериалы с Кинопоиском. Предпросмотр не меняет данные приложения.</p>
        <input ref={inputRef} hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={selectFile} />
        <button type="button" className="secondary-button icon-button myshows-mobile-file" disabled={pending} onClick={() => inputRef.current?.click()}><Upload aria-hidden="true" />{file ? 'Выбрать другой файл' : 'Выбрать XLSX-файл'}</button>
        {file && <p className="myshows-mobile-filename"><span>Выбран файл</span><strong>{file.name}</strong></p>}
        {preview && <>
          <dl className="myshows-mobile-summary myshows-mobile-summary-five"><div><dt>Сериалов</dt><dd>{preview.totalSeries}</dd></div><div><dt>Просмотров эпизодов</dt><dd>{preview.totalEpisodeWatches}</dd></div><div><dt>Совпало</dt><dd>{preview.matchedSeries}</dd></div><div><dt>Новых</dt><dd>{preview.newSeries}</dd></div><div><dt>Неоднозначных</dt><dd>{preview.ambiguousSeries}</dd></div></dl>
          {preview.warnings.length > 0 && <ul className="myshows-mobile-warnings" aria-label="Замечания к файлу">{preview.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
          {!matched && <>
            {preview.series.length ? <ul className="myshows-mobile-preview" aria-label="Предпросмотр сериалов">{preview.series.slice(0, 20).map(item => <li key={item.title}><div><strong>{item.title}</strong><small>{item.status} · просмотрено эпизодов: {item.watchedEpisodes ?? 0}</small></div><span data-match={item.match}>{item.match === 'MATCHED' ? 'Совпадение' : item.match === 'NEW' ? 'Новый' : 'Проверить'}</span></li>)}</ul> : <p className="myshows-mobile-hint">В файле нет сериалов для импорта.</p>}
            {preview.series.length > 20 && <p className="myshows-mobile-hint">Показаны первые 20 из {preview.series.length} сериалов.</p>}
            {preview.totalSeries > 0 && <p className="myshows-mobile-hint">На следующем шаге названия сериалов будут отправлены в Kinopoisk Unofficial API для поиска совпадений и структуры сезонов.</p>}
          </>}
        </>}
        {matched && <>
          <dl className="myshows-mobile-summary"><div><dt>Всего</dt><dd>{matched.totalSeries}</dd></div><div><dt>Найдено точно</dt><dd>{matched.matchedSeries}</dd></div><div><dt>Нужно проверить</dt><dd>{matched.reviewRequired}</dd></div><div><dt>Не найдено</dt><dd>{matched.notFound}</dd></div></dl>
          <p className="myshows-mobile-selection-status" role="status">{unresolved ? `Осталось выбрать соответствие: ${unresolved}.` : importCount ? `Готово к импорту: ${seriesCount(importCount)}.` : 'Все сериалы пропущены. Выберите хотя бы один для импорта.'}</p>
          <div className="myshows-mobile-matches">{matched.series.map(item => {
            const value = selections[item.title] ?? ''
            const candidate = item.candidates.find(entry => String(entry.filmId) === value)
            return <div key={item.title}><label><span><strong>{item.title}</strong><small>{item.status}</small></span><select disabled={pending} aria-label={`Сопоставление: ${item.title}`} value={value} onChange={event => setSelections(current => ({ ...current, [item.title]: event.target.value }))}><option value="" disabled>Выберите соответствие</option>{item.candidates.map(entry => <option key={entry.filmId} value={entry.filmId}>{entry.nameRu || entry.nameEn || `ID ${entry.filmId}`}{entry.year ? ` (${entry.year})` : ''}</option>)}<option value="BASIC">Импортировать без Кинопоиска</option><option value="SKIP">Пропустить</option></select></label>{candidate && <p>{candidate.nameRu || candidate.nameEn || `ID ${candidate.filmId}`}{candidate.year ? ` (${candidate.year})` : ''}</p>}</div>
          })}</div>
        </>}
      </>}
    </div>
  </MovieDialog>
}
