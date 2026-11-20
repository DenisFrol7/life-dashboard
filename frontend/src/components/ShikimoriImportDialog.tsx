import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { LoaderCircle, Upload } from 'lucide-react'
import { importShikimori, previewShikimoriImport, type ShikimoriImportPreview, type ShikimoriImportResult } from '../api/anime'
import { getApiErrorMessage } from '../api/client'
import { useLatestRequest } from '../hooks/useLatestRequest'
import { useFormMutation } from '../hooks/useFormMutation'
import { MovieDialog } from './MovieDialog'
import './ShikimoriImportDialog.css'

type Props = { onClose: () => void; onChanged: () => void; returnFocusTo: HTMLElement | null }
const statusLabels: Record<string, string> = { planned: 'В планах', watching: 'Смотрю', rewatching: 'Пересматриваю', completed: 'Просмотрено', on_hold: 'На паузе', dropped: 'Брошено' }

export function ShikimoriImportDialog({ onClose, onChanged, returnFocusTo }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const resultRef = useRef<HTMLElement>(null)
  const readLockRef = useRef(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<ShikimoriImportPreview | null>(null)
  const [result, setResult] = useState<ShikimoriImportResult | null>(null)
  const [reading, setReading] = useState(false)
  const [visibleCount, setVisibleCount] = useState(20)
  const [error, setError] = useState<string | null>(null)
  const requests = useLatestRequest()
  const mutations = useFormMutation()
  const { pending } = mutations
  const busy = pending || reading
  const step = result ? 3 : preview ? 2 : 1

  useEffect(() => {
    if (error) { errorRef.current?.scrollIntoView({ block: 'nearest' }); errorRef.current?.focus({ preventScroll: true }) }
  }, [error])
  useEffect(() => {
    resultRef.current?.scrollIntoView({ block: 'nearest' })
    resultRef.current?.focus({ preventScroll: true })
  }, [result])

  const close = () => {
    if (pending) return
    requests.dispose()
    mutations.dispose()
    onClose()
  }
  const loadPreview = async (source: File) => {
    if (pending || readLockRef.current || result) return
    readLockRef.current = true
    await requests.run(() => previewShikimoriImport(source), {
      onStart: () => { setReading(true); setError(null); setPreview(null); setVisibleCount(20) },
      onSuccess: setPreview,
      onError: reason => setError(getApiErrorMessage(reason, 'Не удалось проверить экспорт Shikimori')),
      onFinish: () => { readLockRef.current = false; setReading(false) },
    })
  }
  const selectFile = (event: ChangeEvent<HTMLInputElement>) => {
    const source = event.target.files?.[0]
    event.target.value = ''
    if (!source || pending || result) return
    requests.invalidate()
    readLockRef.current = false
    setReading(false); setFile(null); setPreview(null); setError(null); setVisibleCount(20)
    if (!source.name.toLowerCase().endsWith('.json')) { setError('Выберите JSON-файл экспорта Shikimori.'); return }
    if (!source.size) { setError('Файл экспорта Shikimori пуст. Выберите другой файл.'); return }
    if (source.size > 2 * 1024 * 1024) { setError('Размер экспорта Shikimori превышает 2 МБ.'); return }
    setFile(source)
    void loadPreview(source)
  }
  const confirmImport = async () => {
    if (!preview?.total || busy || readLockRef.current || result) return
    setError(null)
    await mutations.run('save', async () => {
      if (!window.confirm(`Импортировать ${preview.total} записей? Перед изменением данных будет создана резервная копия.`)) return null
      return importShikimori(preview.token)
    }, {
      onSuccess: imported => { if (imported) { setResult(imported); setPreview(null); onChanged() } },
      onError: reason => {
        // The server consumes the preview token as soon as an import starts, including failed imports.
        setPreview(null)
        setError(`${getApiErrorMessage(reason, 'Не удалось импортировать Shikimori')} Повторите проверку файла перед новой попыткой импорта.`)
      },
    })
  }

  return <MovieDialog title="Импорт из Shikimori" eyebrow="Аниме" wide returnFocusTo={returnFocusTo} closeDisabled={pending} onClose={close} onSubmit={event => event.preventDefault()} actions={<>
    <button type="button" className={result ? 'primary-button' : 'secondary-button'} disabled={pending} onClick={close}>{result ? 'Готово' : 'Закрыть'}</button>
    {!result && (preview ? <button type="button" className="primary-button" disabled={busy || !preview.total} onClick={() => void confirmImport()}>{pending ? 'Импортируем…' : `Импортировать ${preview.total}`}</button>
      : file && <button type="button" className="primary-button" disabled={busy} onClick={() => void loadPreview(file)}>{reading ? 'Проверяем…' : 'Повторить проверку'}</button>)}
  </>}>
    <div className="shikimori-import-content" aria-busy={busy}>
      <ol className="shikimori-import-steps" aria-label="Этапы импорта">{['Файл', 'Проверка', 'Результат'].map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined} data-complete={step > index + 1}><span aria-hidden="true">{index + 1}</span>{label}</li>)}</ol>
      {error && <div ref={errorRef} className="form-error" tabIndex={-1} role="alert">{error}</div>}
      {busy && <p className="shikimori-import-progress" role="status"><LoaderCircle aria-hidden="true" /><span>{reading ? 'Проверяем файл Shikimori…' : 'Загружаем сведения из Shikimori и импортируем данные. Это может занять несколько минут. Дождитесь завершения.'}</span></p>}
      {result ? <section ref={resultRef} className="shikimori-import-result" tabIndex={-1} role="status">
        <h3>Импорт завершён</h3>
        <dl className="shikimori-import-summary"><div><dt>Добавлено аниме</dt><dd>{result.animeCreated}</dd></div><div><dt>Добавлено фильмов</dt><dd>{result.moviesCreated}</dd></div><div><dt>Обновлено</dt><dd>{result.updated}</dd></div><div><dt>Пропущено фильмов Кинопоиска</dt><dd>{result.skipped}</dd></div><div><dt>Отметок эпизодов</dt><dd>{result.episodeWatches}</dd></div></dl>
        <p>Резервная копия создана. Полнометражные аниме доступны в разделе «Фильмы», многосерийные — в разделе «Аниме».</p>
      </section> : <>
        <p className="shikimori-import-hint">Выберите JSON-файл экспорта Shikimori размером до 2 МБ. Сначала проверим файл без изменения данных приложения. После подтверждения загрузим сведения о тайтлах из Shikimori.</p>
        <input ref={inputRef} hidden type="file" accept=".json,application/json" onChange={selectFile} />
        <button type="button" className="secondary-button icon-button shikimori-import-file" disabled={pending} onClick={() => inputRef.current?.click()}><Upload aria-hidden="true" />{file ? 'Выбрать другой файл' : 'Выбрать JSON-файл'}</button>
        {file && <p className="shikimori-import-filename"><span>Выбран файл</span><strong>{file.name}</strong></p>}
        {preview && <>
          <dl className="shikimori-import-summary"><div><dt>Всего</dt><dd>{preview.total}</dd></div><div><dt>Просмотрено</dt><dd>{preview.completed}</dd></div><div><dt>Смотрю</dt><dd>{preview.watching}</dd></div><div><dt>В планах</dt><dd>{preview.planned}</dd></div><div><dt>Уже в каталоге</dt><dd>{preview.existing}</dd></div></dl>
          {preview.warnings.length > 0 && <ul className="shikimori-import-warnings" aria-label="Замечания к файлу">{preview.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}
          {preview.items.length ? <ul className="shikimori-import-preview" aria-label="Предпросмотр аниме">{preview.items.slice(0, visibleCount).map(item => <li key={item.shikimoriId}>
            <div><strong>{item.title || item.originalTitle || `Shikimori ID ${item.shikimoriId}`}</strong>{item.originalTitle && item.originalTitle !== item.title && <small>{item.originalTitle}</small>}<small>{statusLabels[item.status] || item.status || 'Статус не указан'} · просмотрено эпизодов: {item.watchedEpisodes}{item.rewatches > 0 ? ` · пересмотров: ${item.rewatches}` : ''}</small></div>
            <div className="shikimori-import-item-info"><span>{item.existingContentId != null ? 'В каталоге' : 'Новый'}</span>{item.score != null && <b aria-label={`Оценка: ${item.score} из 10`}>{item.score}/10</b>}</div>
          </li>)}</ul> : <p className="shikimori-import-hint">В файле нет аниме для импорта.</p>}
          {preview.items.length > visibleCount && <button type="button" className="secondary-button shikimori-import-more" onClick={() => setVisibleCount(count => count + 20)}>Показать ещё {Math.min(20, preview.items.length - visibleCount)}</button>}
          {preview.total > 0 && <p className="shikimori-import-hint">Будет импортировано записей: {preview.total}. Показано в предпросмотре: {Math.min(visibleCount, preview.items.length)} из {preview.items.length}.</p>}
        </>}
      </>}
    </div>
  </MovieDialog>
}
